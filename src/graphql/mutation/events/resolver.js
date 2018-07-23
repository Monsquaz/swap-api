
import validator from 'validator';
import strength from 'strength';
import nodemailer from 'nodemailer';
import config from '../../../../config';
import squel from 'squel';
import slugify from 'slugify';
const and = (...args) => squel.expr().and(...args);
const or = (...args) => squel.expr().or(...args);
import { getRandomLatinSquare } from 'jacobson-matthews-latin-square-js';
const { insert, update } = squel;
let _delete = squel.delete;
import db from '../../../../db';
import { getMailer, isCaptchaOK } from '../../../util';

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
        is_public: isPublic
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
          let { text, values }
            = _delete().from('event_participants').where(
               and('event_id = ?', eventId)
              .and('user_id = ?', participantId)
            )
          let result = await db.query(text, values);
          break;
        }
        case 'Started': {
          // TODO
        }
        case 'Completed': throw new Error('Event already completed');
      }
      return { code: 200, message: 'Participant removed successfully' };
    },

    joinEvent: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { eventsById } = loaders;
      let { params } = args;
      let { id } = params;
      let [ event, isParticipating, isInvited ] = await Promise.all(
        eventsById.load(eventId),
        eventParticipationByEventAndUser.load([ eventId, userId ]),
        eventInvitationByEventAndUser.load([ eventId, userId ])
      );
      if (!event) throw new Error('Event does not exist.');
      if (!event.is_public && !isInvited && event.host_user_id != userId) {
        throw new Error('Event does not exist.')
      }
      if (isParticipating) throw new Error('You are already participating in the event.');
      let data = { event_id: id, user_id: userId };
      let { text, values }
        = insert().into('event_participants').setFields(data);
      let result = await db.query(text, values);
      return { code: 200, message: 'You have joined the event successfully' };
    },

    inviteUser: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { eventsById } = loaders;
      let { params } = args;
      let { id } = params;
      let [ event, isParticipating, isInvited ] = await Promise.all(
        eventsById.load(eventId),
        eventParticipationByEventAndUser.load([ eventId, params.userId ]),
        eventInvitationByEventAndUser.load([ eventId, params.userId ])
      );
      if (!event) throw new Error ('Event not found');
      if (event.host_user_id != userId) {
        throw new Error('You can only invite users to your own events')
      }
      if (isParticipating) throw new Error('User is already participating')
      if (isInvited) throw new Error('User is already invited');
      let data = { event_id: id, user_id: userId };
      let { text, values }
        = insert().into('event_invitations').setFields(data);
      let result = await db.query(text, values);
      return { code: 200, message: 'You have invited the user successfully' };
    },

    nextEventRound: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { eventsById } = loaders;
      let { params } = args;
      let { id } = params;
      let event = await eventsById.load(id);
      if (!event || (event && !event.is_public)) throw new Error ('Event not found');
      if (userId !== event.host_user_id) {
        throw new Error('Only the host can force next round');
      }
      switch (event.status) {
        case 'Planned':   throw new Error('Event must be started first');
        case 'Completed': throw new Error('Event is already complete');
      }
      if (event.current_round >= event.num_rounds) {
        throw new Error('There are no more rounds');
      }
      await db.transaction(async (t) => { await handleRoundComplete(event, t); });
      return { code: 200, message: 'Event is now at round ' + event.current_round };
    },

    startEvent: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { eventsById } = loaders;
      let { params } = args;
      let { id } = params;
      let event = await eventsById.load(id);
      if (!event || (event && !event.is_public)) throw new Error ('Event not found');
      if (userId !== event.host_user_id) {
        throw new Error('Only the host can start an event');
      }
      if (event.status != 'Planned') {
        throw new Error('Event was already started');
      }
      await db.transaction(async (t) => generateSchedule(event, t));
      return { code: 200, message: 'Event was started successfully' };
    },

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
        case 'Completed': throw new Error('Event has already been ended');
      }
      return await db.transaction(async (t) => {
        let { text, values } = update().table('events').setFields({status: 'Completed'})
        .where('id = ?', id).toParam();
        await Promise.all([
          generateSchedule(event, t),
          t.query(text, values)
        ]);
      });
      return { code: 200, message: 'Event was successfully ended' };
    }
  }
};

let generateSchedule = async (event, t) => {
  let { id } = event;
  let batch = [];
  param = select().field('user_id').from('event_participants').where(
    'event_id = ?', event.id
  ).toParam();
  let [ users ] = await t.query(param);
  let userIds = users.map(user => user.id);
  let [ songIds, roundIds ] = await Promise.all([
    Promise.all(userIds.map(_ => {
      let { text, values } = insert().into('songs').toParam();
      return t.query(text, values);
    })),
    Promise.all(userIds.map(_ => {
      let { text, values } = insert().into('rounds').toParam();
      return t.query(text, values);
    }))
  ]);
  let square = getRandomLatinSquare(users.length);
  let square2
    = Array(users.length).fill(null).map(r => Array(users.length).fill(null));
  for (let roundIdx = 0; roundIdx < roundIds.length; roundIdx++) {
    for (let songIdx = 0; songIdx < songIds.length; songIdx++) {
      let rsData = {
        event_id: event.id,
        song_id: songIds[songIdx],
        round_id: roundId[roundIdx],
        participant: square[songIdx][roundIdx]
      };
      param = insert().into('roundsubmissions').setFields(rsData).toParam();
      let p = t.query(param.text, param.values);
      square2[songIdx][roundIdx] = p;
      batch.push(p);
      p.then(
        ((songIdx, roundIdx) => async ([{ insertId}]) => {
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
            update().table('roundsubmissions').setFields(updateData).toParam();
          batch.push(t.query(param.text, param.values));
        })(songIdx, roundIdx)
      )
    }
  }
  await Promise.all(batch);
  return true;
};

let handleRoundComplete = async (event, t) => {
  let { id, current_round } = event;
  let eventUpdate = { current_round: current_round + 1 };
  let batch = [];
  let param
    = update().table('events').setFields(eventUpdate)
    .where('id = ?', id).toParam();
  batch.push(t.query(param.text, param.values));
  param = update().table('roundsubmissions', 'rs')
    .join('rounds', 'r', 'rs.round_id = r.id')
    .join('events', 'e', 'rs.event_id = e.id').setFields({
      'rs.status': 'Completed'
    }).where(
       and('rs.status = ?', 'Submitted')
      .and('r.index = ?', current_round)
      .and('e.id = ?', id)
    );
  batch.push(t.query(param.text, param.values));
  param = update().table('roundsubmissions', 'rs')
    .join('rounds', 'r', 'rs.round_id = r.id')
    .join('events', 'e', 'rs.event_id = e.id').setFields({
      'rs.status': 'Skipped'
    }).where(
      and('rs.status = ?', 'Submitted')
     .and('r.index = ?', current_round)
     .and('e.id = ?', id)
    );
  batch.push(t.query(param.text, param.values));
  param = update().table('roundsubmission', 'rs')
  .join('rounds', 'r', 'rs.round_id = r.id')
  .join('events', 'e', 'rs.event_id = e.id')
  .join('roundsubmissions', 'prs', 'rs.previous = prs.id')
  .set('file_id_seeded = COALESCE(prs.file_id_submitted, prs.file_id_seeded)')
  .where(
    and('r.index = ?', current_round + 1)
   .and('rs.status = ?', 'Submitted')
   .and('e.id = ?', id)
  );
  batch.push(t.query(param.text, param.values));
  await batch;
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
