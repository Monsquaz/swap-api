var db = require('mysql2-promise')();
import config from './config';
db.configure(config.db);
db._query = db.query;
db.query = (...args) => {
  console.warn(args);
  return db._query(...args);
}
export default db;
