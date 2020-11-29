const {
  createIdFieldSqlBatcher,
  createForeignFieldSqlBatcher,
  _Q,
  listByField,
  uniqT,
  unitTuples
} = require('../util');

const squel = require("squel");
const { select, expr } = squel;
const and = (...args) => expr().and(...args);
const or  = (...args) => expr().or( ...args);
const db = require('../../db');

const uniq = require('lodash.uniq');

exports.roundsubmissionsById = createIdFieldSqlBatcher('roundsubmissions', 'id');
