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
      let { roundsubmissionsById, eventsById } = loaders;
      let roundsubmission = await roundsubmissionsById.load(roundsubmissionId);
      let event = await eventsById.load(roundsubmission.event_id);
      if (roundsubmission.participant != userIdArg &&
          roundsubmission.fill_in_participant != userIdArg) {
        if (event.host_user_id != userId) {
          throw new Error('You were not participating in this round');
        }
      }
      let param = select()
        .field('ep.user_id')
        .field(rstr('COUNT(fia.id)'), 'numFillins')
        .from('events', 'e')
        .join('event_participants', 'ep', 'e.id = ep.event_id')
        .join('roundsubmissions', 'rs', 'e.id = rs.event_id')
        .left_join('fill_in_attempts', 'fia', 'rs.id = fia.roundsubmission_id')
        .where(
           and('e.id = ?', event.id)
          .and('rs.id = ?', roundsubmission.id)
          .and('ep.user_id != ?', userIdArg)
          .and(
            'ep.user_id NOT IN ?',
            select().field('user_id').from('fill_in_attempts', 'fia2').where(
              'fia2.roundsubmission_id = ?', roundsubmission.id
            )
          )
          .and(
            'ep.user_id NOT IN ?',
            select().field('participant').from('roundsubmissions', 'rs2').where(
               and('participant IS NOT NULL')
              .and(
                or('rs.song_id = ?', roundsubmission.song_id)
               .or('rs.round_id = ?', roundsubmission.round_id)
              )
            )
          )
          .and(
            'ep.user_id NOT IN ?',
            select().field('fill_in_participant').from('roundsubmissions', 'rs3').where(
               and('fill_in_participant IS NOT NULL')
              .and(
                or('rs.song_id = ?', roundsubmission.song_id)
               .or('rs.round_id = ?', roundsubmission.round_id)
              )
            )
          )
        )
        .group('ep.user_id')
        .order('numFillins')
        .order('RAND()')
        .limit(1)
        .toParam();
      let [ rows ] = await db.query(param.text, param.values);
      let batch = [];
      let updateData = {};
      await db.transaction(async (t) => {
        if (rows.length > 0) {
          updateData = {
            status: 'FillInAquired',
            fill_in_participant: rows[0].user_id
          };
          param = insert().into('fill_in_attempts').setFields({
            roundsubmission_id: roundsubmission.id,
            user_id: rows[0].user_id,
            created: rstr('NOW()')
          }).toParam();
          batch.push(t.query(param.text, param.values));
        } else {
          updateData = {
            status: 'FillInRequested'
          };
        }
        let query = update().table('roundsubmissions', 'rs').setFields(updateData);
        if (rows.length == 0) query = query.set('fill_in_participant = NULL');
        param = query.where('id = ?', roundsubmissionId).toParam();
        batch.push(t.query(param.text, param.values));
        await Promise.all(batch);
      });
      return { code: 200, message: "Successfully skipped round" };
    }
  }
};
