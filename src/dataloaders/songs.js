const {
  createIdFieldSqlBatcher,
  createForeignFieldSqlBatcher,
  _Q,
  listByField
} = require('../util');

exports.songsById = createIdFieldSqlBatcher('songs','id');
