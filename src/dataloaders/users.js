const {
  createIdFieldSqlBatcher,
  createForeignFieldSqlBatcher,
  _Q,
  listByTuple
} = require('../util');

const squel = require("squel");
const { select, expr } = squel;
const and = (...args) => expr().and(...args);
const or  = (...args) => expr().or( ...args);
const db = require('../../db');

exports.usersById = createIdFieldSqlBatcher('users','id');
exports.usersByUsername = createIdFieldSqlBatcher('users','username');
exports.usersByEmail = createIdFieldSqlBatcher('users','email');

exports.participantsByEventId = async (ids) => {
  let { text, values } =
    select()
    .field('ep.event_id')
    .field('u.*')
    .from('event_participants', 'ep')
    .join('users', 'u', 'ep.user_id = u.id')
    .where('ep.event_id IN ?', ids)
    .order(`FIELD(ep.id, ${_Q(ids.length)})`, null, ...ids)
    .toParam();
  let [rows] = await db.query(text, values);
  return listByTuple(rows, ids, ['event_id']);
};

exports.invitedUsersByEvent = async (ids) => {
  let { text, values } =
    select()
    .field('ei.event_id')
    .field('u.*')
    .from('event_invitations', 'ei')
    .join('users', 'u', 'ei.user_id = u.id')
    .where('ei.event_id IN ?', ids)
    .order(`FIELD(ei.id, ${_Q(ids.length)})`, null, ...ids)
    .toParam();
  let [rows] = await db.query(text, values);
  return listByTuple(rows, ids, ['event_id']);
};
