const squel = require('squel');
const uniq = require('lodash.uniq');
const inflector = require('inflector');
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
const and = (...args) => squel.expr().and(...args);
const or = (...args) => squel.expr().or(...args);
const { select, insert, update, rstr } = squel;
import config from '../config';
import db from '../db';

let applyFilter = (filter, fieldAliases = {}, customFilters = {}) => {
  return Object.keys(filter).reduce((expr, k) => {
    switch (k) {
      case 'AND':
        return filter[k].reduce((ack, f) => ack.and(applyFilter(f, fieldAliases, customFilters)), expr);
      case 'OR':
        return filter[k].reduce((ack, f) => ack.or(applyFilter(f, fieldAliases, customFilters)), expr);
      case 'NOT':
        return filter[k].reduce((ack, f) => ack.and('NOT (?)', applyFilter(f, fieldAliases, customFilters)), expr);
      default:
        if (k in customFilters) {
          return customFilters[k](filter[k], expr);
        }
        if (filter[k] === null) return expr; // If null, we default to not filtering
        let op;
        if (Array.isArray(filter[k])) {
          if (filter[k].length == 0) return expr.and('1 = 0'); // Empty list!
          op = 'IN';
        } else {
          op = '=';
        }
        return expr.and(
          `${fieldAliases && k in fieldAliases ? fieldAliases[k] : k} ${op} ?`,
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

exports.truncateWithEllipses = (text, max) => text.substr(0,max-1)+(text.length>max?'&hellip;':'');

/*
exports.getMailer = () => {
  return nodemailer.createTransport({
    sendmail: true,
    newline: 'unix',
    path: '/usr/sbin/sendmail'
  });
};*/

// Temp. For debugging.
exports.getMailer = () => ({
  sendMail: (data) => {
    console.warn('sendMail: ', data)
  }
});

import reCaptcha from 'recaptcha2';

exports.isCaptchaOK = async (response) => {
  let recaptcha = new reCaptcha({
    siteKey:   config.reCaptcha.siteKey,
    secretKey: config.reCaptcha.secretKey
  })
  try {
    await recaptcha.validate(response);
    return true;
  } catch(err) {
    return false;
  }
};

exports.findFillIn = async (roundsubmission) => {
  let param = select()
    .field('ep.user_id')
    .field(rstr('COUNT(fia.id)'), 'numFillins')
    .from('events', 'e')
    .join('event_participants', 'ep', 'e.id = ep.event_id')
    .join('roundsubmissions', 'rs', 'e.id = rs.event_id')
    .left_join('fill_in_attempts', 'fia', 'rs.id = fia.roundsubmission_id')
    .where(
       and('e.id = ?', roundsubmission.event_id)
      .and('rs.id = ?', roundsubmission.id)
      .and('ep.user_id != ?', roundsubmission.fill_in_participant ||
                              roundsubmission.participant)
      .and(
        'ep.user_id NOT IN ?',
        select().field('user_id').from('fill_in_attempts', 'fia2').where(
          'fia2.roundsubmission_id = ?', roundsubmission.id
        )
      )
      .and(
        'ep.user_id NOT IN ?',
        select().field('participant').from('roundsubmissions', 'rs2').where(
           and('participant IS NOT NULL')
          .and(
            or('rs2.song_id = ?', roundsubmission.song_id)
           .or('rs2.round_id = ?', roundsubmission.round_id)
          )
        )
      )
      .and(
        'ep.user_id NOT IN ?',
        select().field('fill_in_participant').from('roundsubmissions', 'rs3').where(
           and('fill_in_participant IS NOT NULL')
          .and(
            or('rs3.song_id = ?', roundsubmission.song_id)
           .or('rs3.round_id = ?', roundsubmission.round_id)
          )
        )
      )
    )
    .group('ep.user_id')
    .order('numFillins')
    .order('RAND()')
    .limit(1)
    .toParam();
  let [ rows ] = await db.query(param.text, param.values);
  let batch = [];
  let updateData = {};
  let result = false;
  await db.transaction(async (t) => {
    if (rows.length > 0) {
      result = true;
      updateData = {
        status: 'FillInAquired',
        fill_in_participant: rows[0].user_id
      };
      param = insert().into('fill_in_attempts').setFields({
        roundsubmission_id: roundsubmission.id,
        user_id: rows[0].user_id,
        created: rstr('NOW()')
      }).toParam();
      batch.push(t.query(param.text, param.values));
    } else {
      updateData = {
        status: 'FillInRequested'
      };
    }
    let query = update().table('roundsubmissions', 'rs').setFields(updateData);
    if (rows.length == 0) query = query.set('fill_in_participant = NULL');
    param = query.where('id = ?', roundsubmission.id).toParam();
    batch.push(t.query(param.text, param.values));
    await Promise.all(batch);
  });
  return result;
};

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

let createSelection = ({ type, directFields, sortFields, numericFields }) => {
  // TODO: custom filters
  if (!type) throw new Error ('');
  sortFields = sortFields || [];
  directFields = directFields || {};
  numericFields = numericFields || [];
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
      NOT: [${typePluralUc}Filter!]
      id: ID,
      ${Object.keys(directFields).map(f => `${f}: ${directFields[f]}`).join('\n')}
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

exports.getUserIdFromToken = (header) => {
  let [ authType, authToken, _ ] = header.split(' ');
  if (_ || authType !== 'Bearer') {
    throw new Error('Malformed authorization header');
  }
  let obj = (jwt.verify(authToken, config.jwt.secret));
  if (!('userId' in obj)) throw new Error('No user id found');
  return obj.userId;
}
