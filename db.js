var db = require('mysql2-promise')();
import config from './config';
db.configure(config.db);
db._query = db.query;
db.query = (...args) => {
  console.warn(args);
  return db._query(...args);
}

db.transaction = async (p) => {
  let con = await new Promise(res => {
    db.pool.getConnection((err, con) => {
      if (con) res(con);
      else if(err) throw err;
    });
  });
  await con.query('START TRANSACTION');
  try {
    let promise = p(db);
    let result = await promise;
      await promise.then(
        async () => await con.query('COMMIT'),
        async () => await con.query('ROLLBACK')
      )
    return result;
  } catch (err) {
    console.warn(err);
    await con.query('ROLLBACK');
    throw err;
  }
}

export default db;
