let jwt = require('jsonwebtoken');
let config = require('./config');

let kuk = jwt.sign({ userId: String(25) }, config.jwt.secret);

console.warn('kuk', kuk);
