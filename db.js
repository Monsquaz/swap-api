var db = require('mysql2-promise')();
import config from './config';
db.configure(config.db);
db._query = db.query;
db.query = (...args) => {
  console.warn(args);
  return db._query(...args);
}

db.transaction = async (p) => {
  // No transactions for now
  return await p(db);

  // TODO: Fix this shit?
  let con = await new Promise(res => {
    db.pool.getConnection((err, con) => {
      if (err) {
        if (con) {
          con.release();
        }
        throw err;
      }
      res(con);
    });
  });
  await con.query('START TRANSACTION');
  try {
    let c = {
      query: (...args) => new Promise((resolve, reject) => {
        con.query(...args, (err, result) => {
          if (err) {
            return reject(err);
          }
          resolve([result]);
        })
      })
    }
    let promise = p(c);
    let result = await promise;
    await promise.then(
      async () => {
        await con.query('COMMIT')
      },
      async () => {
        await con.query('ROLLBACK')
      }
    );
    con.release();
    return result;
  } catch (err) {
    console.warn(err);
    await con.query('ROLLBACK');
    con.release();
    throw err;
  }
}

export default db;
