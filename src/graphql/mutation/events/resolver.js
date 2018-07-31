
import validator from 'validator';
import strength from 'strength';
import nodemailer from 'nodemailer';
import config from '../../../../config';
import squel from 'squel';
import slugify from 'slugify';
const and = (...args) => squel.expr().and(...args);
const or = (...args) => squel.expr().or(...args);
import { getRandomLatinSquare } from 'jacobson-matthews-latin-square-js';
const { select, insert, update, rstr } = squel;
let _delete = squel.delete;
import db from '../../../../db';
import { getMailer, isCaptchaOK, findFillIn } from '../../../util';

exports.resolver = {
  Mutation: {

    createEvent: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { eventsBySlug } = loaders;
      let { params } = args;
      let {
        name, description, areChangesVisible, isScheduleVisible, isPublic, captchaResponse
      } = params;
      if (!(await isCaptchaOK(captchaResponse))) {
        throw new Error('Invalid captcha response');
      }
      let validationMessages = validateFields(params);
      if (validationMessages.length > 0) {
        throw new Error('Validation error: ' + validationMessages.join(', '));
      }
      let slug = slugify(name.toLowerCase());
      let event = await eventsBySlug.load(slug);
      if (event) throw new Error('Event name is not unique');
      let data = {
        name,
        description,
        created: squel.rstr('NOW()'),
        slug,
        host_user_id: userId,
        are_changes_visible: areChangesVisible,
        is_schedule_visible: isScheduleVisible,
        is_public: isPublic,
        num_participants: 0
      };
      let fields = { ...formatParameters(data) };
      let { text, values }
        = insert().into('events').setFields(fields).toParam();
      let [{ insertId }] = await db.query(text, values);
      return { code: 200, message: 'Event created successfully' }
    },

    updateEvent: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { eventsById, eventsBySlug } = loaders;
      let { params } = args;
      let {
        id, name, description, areChangesVisible, isScheduleVisible, isPublic
      } = params;
      let event = await eventsById.load(id);
      if (!event) throw new Error ('Event not found');
      if (userId !== event.host_user_id) {
        throw new Error('You can only update your own events');
      }
      let validationMessages = validateFields(params);
      if (validationMessages.length > 0) {
        throw new Error('Validation error: ' + validationMessages.join(', '));
      }
      let slug = slugify(name.toLowerCase());
      let eventBySlugCheck = await eventsBySlug.load(slug);
      if (eventBySlugCheck && eventBySlugCheck.id != event.id) {
        throw new Error('Event name is not unique');
      }
      let data = {
        name,
        description,
        slug,
        are_changes_visible: areChangesVisible,
        is_schedule_visible: isScheduleVisible,
        is_public: isPublic
      };
      let fields = { ...formatParameters(data) };
      let { text, values }
        = update().table('events').setFields(fields).where('id = ?', id).toParam();
      let result = await db.query(text, values);
      return { code: 200, message: 'Event updated successfully' };
    },

    removeParticipantFromEvent: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { eventsById, usersById } = loaders;
      let { params } = args;
      let { eventId } = params;
      let participantId = params.userId; // Can't destructure; userId is us!
      let [ participant, event, isParticipating ] = await Promise.all(
        usersById.load(participantId),
        eventsById.load(eventId),
        eventParticipationByEventAndUser.load([eventId, participantId])
      );
      if (!event) throw new Error ('Event not found');
      if (userId !== event.host_user_id && userId != participantId) {
        throw new Error(
          'You can only remove participants from your own events, or remove yourself.'
        );
      }
      if (!participant) throw Error('User does not exist');
      if (!isParticipating) throw Error('User is not participating in the event');
      switch (event.status) {
        case 'Planned': { // Remove from participants list
          await db.transaction(async (t) => {
            let data = { event_id: id, user_id: userId, created: squel.rstr('NOW()') };
            let param1 = _delete().from('event_participants').where(
               and('event_id = ?', eventId)
              .and('user_id = ?', participantId)
            );
            let param2 = insert().into('events').set('numParticipants = numParticipants - 1')
              .where('id = ?', id).toParam();
            await Promise.all([
              db.query(param1.text, param1.values),
              db.query(param2.text, param2.values),
            ]);
            return;
          });
          break;
        }
        case 'Started': {
          // TODO: Should it be allowed?
        }
        case 'Completed':
        case 'Published':
          throw new Error('Event already completed');
      }
      return { code: 200, message: 'Participant removed successfully' };
    },

    joinEvent: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { eventsById,
        eventIsParticipatedByEventAndUser,
        eventWasInvitedByEventAndUser } = loaders;
      let { id } = args;
      let [ event, isParticipating, isInvited ] = await Promise.all([
        eventsById.load(id),
        eventIsParticipatedByEventAndUser.load([ id, userId ]),
        eventWasInvitedByEventAndUser.load([ id, userId ])
      ]);
      if (!event) throw new Error('Event does not exist.');
      if (['Completed','Published'].includes(event.status)) {
        throw new Error('Event is already completed');
      }
      if (!event.is_public && !isInvited && event.host_user_id != userId) {
        throw new Error('Event does not exist.')
      }
      if (isParticipating) throw new Error('You are already participating in the event.');
      await db.transaction(async (t) => {
        let data = { event_id: id, user_id: userId, created: squel.rstr('NOW()') };
        let param1 = insert().into('event_participants').setFields(data).toParam();
        let param2 = update().table('events').set('num_participants = num_participants + 1')
          .where('id = ?', id).toParam();
        let p3 = (async () => {
          let param3 = select().field('rs.*')
            .from('roundsubmissions', 'rs')
            .join('rounds','r','rs.round_id = r.id')
            .where(
               and('rs.event_id = ?', id)
              .and('rs.status = ?', 'FillInRequested')
            )
            .order('r.`index`')
            .order('RAND()')
            .toParam();

           let [ roundsubmissions ] = await db.query(param3.text, param3.values);
           console.warn('ROUNDSUBMISSIONS', roundsubmissions);
           for (let i = 0; i < roundsubmissions.length; i++) {
             console.warn('--------- ATTEMPT TO FILL IN FOR', roundsubmissions[i].id)
             await findFillIn(roundsubmissions[i]);
           }

        })();
        await Promise.all([
          db.query(param1.text, param1.values),
          db.query(param2.text, param2.values),
          p3
        ]);
        return;
      });
      return { code: 200, message: 'You have joined the event successfully' };
    },

    inviteUser: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { eventsById,
        eventIsParticipatedByEventAndUser,
        eventWasInvitedByEventAndUser } = loaders;
      let { params } = args;
      let { id } = params;
      let [ event, isParticipating, isInvited ] = await Promise.all([
        eventsById.load(eventId),
        eventIsParticipatedByEventAndUser.load([ eventId, params.userId ]),
        eventWasInvitedByEventAndUser.load([ eventId, params.userId ])
      ]);
      if (!event) throw new Error ('Event not found');
      if (event.host_user_id != userId) {
        throw new Error('You can only invite users to your own events')
      }
      if (isParticipating) throw new Error('User is already participating')
      if (isInvited) throw new Error('User is already invited');
      let data = { event_id: id, user_id: userId, created: squel.rstr('NOW()') };
      let { text, values }
        = insert().into('event_invitations').setFields(data).toParam();
      let result = await db.query(text, values);
      return { code: 200, message: 'You have invited the user successfully' };
    },

    nextEventRound: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { eventsById, roundsById } = loaders;
      let { id } = args;
      let event = await eventsById.load(id);
      let round = await roundsById.load(event.current_round);
      if (!event || (event && !event.is_public)) throw new Error ('Event not found');
      if (userId != event.host_user_id) {
        throw new Error('Only the host can force next round');
      }
      switch (event.status) {
        case 'Planned':   throw new Error('Event must be started first');
        case 'Completed': case 'Published': throw new Error('Event is already complete');
      }
      await db.transaction(async (t) => { await handleRoundComplete(event, round, t); });
      return { code: 200, message: 'Event is now at round ' + event.current_round };
    },

    startEvent: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { eventsById } = loaders;
      let { id } = args;
      let event = await eventsById.load(id);
      if (!event || (event && !event.is_public)) throw new Error ('Event not found');
      if (userId != event.host_user_id) {
        throw new Error('Only the host can start an event');
      }
      if (event.status != 'Planned') {
        throw new Error('Event was already started');
      }
      if (event.num_participants <= 1) {
        throw new Error('There has to be more than one participant')
      }
      await db.transaction(async (t) => generateSchedule(event, t));
      return { code: 200, message: 'Event was started successfully' };
    },

    // TODO publishEvent
    endEvent: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { eventsById } = loaders;
      let { id } = args;
      let event = await eventsById.load(id);
      if (!event || (event && !event.is_public)) throw new Error ('Event not found');
      if (userId !== event.host_user_id) {
        throw new Error('Only the host can end an event');
      }
      switch (event.status) {
        case 'Planned':   throw new Error('Event has not even been started yet');
        case 'Completed': case 'Published': throw new Error('Event has already been ended');
      }
      return await db.transaction(async (t) => {
        let { text, values } = update().table('events').setFields({status: 'Completed'})
        .where('id = ?', id).toParam();
        await t.query(text, values);
      });
      return { code: 200, message: 'Event was successfully ended' };
    }
  }
};

let generateSchedule = async (event, t) => {
  let { id } = event;
  let batch = [];
  let param = select().field('user_id').from('event_participants').where(
    'event_id = ?', event.id
  ).toParam();
  let [ userRows ] = await t.query(param.text, param.values);
  let userIds = userRows.map(({ user_id }) => user_id);
  let [ songRows, roundRows ] = await Promise.all([
    Promise.all(userIds.map( (_, idx) => {
      let { text, values } = insert().into('songs').setFields({ event_id: id, '`index`': idx }).toParam();
      return t.query(text, values);
    })),
    Promise.all(userIds.map( (_, idx) => {
      let { text, values } = insert().into('rounds').setFields({ event_id: id, '`index`': idx }).toParam();
      return t.query(text, values);
    }))
  ]);
  let songIds = songRows.map(([{ insertId }]) => insertId);
  let roundIds = roundRows.map(([{ insertId }]) => insertId);
  param = update().table('events').setFields({
    num_rounds: userIds.length,
    status: 'Started',
    current_round: roundIds[0]
  }).where('id = ?', id).toParam();
  batch.push(t.query(param.text, param.values));
  let square = getRandomLatinSquare(userIds.length);
  let square2
    = Array(userIds.length).fill(null).map(r => Array(userIds.length).fill(null));
  for (let roundIdx = 0; roundIdx < roundIds.length; roundIdx++) {
    for (let songIdx = 0; songIdx < songIds.length; songIdx++) {
      let rsData = {
        event_id: event.id,
        song_id: songIds[songIdx],
        round_id: roundIds[roundIdx],
        participant: userIds[square[songIdx][roundIdx]],
        status: roundIdx == 0 ? 'Started' : 'Planned'
      };
      let q = insert().into('roundsubmissions').setFields({...rsData});
      if (roundIdx == 0) q = q.set('file_id_seeded', event.initial_file);
      param = q.toParam();
      let p = t.query(param.text, param.values);
      square2[songIdx][roundIdx] = p;
      batch.push(p);
      p.then(
        ((songIdx, roundIdx) => async ([{ insertId }]) => {
          let id = insertId;
          let updateData = {};
          let upBatch = [];
          if (roundIdx < (roundIds.length - 1)) {
            let up = square2[songIdx][roundIdx + 1];
            up.then(([{ insertId }]) => { updateData.next = insertId; })
            upBatch.push(up);
          }
          if (roundIdx > 0) {
            let up = square2[songIdx][roundIdx - 1];
            up.then(([{ insertId }]) => { updateData.previous = insertId; })
            upBatch.push(up);
          }
          await Promise.all(upBatch);
          let { text, values } =
            update().table('roundsubmissions').setFields({...updateData})
            .where('id = ?', id).toParam();
          batch.push(t.query(text, values));
        })(songIdx, roundIdx)
      )
    }
  }
  await Promise.all([...batch]);
  return true;
};

let handleRoundComplete = async (event, round, t) => {
  let eventId = event.id;
  let roundId = round.id;
  let param = select().field('id').from('rounds')
  .where(
     and('event_id = ?', eventId)
    .and('`index` = ?', parseInt(round.index,10) + 1)
  ).toParam();
  let [ rows ] = await t.query(param.text, param.values);
  let batch = [];
  if (rows.length > 0) {
    let eventUpdate = { current_round: rows[0].id };
    param = update().table('events').setFields(eventUpdate)
      .where('id = ?', eventId).toParam();
    batch.push(t.query(param.text, param.values));
  }
  batch.push((async () => {
    let param = select().field('rs.id').from('roundsubmissions', 'rs')
      .join('rounds', 'r', 'rs.round_id = r.id')
      .join('events', 'e', 'rs.event_id = e.id')
      .where(
         and('rs.status = ?', 'Submitted')
        .and('r.index = ?', round.index)
        .and('e.id = ?', eventId)
      ).toParam();
    let [ rows ] = await t.query(param.text, param.values);
    if (rows.length > 0) {
      let ids = rows.map(({id}) => id);
      param = update().table('roundsubmissions').set('status', 'Completed')
        .where('id IN ?', ids).toParam();
      await t.query(param.text, param.values);
    }
  })());
  batch.push((async () => {
    let param = select().field('rs.id').from('roundsubmissions', 'rs')
      .join('rounds', 'r', 'rs.round_id = r.id')
      .join('events', 'e', 'rs.event_id = e.id')
      .where(
         and('rs.status != ?', 'Submitted')
        .and('r.index = ?', round.index)
        .and('e.id = ?', eventId)
      ).toParam();
    let [ rows ] = await t.query(param.text, param.values);
    if (rows.length > 0) {
      let ids = rows.map(({id}) => id);
      param = update().table('roundsubmissions').set('status', 'Skipped')
        .where('id IN ?', ids).toParam();
      await t.query(param.text, param.values);
    }
  })());
  await Promise.all(batch);
  param = select()
    .field('rs.*')
    .field('COALESCE(prs.file_id_submitted, prs.file_id_seeded)', 'seedFile')
    .from('roundsubmissions', 'rs')
    .join('rounds', 'r', 'rs.round_id = r.id')
    .join('events', 'e', 'rs.event_id = e.id')
    .join('roundsubmissions', 'prs', 'rs.previous = prs.id')
    .where(
      and('r.index = ?', parseInt(round.index) + 1)
     .and('e.id = ?', eventId)
   ).toParam();
  let [ roundsubmissions ] = await t.query(param.text, param.values);
  if (roundsubmissions.length > 0) {
      let batch = [];
      for (let i = 0; i < roundsubmissions.length; i++) {
        switch (roundsubmissions[i].status) {
          case 'Planned': {
            param = update().table('roundsubmissions')
              .setFields({
                file_id_seeded: roundsubmissions[i].seedFile,
                status: 'Started'
              })
              .where('id = ?', roundsubmissions[i].id).toParam();
            batch.push(t.query(param.text, param.values));
            break;
          }
          case 'FillInRequested': {
            await findFillIn(roundsubmissions[i]);
            break;
          }
        }
        if (batch.length > 5) { // Just so we don't overload
          await Promise.all(batch);
          batch = [];
        }
      }
      await Promise.all(batch);
  } else {
    // The whole event is done.
    param = update().table('events').setFields({
      status: 'Completed'
    }).set('current_round', rstr('NULL'))
    .where('id = ?', eventId).toParam();
    await t.query(param.text, param.values);
  }
};

let validateFields = (data) => {
  return Object.keys(data).reduce((ack, k) => {
    let v = data[k];
    switch (k) {
      case 'name':
        if (!/^[A-Za-z\d ]+$/.test(v)) return [ ...ack, "Name must contain only alphanumerical characters or spaces" ];
        return ack;
      default:
        return ack;
    }
  }, [])
};

let formatParameters = (params) => {
  let res = Object.keys(params).reduce((ack, k) => {
    let v = params[k];
    switch (k) {
      case 'name':
      case 'slug':
      case 'description':
        return { ...ack, [k]: v.trim() };
      default:
        return ack;
    }
  }, { ...params });
  return res;
};
