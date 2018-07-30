import config from '../../../../config';
import squel from 'squel';
const and = (...args) => squel.expr().and(...args);
const or = (...args) => squel.expr().or(...args);
const { select, insert, update, rstr } = squel;
let _delete = squel.delete;
import db from '../../../../db';

exports.resolver = {
  Mutation: {
    refuteRoundsubmission: async (_, args, ctx) => {
      let { id } = args;
      let { userId, loaders } = ctx;
      let { roundsubmissionsById, eventsById } = loaders;
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
      await db.query(text, values);
      return {
        code: 200,
        message: 'You have refuted the submission successfully'
      };
    },
    skipRoundsubmission: async (_, args, ctx) => {
      let { id } = args;
      let { userId, loaders } = ctx;
      let { roundsubmissionsById, eventsById } = loaders;
      let roundsubmission = await roundsubmissionsById.load(id);
      let event = await eventsById.load(roundsubmission.event_id);
      let participant =
        roundsubmission.fill_in_participant ||
        roundsubmission.participant;
      if (userId != participant &&
          userId != event.host_user_id) {
        throw new Error('Not allowed.')
      }
      let param = select()
        .field('ep.user_id')
        .field(rstr('COUNT(fia.id)'), 'numFillins')
        .from('events', 'e')
        .join('event_participants', 'ep', 'e.id = ep.event_id')
        .join('roundsubmissions', 'rs', 'e.id = rs.event_id')
        .left_join('fill_in_attempts', 'fia', 'rs.id = fia.roundsubmission_id')
        .where(
           and('e.id = ?', roundsubmission.event_id)
          .and('rs.id = ?', roundsubmission.id)
          .and('ep.user_id != ?', roundsubmission.fill_in_participant ||
                                  roundsubmission.participant)
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
                or('rs2.song_id = ?', roundsubmission.song_id)
               .or('rs2.round_id = ?', roundsubmission.round_id)
              )
            )
          )
          .and(
            'ep.user_id NOT IN ?',
            select().field('fill_in_participant').from('roundsubmissions', 'rs3').where(
               and('fill_in_participant IS NOT NULL')
              .and(
                or('rs3.song_id = ?', roundsubmission.song_id)
               .or('rs3.round_id = ?', roundsubmission.round_id)
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
        param = query.where('id = ?', roundsubmission.id).toParam();
        batch.push(t.query(param.text, param.values));
        await Promise.all(batch);
      });
      return { code: 200, message: "Successfully skipped round" };
    }
  }
};
