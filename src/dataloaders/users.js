import {
  createIdFieldSqlBatcher,
  createForeignFieldSqlBatcher,
  _Q,
  listByTuple
} from '../util';

const squel = require("squel");
const { select, expr } = squel;
const and = (...args) => expr().and(...args);
const or  = (...args) => expr().or( ...args);
import db from '../../db';

exports.usersById = createIdFieldSqlBatcher('users','id');
exports.usersByUsername = createIdFieldSqlBatcher('users','username');
exports.usersByEmail = createIdFieldSqlBatcher('users','email');

exports.participantsByEventId = async (ids) => {
  let { text, values } = squel
    .select()
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
