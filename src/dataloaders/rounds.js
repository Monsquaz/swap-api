import {
  createIdFieldSqlBatcher,
  createForeignFieldSqlBatcher,
  _Q,
  listByField,
  uniqT,
  unitTuples
} from '../util';

const squel = require("squel");
const { select, expr } = squel;
const and = (...args) => expr().and(...args);
const or  = (...args) => expr().or( ...args);

const uniq = require('lodash.uniq');

exports.roundsById = createIdFieldSqlBatcher('rounds', 'id');

exports.roundParticipationByRoundAndUser = async (tuples) => {

};
