import crypto from 'crypto';
import base64url from 'base64url';
import phpPassword from 'node-php-password';
import validator from 'validator';
import strength from 'strength';
import nodemailer from 'nodemailer';
import config from '../../../../config';
import squel from 'squel';
const { insert, update  } = squel;
import jwt from 'jsonwebtoken';
import db from '../../../../db';

exports.resolver = {
  Mutation: {

    createUser: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { usersByEmail, usersByUsername } = loaders;
      let { params } = args;
      let { email, username, password, firstname, lastname, captchaResponse }
        = params;
      let validationMessages = validateFields(params);
      if (validationMessages.length > 0) {
        throw new Error('Validation error: ' + validationMessages.join(', '));
      }
      let [byEmail, byUsername] = await Promise.all([
        usersByEmail.load(email), usersByUsername.load(username)
      ]);
      if (byEmail.length > 0) {
        throw new Error('A user already exists with that email.');
      }
      if (byUsername.length > 0) {
        throw new Error('A user already exists with that username.');
      }
      let data = {
        ...formatParameters({
          email, username, password, firstname, lastname, captchaResponse
        }),
        activation_code: getGeneratedVerificationCode(48),
        activation_status: 0
      };
      let { text, values }
        = insert().into('users').setFields(data).toParam();
      let [{ insertId }] = await db.query(text, values);
      return { code: 200, message: 'User created successfully' }
    },

    verifyUser: async(_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { usersById } = loaders;
      let { params } = args;
      let { id, code } = params;
      let user = await usersById.load(id);
      if (!user) throw new Error('User doesn\'t exist');
      if (code !== user.activation_code) {
        throw new Error('Vertification code is invalid');
      }
      if (user.activation_status != 0) {
        throw new Error('User is already activated');
      }
      let fields = { activation_status: 1 };
      let { text, values }
        = update().table('users').setFields(fields).where('id = ?', id).toParam();
      let result = await db.query(text, values);
      return { code: 200, message: 'User verified successfully.' }
    },

    updateUser: async(_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { usersById } = loaders;
      let { params } = args;
      let { id, email, username, password, firstname, lastname } = params;
      if (userId !== id ) throw new Error('You can only update your own user');
      let user = await usersById.load(id);
      if (!user) throw new Error('User doesn\'t exist');
      let validationMessages = validateFields(params);
      if (validationMessages.length > 0) {
        throw new Error('Validation error: ' + validationMessages.join(', '));
      }
      let fields = { ...formatParameters(params) };
      let { text, values }
        = update().table('users').setFields(fields).where('id = ?', id).toParam();
      let result = await db.query(text, values);
      return { code: 200, message: 'User updated successfully' };
    },

    deleteUser: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      return { code: 200, message: "Not implemented yet" };
    },

    loginUser: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { usersByUsername } = loaders;
      let { params } = args;
      let { username, password } = params;
      let user = await usersByUsername.load(username);
      if (!user) throw new Error('Invalid username or password.');
      let passwordOk = phpPassword.verify(password, user.password);
      if (!passwordOk) throw Error('Invalid email or password.');
      let authToken = jwt.sign({ userId: String(user.id) }, config.jwt.secret);
      return { user, authToken };
    }

  }
};

let validateFields = (data) => {
  return Object.keys(data).reduce((ack, k) => {
    let v = data[k];
    switch (k) {
      case 'email':
        if (!validator.isEmail(v)) return [ ...ack, "Invalid email address" ];
        return ack;
      case 'firstname':
        if (v.length < 1) return [ ...ack, "firstname is too short" ];
        return ack;
      case 'lastname':
        if (v.length < 1) return [ ...ack, "lastname is too short" ];
        return ack;
      case 'username':
        if (!validator.isAlpha(v)) return [ ...ack, "username must be alphanumeric" ];
        return ack;
      case 'password':
        if (strength(v) < 2) return [ ...ack, "Password is not strong enough" ]
          return ack;
      case 'captchaResponse':
        if(!isValidCaptchaResponse(v)) return [ ...ack, "Invalid captcha" ]
        return ack;
      default:
        return ack;
    }
  }, [])
};

let isValidCaptchaResponse = (captchaResponse) => true; // TEMP!

let formatParameters = (params) => {
  let res = Object.keys(params).reduce((ack, k) => {
    let v = params[k];
    switch (k) {
      case 'email':
      case 'firstname':
      case 'lastname':
      case 'username':
        return { ...ack, [k]: v.trim() };
      case 'password': return { ...ack, password: phpPassword.hash(v)};
      default:
        return ack;
    }
  }, {});
  return res;
};

let formatName = (name) => {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};

let getGeneratedVerificationCode = (size) => {
  return base64url(crypto.randomBytes(size));
};

let isValidEmail = (email) => {
  var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}