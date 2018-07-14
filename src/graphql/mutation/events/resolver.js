
import validator from 'validator';
import strength from 'strength';
import nodemailer from 'nodemailer';
import config from '../../../../config';
import squel from 'squel';
const { insert, update } = squel;
let _delete = squel.delete;
import db from '../../../../db';

exports.resolver = {
  Mutation: {

    createEvent: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { params } = args;
      let { name, areChangesVisible, isScheduleVisible, isPublic, captchaResponse }
        = params;
      let validationMessages = validateFields(params);
      if (validationMessages.length > 0) {
        throw new Error('Validation error: ' + validationMessages.join(', '));
      }
      let data = {
        name,
        are_changes_visible: areChangesVisible,
        is_schedule_visible: isScheduleVisible,
        is_public: isPublic
      };
      let { text, values }
        = insert().into('events').setFields(data).toParam();
      let [{ insertId }] = await db.query(text, values);
      return { code: 200, message: 'Event created successfully' }
    },

    updateEvent: async (_, args, ctx) => {
      let { userId, loaders } = ctx;
      let { eventsById } = loaders;
      let { params } = args;
      let { id, name, areChangesVisible, isScheduleVisible, isPublic } = params;
      let event = await eventsById.load(id);
      if (!event) throw new Error ('Event not found');
      if (userId !== event.host_uer_id) {
        throw new Error('You can only update your own events');
      }
      let validationMessages = validateFields(params);
      if (validationMessages.length > 0) {
        throw new Error('Validation error: ' + validationMessages.join(', '));
      }
      let fields = { ...formatParameters(params) };
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
      let participantId = params.userId;
      let [ participant, event, isParticipating ] = await Promise.all(
        usersById.load(participantId),
        eventsById.load(eventId),
        eventParticipationByEventAndUser.load([eventId, participantId])
      );
      if (!event) throw new Error ('Event not found');
      if (userId !== event.host_user_id) {
        throw new Error('You can only remove participants from your own events');
      }
      if (!participant) throw Error('User does not exist');
      if (!isParticipating) throw Error('User is not participating in the event');
      let { text, values }
        = _delete().from('event_participants').where(
           and('event_id = ?', eventId)
          .and('user_id = ?', participantId)
        )
      let result = await db.query(text, values);
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
      data = { event_id: id, user_id: userId };
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
      data = { event_id: id, user_id: userId };
      let { text, values }
        = insert().into('event_invitations').setFields(data);
      let result = await db.query(text, values);
      return { code: 200, message: 'You have invited the user successfully' };
    },

    forceNextEventRound: async (_, args, ctx) => {
      // TODO!!!
      /*
      let { userId, loaders } = ctx;
      let { eventsById } = loaders;
      let { params } = args;
      let { params } = args;
      let { id, name, areChangesVisible, isScheduleVisible, isPublic } = params;
      let event = await eventsById.load(id);
      if (!event) throw new Error ('Event not found');
      if (userId !== event.host_uer_id) {
        throw new Error('You can only force next round');
      }
      */
    }

    /*
    updateEvent(params: EventUpdate!): StatusResponse!
    removeParticipantFromEvent(user_id: ID!): StatusResponse!
    joinEvent(id: ID!): StatusResponse!
    inviteUser(params: EventInvitation!): StatusResponse!
    forceNextEventRound(id: ID!): StatusResponse!
    */

  }
};

let validateFields = (data) => {
  return Object.keys(data).reduce((ack, k) => {
    let v = data[k];
    switch (k) {
      case 'name':
        if (!validator.isAlpha(v)) return [ ...ack, "Name must be alphanumeric" ];
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
      case 'name':
        return { ...ack, [k]: v.trim() };
      default:
        return ack;
    }
  }, {});
  return res;
};
