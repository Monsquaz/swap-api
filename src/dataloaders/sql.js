const db = require('../../db');

exports.sql = async (params) => {
  return await Promise.all(params.map(async (param) => {
    let [rows, fields] = await db.query(param.text, param.values);
    return rows;
  }));
}
