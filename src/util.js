const squel = require('squel');
const uniq = require('lodash.uniq');
const inflector = require('inflector');
import db from '../db';

let applyFilter = (filter, fieldAliases = {}, customFilters = {}) => {
  return Object.keys(filter).reduce((expr, k) => {
    switch (k) {
      case 'AND':
        return filter[k].reduce((ack, f) => ack.and(applyFilter(f, fieldAliases, customFilters)), expr);
      case 'OR':
        return filter[k].reduce((ack, f) => ack.or(applyFilter(f, fieldAliases, customFilters)), expr);
      case 'NOT':
        return expr.and('NOT (?)', applyFilter(filter[k], fieldAliases, customFilters));
      default:
        if (k in customFilters) {
          return customFilters[k](filter[k], expr);
        }
        return expr.and(
          `${fieldAliases && k in fieldAliases ? fieldAliases[k] : k} IN ?`,
          filter[k]
        );
    }
  }, squel.expr())
};

let _Q = (n) => Array(n).fill('?').join(',');

let listByTuple = (data, tuples, keys, mapFn) => {
  if (!mapFn) mapFn = e => e;
  let res = data.reduce((ack, e) => {
    let k = String(keys.map(k => e[k]));
    return { ...ack, [k]: (k in ack ? [...ack[k], mapFn(e)] : [mapFn(e)]) };
  }, {});
  return tuples.map(e => {
    let k = String(e);
    return k in res ? res[k]: [];
  });
}

let uniqT = (tuples) => uniq(tuples.map(t => t.join(','))).map(t => t.split(','));

exports._Q = _Q;
exports.listByTuple = listByTuple;
exports.uniqT = uniqT;

exports.createIdFieldSqlBatcher = (table, idColumn, nullable = true) => {
  return async function(idColumnIds) {
    let { text, values } = squel
      .select()
      .from(table)
      .where(`${idColumn} IN ?`, idColumnIds)
      .order(`FIELD(${idColumn}, ${_Q(idColumnIds.length)})`, null, ...idColumnIds)
      .toParam();
    let [rows] = await db.query(text, values);
    if (nullable) {
      if (rows.length === idColumnIds.length) return rows;
      let ack = rows.reduce((a,e) => ({...a, [e[idColumn]]: e}), {});
      return idColumnIds.map(id => id in ack ? ack[id] : null);
    } else {
      return rows;
    }
  };
};

exports.createForeignFieldSqlBatcher = (table, foreignColumn) => {
  return async function(foreignColumnIds) {
    let { text, values } = squel
      .select()
      .from(table)
      .where(`${foreignColumn} IN ?`, foreignColumnIds)
      .order(`FIELD(${foreignColumn}, ${_Q(foreignColumnIds.length)})`, null, ...foreignColumnIds)
      .toParam();
    let [rows] = await db.query(text, values);
    return listByTuple(rows, foreignColumnIds, [foreignColumn]);
  };
};


exports.filterFns = {
  search: (fields) => (value, expr) =>
    fields.reduce((expr, field) => expr.or(`${field} LIKE ?`, `%${value}%`), expr),
  numerics: (fieldMappings) => Object.keys(fieldMappings).reduce((ack, k) => ({
    ...ack,
    [k+'_lt']:  (value, expr) => expr.and(`${fieldMappings[k]} < ?`, value),
    [k+'_gt']:  (value, expr) => expr.and(`${fieldMappings[k]} > ?`, value),
    [k+'_lte']: (value, expr) => expr.and(`${fieldMappings[k]} <= ?`, value),
    [k+'_gte']: (value, expr) => expr.and(`${fieldMappings[k]} >= ?`, value),
  }), {})
};

let numericFilters = (fields) => {
  let ret = fields
    .map(
      f => ['lt','gt','lte','gte'].map(suffix => `${f[0]}_${suffix}: ${f[1]}`)
    )
    .join("\n");
  return ret;
}

let createRootQuery = (type) => {
  let typeUc = type.charAt(0).toUpperCase() + type.substr(1);
  let typePlural = type.plural();
  let typePluralUc = typePlural.charAt(0).toUpperCase() + typePlural.substr(1);
  return type.toLowerCase().plural()
    + `(selection: ${typePluralUc}Selection = {}): [${typeUc}!]!`;
};

let createSelection = (type, sortFields = [], numericFields = []) => {
  // TODO: custom filters!
  let typePlural = type.plural();
  let typePluralUc = typePlural.charAt(0).toUpperCase() + typePlural.substr(1);
  return `
    ${sortFields.length > 0 ?
      `enum ${typePluralUc}SortField {
        ${sortFields.join(', ')}
      }` : ``
    }
    input ${typePluralUc}Selection {
      filters: ${typePluralUc}Filter
      offset: Int
      limit: Int
      sort: ${typePluralUc}SortField
      descending: Boolean
    }
    input ${typePluralUc}Filter {
      AND: [${typePluralUc}Filter!]
      OR: [${typePluralUc}Filter!]
      id: ID,
      ${numericFilters(numericFields)}
    }
  `;
};

exports.schemaHelper = {
  numericFilters,
  createRootQuery,
  createSelection
};

exports.performSelection = ({ query, selection, fieldAliases = {}, customFilters = {} }) => {
  let { filters, offset, limit, sort, descending } = selection;
  if (filters) {
    query = query.where(
      applyFilter(filters, fieldAliases, customFilters)
    );
  }
  if (sort) {
    let sortField = sort in fieldAliases ? fieldAliases[sort] : sort;
    query = query.order(sortField, !descending);
  }
  query = query
    .offset(offset || 0)
    .limit(limit || 500);
  return query;
}
