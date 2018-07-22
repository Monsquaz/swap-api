import {
  createIdFieldSqlBatcher,
  createForeignFieldSqlBatcher,
  _Q,
  listByField
} from '../util';

exports.eventsById = createIdFieldSqlBatcher('events', 'id');
exports.eventIsAdministeredByEventAndUser = async (tuples) => {};
