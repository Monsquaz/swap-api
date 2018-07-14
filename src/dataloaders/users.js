import {
  createIdFieldSqlBatcher,
  createForeignFieldSqlBatcher,
  _Q,
  listByField
} from '../util';

exports.usersById = createIdFieldSqlBatcher('users','id');
exports.usersByUsername = createIdFieldSqlBatcher('users','username');
exports.usersByEmail = createIdFieldSqlBatcher('users','email');
