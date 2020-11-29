const {
  createIdFieldSqlBatcher,
  createForeignFieldSqlBatcher,
  _Q,
  listByField
} = require('../util');

exports.filesById = createIdFieldSqlBatcher('files','id');
