
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
      return { ...fields, id: insertId };
    },

    updateEvent: async (_, args, ctx) => {
      let { userId, loaders, pubSub } = ctx;
      let { eventsById, eventsBySlug, usersById } = loaders;
      let { params } = args;
      let {
        id, name, description, areChangesVisible, isScheduleVisible, isPublic
      } = params;
      let event = await eventsById.load(id);
      if (!event) throw new Error ('Event not found');
      if (userId != event.host_user_id) {
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
      await db.query(text, values);
      let user = await usersById.load(userId);
      pubSub.publish('eventsChanged', { eventsChanged: [event] });
      pubSub.publish(`event${event.id}Changed`, {
        eventChanged: {
          event,
          message: `${user.username} has updated ${event.name}`
        }
      });
      return { code: 200, message: 'Event updated successfully' };
    },

    cancelEvent: async (_, args, ctx) => {
      let { userId, loaders, pubSub } = ctx;
      let { eventsById, usersById } = loaders;
      let { id } = args;
      let [ event, user ] = await Promise.all([
        eventsById.load(id), usersById.load(userId)
      ]);
      if (!event) throw new Error ('Event not found');
      if (userId != event.host_user_id) {
        throw new Error('You can only update your own events');
      }
      if (event.status != 'Planned') throw new Error('Event can\'t be cancelled if started.');
      let { text, values }
        = update().table('events').set('status = ?', 'Cancelled').where('id = ?', id).toParam();
      let result = await db.query(text, values);
      pubSub.publish('eventsChanged', { eventsChanged: [event] });
      pubSub.publish(`event${event.id}Changed`, {
        eventChanged: {
          event,
          message: `${user.username} has cancelled ${event.name}`
        }
      });
      return { code: 200, message: 'Event cancelled successfully' };
    },

    removeInitialEventFile: async (_, args, ctx) => {
      let { id } = args;
      let { userId, loaders, pubSub } = ctx;
      let { eventsById, usersById } = loaders;
      let [ event, user ] = await Promise.all([
        eventsById.load(id), usersById.load(userId)
      ]);
      if (!event) throw new Error ('Event not found');
      if (userId != event.host_user_id) {
        throw new Error('You can only update your own events');
      }
      if (event.status != 'Planned') throw new Error('Initial event file can\'t be removed if started.');
      let { text, values }
        = update().table('events').set('initial_file = ?', rstr('NULL')).where('id = ?', id).toParam();
      let result = await db.query(text, values);
      pubSub.publish('eventsChanged', { eventsChanged: [event] });
      pubSub.publish(`event${event.id}Changed`, {
        eventChanged: {
          event,
          message: `${user.username} has removed the initial file for ${event.name}`
        }
      });
      return { code: 200, message: 'Initial file was removed for event successfully' };
    },

    removeParticipantFromEvent: async (_, args, ctx) => {
      let { userId, loaders, pubSub } = ctx;
      let { eventsById, usersById } = loaders;
      let { params } = args;
      let { eventId } = params;
      let participantId = params.userId; // Can't destructure; userId is us!
      let [ host, participant, event, isParticipating ] = await Promise.all(
        usersById.load(userId),
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
      let message;
      if (userId == participantId) {
        message = `${participant.username} has left ${event.name}`;
      } else {
        message = `${participant.username} has been removed from ${event.name} by ${host.username}`;
      }
      pubSub.publish('eventsChanged', { eventsChanged: [event] });
      pubSub.publish(`event${event.id}Changed`, {
        eventChanged: {
          event,
          message
        }
      });
      return { code: 200, message: 'Participant removed successfully' };
    },

    leaveEvent: async (_, args, ctx) => {
      let { userId, loaders, pubSub } = ctx;
      let { eventsById,
        eventIsParticipatedByEventAndUser, usersById } = loaders;
      let { id } = args;
      let [ user, event, isParticipating ] = await Promise.all([
        usersById.load(userId),
        eventsById.load(id),
        eventIsParticipatedByEventAndUser.load([ id, userId ])
      ]);
      if (!event) throw new Error('Event does not exist.');
      //if (event.host_user_id == userId) throw new Error('You can\'t leave your own event');
      let param = select().field('rs.*')
        .from('roundsubmissions', 'rs')
        .join('rounds','r','rs.round_id = r.id')
        .where(
           and('rs.event_id = ?', id)
          .and('? IN (rs.participant, rs.fill_in_participant)', userId)
        )
        .toParam();
       let [ roundsubmissions ] = await db.query(param.text, param.values);
       if (roundsubmissions.length > 0) {
         throw new Error('You can\'t leave since you were part of the schedule');
       }
       param = _delete().from('event_participants')
         .where(
            and('event_id = ?', id)
           .and('user_id = ?', userId)
         ).toParam();
       let [{ affectedRows }] = await db.query(param.text, param.values);
       if (affectedRows > 0) {
         param = update().table('events').set('num_participants = num_participants - ?', affectedRows)
           .where('id = ?', id)
           .toParam();
       }
       await db.query(param.text, param.values);
       pubSub.publish('eventsChanged', { eventsChanged: [event] });
       pubSub.publish(`event${event.id}Changed`, {
         eventChanged: {
           event,
           message: `${user.username} has left ${event.name}`
         }
       });
       return { code: 200, message: "You have left the event" };
    },

    joinEvent: async (_, args, ctx) => {
      let { userId, loaders, pubSub } = ctx;
      let { eventsById,
        eventIsParticipatedByEventAndUser,
        eventWasInvitedByEventAndUser, usersById } = loaders;
      let { id } = args;
      let [ user, event, isParticipating, isInvited ] = await Promise.all([
        usersById.load(userId),
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
           for (let i = 0; i < roundsubmissions.length; i++) {
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
      pubSub.publish('eventsChanged', { eventsChanged: [event] });
      pubSub.publish(`event${event.id}Changed`, {
        eventChanged: {
          event,
          message: `${user.username} has joined ${event.name}`
        }
      });
      return { code: 200, message: 'You have joined the event successfully' };
    },

    inviteUser: async (_, args, ctx) => {
      let { userId, loaders, pubSub } = ctx;
      let { eventsById,
        eventIsParticipatedByEventAndUser,
        eventWasInvitedByEventAndUser, usersById } = loaders;
      let { params } = args;
      let { eventId } = params;
      let [ host, user, event, isParticipating, isInvited ] = await Promise.all([
        usersById.load(userId),
        usersById.load(params.userId),
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
      let data = { event_id: eventId, user_id: params.userId, created: squel.rstr('NOW()') };
      let { text, values }
        = insert().into('event_invitations').setFields(data).toParam();
      let result = await db.query(text, values);
      pubSub.publish('eventsChanged', { eventsChanged: [event] });
      pubSub.publish(`event${event.id}Changed`, {
        eventChanged: {
          event,
          message: `${host.username} has invited ${user.username} to join ${event.name}`
        }
      });
      return { code: 200, message: `You have invited the ${user.username} successfully` };
    },

    nextEventRound: async (_, args, ctx) => {
      let { userId, loaders, pubSub } = ctx;
      let { eventsById, roundsById } = loaders;
      let { id } = args;
      let event = await eventsById.load(id);
      let round = await roundsById.load(event.current_round);
      if (!event) throw new Error ('Event not found');
      if (userId != event.host_user_id) {
        throw new Error('Only the host can force next round');
      }
      switch (event.status) {
        case 'Planned':   throw new Error('Event must be started first');
        case 'Completed': case 'Published': throw new Error('Event is already complete');
      }
      await db.transaction(async (t) => { await handleRoundComplete(event, round, t); });
      let message;
      if ((round.index + 1) == event.num_rounds) {
        message = `${event.name} has completed it's last round`;
      } else {
        message = `${event.name} has now transitioned to round ${round.index + 2}`;
      }
      pubSub.publish('eventsChanged', { eventsChanged: [event] });
      pubSub.publish(`event${event.id}Changed`, {
        eventChanged: {
          event,
          message
        }
      });
      return { code: 200, message };
    },

    startEvent: async (_, args, ctx) => {
      let { userId, loaders, pubSub } = ctx;
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
      emailCurrentRoundParticipants(event, 0);
      pubSub.publish('eventsChanged', { eventsChanged: [event] });
      pubSub.publish(`event${event.id}Changed`, {
        eventChanged: {
          event,
          message: `${event.name} has been started`
        }
      });
      return { code: 200, message: 'Event was started successfully' };
    },

    publishEvent: async (_, args, ctx) => {
      let { userId, loaders, pubSub } = ctx;
      let { eventsById } = loaders;
      let { id } = args;
      let event = await eventsById.load(id);
      if (!event || (event && !event.is_public)) throw new Error ('Event not found');
      if (userId != event.host_user_id) {
        throw new Error('Only the host can publish an event');
      }
      if (event.status != 'Completed') {
        throw new Error('Only events with status Completed can be published');
      }
      await db.transaction(async (t) => {
        let { text, values } = update().table('events').setFields({status: 'Published'})
        .where('id = ?', id).toParam();
        await t.query(text, values);
      });
      emailEventWasPublished(event);
      pubSub.publish('eventsChanged', { eventsChanged: [event] });
      pubSub.publish(`event${event.id}Changed`, {
        eventChanged: {
          event,
          message: `${event.name} has been published`
        }
      });
      return { code: 200, message: 'Event was successfully published' };
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
      batch.push(
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
            return await t.query(text, values);
          })(songIdx, roundIdx)
        )
      );
    }
  }
  await Promise.all(batch);
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
        param = update().table('roundsubmissions')
          .setFields({ file_id_seeded: roundsubmissions[i].seedFile })
          .where('id = ?', roundsubmissions[i].id).toParam();
        batch.push(t.query(param.text, param.values));
        if (roundsubmissions[i].status == 'Planned') {
          param = update().table('roundsubmissions')
            .setFields({ status: 'Started' })
            .where('id = ?', roundsubmissions[i].id).toParam();
          batch.push(t.query(param.text, param.values));
        }
        if (roundsubmissions[i].status == 'FillInRequested') {
          await findFillIn(roundsubmissions[i]);
        }
        if (batch.length > 5) { // Just so we don't overload
          await Promise.all(batch);
          batch = [];
        }
      }
      await Promise.all(batch);
      emailCurrentRoundParticipants(event, round.index + 1);
  } else {
    // The whole event is done.
    param = update().table('events').setFields({
      status: 'Completed'
    }).set('current_round', rstr('NULL'))
    .where('id = ?', eventId).toParam();
    await t.query(param.text, param.values);
    emailEventWasCompleted(event);
  }
};

let emailCurrentRoundParticipants = async (event, roundIndex) => {
  let { text, values } = select().field('u.firstname').field('u.email')
  .from('roundsubmissions', 'rs')
  .join('events', 'e', 'rs.event_id = e.id')
  .join('users', 'u', 'COALESCE(rs.fill_in_participant, rs.participant) = u.id')
  .where(
     and('rs.event_id = ?', event.id)
    .and('e.current_round = rs.round_id')
  ).toParam();
  let [ rows ] = await db.query(text, values);
  let mailer = getMailer();
  let url =
    `${config.siteUrl}/events/${event.slug}`;
  await rows.reduce((ack, user) => {
    return ack.then(() => new Promise(res => {
      mailer.sendMail({
        from: 'swap@monsquaz.org',
        to: user.email,
        subject: `${event.name}: R${roundIndex + 1}${(roundIndex + 1) == event.num_rounds ? ' (FINAL)' : ''}`,
        text: `Hi ${user.firstname}!` + '\n' +
          `The ${roundIndex == 0 ? 'first' : ((roundIndex + 1) == event.num_rounds ? 'final' : 'next')} ` +
          `round of ${event.name} has now started` + '\n\n' +
          'Go to\n' +
          `${url}` + '\n\n' +
          'To see what\'s going on\n\n' +
          'Regards,\n' +
          'Monsquaz Swap'
      }, () => {
        setTimeout(() => { res(); }, 5000)
      })
    }));
  }, Promise.all([]));
};

let emailEventWasCompleted = async (event) => {
  let { text, values } = select().distinct().field('u.firstname').field('u.email')
  .from('roundsubmissions', 'rs')
  .join('events', 'e', 'rs.event_id = e.id')
  .join('users', 'u', 'COALESCE(rs.fill_in_participant, rs.participant) = u.id')
  .where(
     and('rs.event_id = ?', event.id)
  ).toParam();
  let [ rows ] = await db.query(text, values);
  let mailer = getMailer();
  await rows.reduce((ack, user) => {
    return ack.then(() => new Promise(res => {
      mailer.sendMail({
        from: 'swap@monsquaz.org',
        to: user.email,
        subject: `${event.name} was completed`,
        text: `Hi ${user.firstname}!` + '\n' +
          `The event has been completed` + '\n\n' +
          'Regards,\n' +
          'Monsquaz Swap'
      }, () => {
        setTimeout(() => { res(); }, 5000)
      })
    }));
  }, Promise.all([]));
};

let emailEventWasPublished = async (event) => {
  let { text, values } = select().distinct().field('u.firstname').field('u.email')
  .from('roundsubmissions', 'rs')
  .join('events', 'e', 'rs.event_id = e.id')
  .join('users', 'u', 'COALESCE(rs.fill_in_participant, rs.participant) = u.id')
  .where(
     and('rs.event_id = ?', event.id)
  ).toParam();
  let [ rows ] = await db.query(text, values);
  let mailer = getMailer();
  let url =
    `${config.siteUrl}/events/${event.slug}`;
  await rows.reduce((ack, user) => {
    return ack.then(() => new Promise(res => {
      mailer.sendMail({
        from: 'swap@monsquaz.org',
        to: user.email,
        subject: `${event.name} has been published`,
        text: `Hi ${user.firstname}!` + '\n' +
          `The event has been published - meaning, it is now possible to go through all edits and write comments to them.` + '\n\n' +
          'Go to\n' +
          `${url}` + '\n\n' +
          'To see what\'s going on\n\n' +
          'Regards,\n' +
          'Monsquaz Swap'
      }, () => {
        setTimeout(() => { res(); }, 5000)
      })
    }));
  }, Promise.all([]));
};

const stripHtml = t => t.replace(/<(?:.|\n)*?>/gm, '');

let validateFields = (data) => {
  return Object.keys(data).reduce((ack, k) => {
    let v = data[k];
    switch (k) {
      case 'name':
        if (v.length == 0) return [ ...ack, "Name must be set" ];
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
        return { ...ack, [k]: v.trim().replace(/<(?:.|\n)*?>/gm, '') };
      default:
        return ack;
    }
  }, { ...params });
  return res;
};
