import config from '../../../../config';
import squel from 'squel';
const and = (...args) => squel.expr().and(...args);
const or = (...args) => squel.expr().or(...args);
const { select, insert, update, rstr } = squel;
let _delete = squel.delete;
import db from '../../../../db';

exports.resolver = {
  Mutation: {
    skipRound: async (_, args, ctx) => {
      let { params } = args;
      let { roundsubmissionId } = params;
      let { userId, loaders } = ctx;
      let userIdArg = params.userId || userId;
      let { roundsubmissionsById, sql } = loaders;
      let roundsubmission = await roundsubmissionsById.load(roundsubmissionId);
      if (roundsubmission.participant != userIdArg) {
        let event = await eventsById.load(roundsubmission.event_id);
        if (event.host_user_id != userId) {
          throw new Error('You were not participating in this round');
        }
      }
      let param = select()
        .field('user_id')
        .from('event_participants', 'ep')
        .where(
           and('ep.user_id != ?', userId)
          .and(
            'ep.user_id NOT IN ?',
            select().field('participant').from('roundsubmissions', 'rs').where(
               and('rs.song_id = ?', roundsubmission.song_id)
              .and('rs.round_id = ?', roundsubmission.round_id)
            )
          )
          .and(
            'ep.user_id NOT IN ?',
            select().field('fill_in_participant').from('roundsubmissions', 'rs').where(
               and('rs.song_id = ?', roundsubmission.song_id)
              .and('rs.round_id = ?', roundsubmission.round_id)
            )
          )
        )
        .order('RAND()')
        .limit(1)
        .toParam();
      let [ rows ] = await db.query(param.text, param.values);
      let updateData = {};
      if (rows.length > 0) {
        updateData = {
          status: 'FillInAquired',
          fill_in_participant: rows[0].user_id
        };
      } else {
        updateData = {
          status: 'FillInRequested'
        };
      }
      param = update().table('roundsubmissions', 'rs').setFields(updateData)
        .where('id = ?', roundsubmissionId).toParam();
      await db.query(param.text, param.values);
      return { code: 200, message: "Successfully skipped round" };
    }
  }
};
