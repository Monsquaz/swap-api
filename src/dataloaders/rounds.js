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

exports.roundsById = createIdFieldSqlBatcher('rounds', 'id');

exports.roundParticipationByRoundAndUser = async (tuples) => {
  let roundIds = uniq(tuples.map(e => e[0]));
  let userIds = uniq(tuples.map(e => e[1]));
  let uniqTuples = uniqT(tuples);
  let { text, values } =
    select()
    .field('rs.round_id')
    .field('rs.participant')
    .field('rs.fill_in_participant')
    .from('roundsubmissions', 'rs')
    .where(
       and('rs.round_id IN ?', roundIds)
      .and(
         or('rs.participant IN ?', userIds)
        .or('rs.fill_in_participant IN ?', userIds)
      )
      .and(
         or(`(rs.round_id, rs.participant) IN (${_Q(uniqTuples.length)})`, ...uniqTuples)
        .or(`(rs.round_id, rs.fill_in_participant) IN (${_Q(uniqTuples.length)})`, ...uniqTuples)
      )
    ).toParam();
  let [rows] = await db.query(text, values);
  let byTuple = rows.reduce((ack, e) => {
    let res = {
      ...ack, [String([e.round_id, e.participant])]: true
    };
    if (e.fill_in_participant) {
      res[String([e.round_id, e.fill_in_participant])] = true;
    }
    return res;
  }, {});
  return tuples.map(e => {
    let k = String(e);
    return k in byTuple ? byTuple[k] : false;
  });
};
