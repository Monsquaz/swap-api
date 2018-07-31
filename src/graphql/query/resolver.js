const squel = require("squel");
const { select, expr } = squel;
const and = (...args) => expr().and(...args);
const or  = (...args) => expr().or( ...args);
import { performSelection, filterFns } from '../../util';

exports.resolver = {
  Query: {

    currentUser: async (_, __, { userId, loaders: { usersById } }) => {
      if (!userId) return null;
      return await usersById.load(userId);
    },

    events: async (_, { selection }, ctx ) => {
      let { userId, loaders } = ctx;
      let { sql, eventsById } = loaders;
      let query = select().field('e.id')
        .field(
          userId ? `SUM(IF(ep.user_id = ${parseInt(userId, 10)}, 1, 0))` : '0',
          'participation'
        )
        .from('events','e')
        .left_join('event_participants', 'ep', 'e.id = ep.event_id')
        .left_join('event_invitations', 'ei', 'e.id = ei.event_id')
        .where(
           or('e.is_public = 1')
          .or('ep.user_id = ?', userId)
          .or('ei.user_id = ?', userId)
          .or('e.host_user_id = ?', userId)
        )
        .group('e.id');
      if ('filters' in selection && selection.filters.isParticipating !== null) {
        let value = selection.filters.isParticipating;
        if (value === true) {
          if (!userId) query = query.where('1 = 0');
          else query = query.having('participation >= 1');
        } else if (value === false) {
          if (userId) query = query.having('participation = 0');
        }
      }
      query = performSelection({
        query,
        fieldAliases: {
          isPublic: 'e.is_public',
          hostUserId: 'e.host_user_id',
          participantUserId: 'ep.user_id',
          numParticipants: 'e.num_participants',
          numRounds: 'e.num_rounds',
          isScheduleVisible: 'e.is_schedule_visible',
          areChangesVisible: 'e.are_changes_visible'
        },
        customFilters: {
          isParticipating: (value, expr) => expr // Handled above
        },
        selection
      });
      let param = query.toParam();
      let rows = await sql.load(param);
      let res = await eventsById.loadMany(rows.map(({ id }) => id));
      return res;
    },

    files: async (_, { selection }, ctx ) => {
      let { userId, loaders } = ctx;
      let { sql, filesById } = loaders;
      let query = select().field('f.id').from('files', 'f')
        .left_join('roundsubmissions', 'rs', 'f.id = rs.file_id')
        .join('events', 'e', 'rs.event_id = e.id')
        .where(
           or('rs.participant = ?', userId)
          .or('rs.fill_in_participant = ?', userId)
          .or(
             and('e.is_public = 1')
            .and(
               or('e.are_changes_visible = 1')
              .or('e.status = ?', 'Published')
            )
          )
          .or('e.host_user_id = ?', userId)
        );
      query = performSelection({
        query,
        fieldAliases: {
          eventId: 'e.id'
        },
        selection
      });
      let param = query.toParam();
      let rows = await sql.load(param);
      return await filesById.loadMany(rows.map(({ id }) => id));
    },

    roundsubmissions: async (_, { selection }, ctx ) => {
      let { userId, loaders } = ctx;
      let { sql, roundsubmissionsById } = loaders;
      let query = select().field('rs.id').from('roundsubmissions', 'rs')
        .join('events', 'e', 'rs.event_id = e.id')
        .where(
           or(
              and('rs.participant = ?', userId)
             .and('rs.fill_in_participant IS NULL')
           )
          .or('rs.fill_in_participant = ?', userId)
          .or(
             and('e.is_public = 1')
            .and(
               or('e.are_changes_visible = 1')
              .or('e.status = ?', 'Published')
            )
          )
          .or('e.host_user_id = ?', userId)
        );
      query = performSelection({
        query,
        fieldAliases: {
          id: 'rs.id',
          eventId: 'e.id',
          roundId: 'rs.round_id',
          songId: 'rs.song_id'
        },
        selection
     });
      let param = query.toParam();
      let rows = await sql.load(param);
      return await roundsubmissionsById.loadMany(rows.map(({ id }) => id));
    },

    songs: async (_, { selection }, ctx ) => {
      let { userId, loaders } = ctx;
      let { sql, songsById } = loaders;
      let query = select().field('s.id').from('songs', 's')
        .join('events', 'e', 's.event_id = e.id')
        .left_join('roundsubmissions', 'rs', 'rs.event_id = e.id')
        .left_join('event_participants', 'ep', 'e.id = ep.event_id')
        .where(
           or('ep.user_id = ?', userId)
          .or('rs.fill_in_participant = ?', userId)
          .or(
             and('e.is_public = 1')
            .and(
               or('e.are_changes_visible = 1')
              .or('e.status = ?', 'Published')
            )
          )
          .or('e.host_user_id = ?', userId)
        );
      query = performSelection({
        query,
        fieldAliases: {
          eventId: 'e.id'
        },
        selection
      });
      let param = query.toParam();
      let rows = await sql.load(param);
      return await songsById.loadMany(rows.map(({ id }) => id));
    },

    users: async (_, { selection }, ctx ) => {
      let { userId, loaders } = ctx;
      let { sql, usersById } = loaders;
      let query = select().field('id').from('users');
      query = performSelection({ query, selection });
      let param = query.toParam();
      let rows = await sql.load(param);
      return await usersById.loadMany(rows.map(({ id }) => id));
    },

  }
};
