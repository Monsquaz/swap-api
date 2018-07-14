import {
  createIdFieldSqlBatcher,
  createForeignFieldSqlBatcher,
  _Q,
  listByField
} from '../util';

exports.songsById = createIdFieldSqlBatcher('songs','id');
