import config from '../../../../config';
import squel from 'squel';
const and = (...args) => squel.expr().and(...args);
const or = (...args) => squel.expr().or(...args);
const { select, insert, update, rstr } = squel;
let _delete = squel.delete;
import db from '../../../../db';
import { findFillIn } from '../../../util';

exports.resolver = {
  Mutation: {
    refuteRoundsubmission: async (_, args, ctx) => {
      let { id } = args;
      let { userId, loaders, pubSub } = ctx;
      let { roundsubmissionsById, eventsById, usersById, roundsById } = loaders;
      let roundsubmission = await roundsubmissionsById.load(id);
      if (!roundsubmission) throw new Error('Roundsubmission not found');
      if (roundsubmission.status != 'Submitted') {
        throw new Error('You can only refute a submitted roundsubmission');
      }
      let event = await eventsById.load(roundsubmission.event_id);
      if (!event) throw new Error('Event not found');
      if (event.host_user_id != userId) {
        throw new Error('You are not an administrator')
      }
      let { text, values } = update().table('roundsubmissions')
        .setFields({status: 'Refuted'}).set('file_id_submitted = NULL')
        .where('id = ?', id).toParam();
      await db.query(text, values)
      let [ host, participant, round ] = await Promise.all([
        usersById.load(userId),
        usersById.load(roundsubmission.user_id),
        roundsById.load(roundsubmission.round_id)
      ]);
      pubSub.publish('eventsChanged', { eventsChanged: [event] });
      pubSub.publish(`event${event.id}Changed`, {
        eventChanged: {
          event,
          message: `${host.username} has refuted ${participant.username}'s submission for round ${round.index + 1} of ${event.name}'`
        }
      });
      return {
        code: 200,
        message: 'You have refuted the submission successfully'
      };
    },
    skipRoundsubmission: async (_, args, ctx) => {
      let { id } = args;
      let { userId, loaders, pubSub } = ctx;
      let { roundsubmissionsById, eventsById, usersById, roundsById } = loaders;
      let roundsubmission = await roundsubmissionsById.load(id);
      let event = await eventsById.load(roundsubmission.event_id);
      let participantId =
        roundsubmission.fill_in_participant ||
        roundsubmission.participant;
      if (userId != participantId &&
          userId != event.host_user_id) {
        throw new Error('Not allowed.')
      }
      await findFillIn(roundsubmission);
      let [ user, participant, round ] = await Promise.all([
        usersById.load(userId),
        usersById.load(roundsubmission.fill_in_participant || roundsubmission.participant),
        roundsById.load(roundsubmission.round_id)
      ]);
      pubSub.publish('eventsChanged', { eventsChanged: [event] });
      pubSub.publish(`event${event.id}Changed`, {
        eventChanged: {
          event,
          message: `${participant.username} has skipped round ${round.index + 1} of ${event.name}`
        }
      });
      return { code: 200, message: "Successfully skipped round" };
    }
  }
};
