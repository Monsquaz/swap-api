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

exports.eventsById = createIdFieldSqlBatcher('events', 'id');
exports.eventsBySlug = createIdFieldSqlBatcher('events', 'slug');

exports.eventIsAdministeredByEventAndUser = async (tuples) => {
  let eventIds = uniq(tuples.map(e => e[0]));
  let userIds = uniq(tuples.map(e => e[1]));
  let uniqTuples = uniqT(tuples);
  let { text, values } =
    select()
    .field('e.id')
    .field('e.host_user_id')
    .from('events', 'e')
    .where(
       and('e.id IN ?', eventIds)
      .and('e.host_user_id IN ?', userIds)
      .and(`(e.id, e.host_user_id) IN (${_Q(uniqTuples.length)})`, ...uniqTuples)
    ).toParam();
  let [rows] = await db.query(text, values);
  let byTuple = rows.reduce((ack, e) => ({
    ...ack, [String([e.id, e.host_user_id])]: true
  }), {});
  return tuples.map(e => {
    let k = String(e);
    return k in byTuple ? byTuple[k] : false;
  });
};

exports.eventIsParticipatedByEventAndUser = async (tuples) => {
  let eventIds = uniq(tuples.map(e => e[0]));
  let userIds = uniq(tuples.map(e => e[1]));
  let uniqTuples = uniqT(tuples);
  let { text, values } =
    select()
    .field('ep.event_id')
    .field('ep.user_id')
    .from('event_participants', 'ep')
    .where(
       and('ep.event_id IN ?', eventIds)
      .and('ep.user_id IN ?', userIds)
      .and(`(ep.event_id, ep.user_id) IN (${_Q(uniqTuples.length)})`, ...uniqTuples)
    ).toParam();
  let [rows] = await db.query(text, values);
  let byTuple = rows.reduce((ack, e) => ({
    ...ack, [String([e.event_id, e.user_id])]: true
  }), {});
  return tuples.map(e => {
    let k = String(e);
    return k in byTuple ? byTuple[k] : false;
  });
};

exports.eventWasInvitedByEventAndUser = async (tuples) => {
  let eventIds = uniq(tuples.map(e => e[0]));
  let userIds = uniq(tuples.map(e => e[1]));
  let uniqTuples = uniqT(tuples);
  let { text, values } =
    select()
    .field('ep.event_id')
    .field('ep.user_id')
    .from('event_invitations', 'ep')
    .where(
       and('ep.event_id IN ?', eventIds)
      .and('ep.user_id IN ?', userIds)
      .and(`(ep.event_id, ep.user_id) IN (${_Q(uniqTuples.length)})`, ...uniqTuples)
    ).toParam();
  let [rows] = await db.query(text, values);
  let byTuple = rows.reduce((ack, e) => ({
    ...ack, [String([e.event_id, e.user_id])]: true
  }), {});
  return tuples.map(e => {
    let k = String(e);
    return k in byTuple ? byTuple[k] : false;
  });
};
