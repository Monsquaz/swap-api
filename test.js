let jwt = require('jsonwebtoken');
let config = require('./config');

let kuk = jwt.sign({ userId: String(88) }, config.jwt.secret);

console.warn('kuk', kuk);
