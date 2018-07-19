var db = require('mysql2-promise')();
import config from './config';
db.configure(config.db);
db._query = db.query;
db.query = (...args) => {
  console.warn(args);
  return db._query(...args);
}

// TODO: Important, make sure all queries use the same connection within transaction.
db.transaction = async (p) => {
  await db.query('START TRANSACTION');
  try {
    let promise = p(db);
    let result = await promise;
      await promise.then(
        async () => await db.query('COMMIT'),
        async () => await db.query('ROLLBACK')
      )
    return result;
  } catch (err) {
    console.warn(err);
    await db.query('ROLLBACK');
  }
}

export default db;
