const squel = require("squel");
const { insert, update, select, expr } = squel;
const and = (...args) => expr().and(...args);
const or  = (...args) => expr().or( ...args);
import fs from 'fs';
import mime from 'mime-to-extensions';
import { getUserIdFromToken } from '../util';
import db from '../../db';
import { filesDir } from '../../config';

exports.getFile = async (req, res) => {
  //try {
    let { headers } = req;
    let { authorization } = headers;
    if (!authorization) throw new Error('Authorization required');
    let userId = getUserIdFromToken(authorization);
    if (!userId) throw new Error('Could not find user');
    let { id } = req.params;
    if (String(parseInt(id, 10)) != id) throw new Error('id must be an integer');
    if (id <= 0) throw new Error('id must be positive and non-zero');
    let { text, values } = select()
      .field('f.filename')
      .field('f.sizeBytes')
      .from('files', 'f')
      .left_join('events', 'e', 'f.id = e.initial_file')
      .left_join('roundsubmissions', 'rsse', 'f.id = rsse.file_id_seeded')
      .left_join('events', 'es', 'rsse.event_id = es.id')
      .left_join('roundsubmissions', 'rssu', 'f.id = rssu.file_id_submitted')
      .where(
         and('f.id = ?', id)
        .and(
           or('e.host_user_id = ?', userId)
          .or(
             and('es.is_public = 1')
            .and(
               or('es.status = ?', 'Completed')
              .or('es.are_changes_visible = 1')
            )
          )
          .or('? IN (rsse.participant, rsse.fill_in_participant)', userId)
          .or(
             and('rssu.participant = ?', userId)
            .and('rssu.fill_in_participant IS NULL')
          )
          .or('rssu.fill_in_participant = ?', userId)
        )
      ).toParam();
    let [ rows ] = await db.query(text, values);
    if (rows.length == 0) throw new Error('File not found');
    let { filename, sizeBytes } = rows[0];
    let [ extension ] = filename.split('.').slice(-1);
    res.download(`${filesDir}/${filename}`, `${id}.${extension}`);
  //} catch (err) {
    //res.send(err.message);
  //}
};

exports.uploadRoundsubmissionFile = async (req, res) => {
  try {
    let { headers, files } = req;
    let { authorization } = headers;
    if (!authorization) throw new Error('Authorization required');
    if (Object.keys(files).length !== 1) {
      throw new Error('You have to upload one file');
    }
    let file = files[Object.keys(files)[0]];
    let userId = getUserIdFromToken(authorization);
    if (!userId) throw new Error('Could not find user');
    let { id } = req.params;
    if (String(parseInt(id, 10)) != id) throw new Error('id must be an integer');
    if (id <= 0) throw new Error('id must be positive and non-zero');
    let { text, values } = select().from('roundsubmissions', 'rs')
    .where(
       and('id = ?', id)
      .and(
         or(
            and('participant = ?', userId)
           .and('fill_in_participant IS NULL')
           .and('status IN ?', ['Started','Submitted'])
         )
        .or(
           and('fill_in_participant = ?', userId)
          .and('status IN ?', ['FillInAquired','Submitted'])
        )
      )
    ).toParam();
    let [ rows ] = await db.query(text, values);
    console.warn('COCKD', rows);
    if (rows.length == 0) throw new Error('Access denied');
    //let [ extension ] = file.name.split('.').slice(-1);
    let extension = mime.extension(file.mimetype) || 'file';
    await db.transaction(async (t) => {
      let p = insert().into('files');
      let [{ insertId }] = await t.query(p.text, p.value);
      let { filename, stats: { size } } = await new Promise((res, rej) => {
        let filename = `${filesDir}/${insertId}.${extension}`;
        file.mv(filename, (err) => {
          if (err) throw new Error(err);
          fs.stat(filename, (err, stats) => {
            if (err) throw new Error(err);
            res({ filename, stats });
          });
        });
      });
      p = update().table('files').setFields({ filename, sizeBytes: size })
      .where('id = ?', insertId).toParam();
      let p2 = update().table('roundsubmissions', 'rs').setFields({
        file_id_submitted: insertId
      }).where('id = ?', id).toParam();
      await Promise.all([
        await t.query(p.text, p.value),
        await t.query(p2.text, p2.value)
      ]);
    });
    res.send('File uploaded!');
  } catch (err) {
    res.send(err.message);
  }
};

exports.uploadEventFile = async (req, res) => {
  try {
    let { headers, files } = req;
    let { authorization } = headers;
    if (!authorization) throw new Error('Authorization required');
    if (Object.keys(files).length !== 1) {
      throw new Error('You have to upload one file');
    }
    let file = files[Object.keys(files)[0]];
    let userId = getUserIdFromToken(authorization);
    if (!userId) throw new Error('Could not find user');
    let { id } = req.params;
    if (String(parseInt(id, 10)) != id) throw new Error('id must be an integer');
    if (id <= 0) throw new Error('id must be positive and non-zero');
    let { text, values } = select().from('events', 'e')
    .where(
       and('id = ?', id)
      .and('host_user_id = ?', userId)
    ).toParam();
    let [ rows ] = await db.query(text, values);
    if (rows.length == 0) throw new Error('Access denied');
    //let [ extension ] = file.name.split('.').slice(-1);
    let extension = mime.extension(file.mimetype) || 'file';
    await db.transaction(async (t) => {
      let [{ insertId }] = await t.query('INSERT INTO files () VALUES ()');
      let { filename, stats: { size } } = await new Promise((res, rej) => {
        let filename = `${insertId}.${extension}`;
        let filenameFull = `${filesDir}/${filename}`;
        file.mv(filenameFull, (err) => {
          if (err) throw new Error(err);
          fs.stat(filenameFull, (err, stats) => {
            if (err) throw new Error(err);
            res({ filename, stats });
          });
        });
      });
      let p = update().table('files').setFields({ filename, sizeBytes: size })
      .where('id = ?', insertId).toParam();
      let p2 = update().table('events', 'e').setFields({
        initial_file: insertId
      }).where('id = ?', id).toParam();
      await Promise.all([
        await t.query(p.text, p.values),
        await t.query(p2.text, p2.values)
      ]);
    });
    res.send('File uploaded!');
  } catch (err) {
    res.send(err.message);
  }
};
