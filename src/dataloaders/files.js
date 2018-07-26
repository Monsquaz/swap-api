import {
  createIdFieldSqlBatcher,
  createForeignFieldSqlBatcher,
  _Q,
  listByField
} from '../util';

exports.filesById = createIdFieldSqlBatcher('files','id');
