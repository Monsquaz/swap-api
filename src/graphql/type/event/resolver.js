const squel = require("squel");
const { select, expr } = squel;
const and = (...args) => expr().and(...args);
const or  = (...args) => expr().or( ...args);
import { truncateWithEllipses } from '../../../util';

const baseResolvers = {
  id: ({ id }) => id,
  status: ({ status }) => status,
  created: ({ created }) => created,
  started: ({ started }) => started,
  completed: ({ completed }) => completed,
  name: ({ name }) => name,
  description: ({ description }, { maxLength }) => {
    if (maxLength) return truncateWithEllipses(description, maxLength);
    return description;
  },
  slug: ({ slug }) => slug,
  currentRound: async ({ current_round }, args, ctx) => {
    if (!current_round) return null;
    return await ctx.loaders.roundsById.load(current_round)
  },
  currentRoundsubmission: async ({ id }, args, ctx) => {
    // TODO: Make into a dataloader, in case we're querying multiple events
    let { userId, loaders } = ctx;
    let { sql, roundsubmissionsById } = loaders;
    let param = select().field('rs.id').from('roundsubmissions', 'rs')
      .join('events', 'e', 'rs.event_id = e.id')
      .where(
          and('e.id = ?', id)
         .and(
           or(
              and('rs.participant = ?', userId)
             .and('rs.fill_in_participant IS NULL')
           )
          .or('rs.fill_in_participant = ?', userId)
         )
         .and('rs.round_id = e.current_round')
      ).toParam();
    let rows = await sql.load(param);
    if (rows.length == 0) return null;
    return await roundsubmissionsById.load(rows[0].id);
  },
  roundsubmissions: async ({ id }, args, ctx) => {
    // TODO: Make into a dataloader, in case we're querying multiple events
    let { userId, loaders } = ctx;
    let { sql, roundsubmissionsById } = loaders;
    let param = select().field('rs.id').from('roundsubmissions', 'rs')
      .join('events', 'e', 'rs.event_id = e.id')
      .where(
          and('e.id = ?', id)
         .and(
           or(
              and('rs.participant = ?', userId)
             .and('rs.fill_in_participant IS NULL')
           )
          .or('rs.fill_in_participant = ?', userId)
          .or(
             and('e.is_public = 1')
            .and(
               or('e.is_schedule_visible = 1')
              .or('e.are_changes_visible = 1')
              .or('e.status = ?', 'Published')
            )
          )
          .or('e.host_user_id = ?', userId)
         )
      )
      .order('rs.round_id')
      .order('rs.song_id')
      .order('rs.id')
      .toParam();
    let rows = await sql.load(param);
    return await roundsubmissionsById.loadMany(rows.map(({ id }) => id));
  },
  numRounds: ({ num_rounds }) => num_rounds,
  numParticipants: ({ num_participants }) => num_participants,
  participants: async ({ id }, args, ctx ) => {
    return await ctx.loaders.participantsByEventId.load(id);
  },
  host: async ({ host_user_id }, args, ctx) => await ctx.loaders.usersById.load(host_user_id),
  areChangesVisible: ({ are_changes_visible }) => are_changes_visible,
  isScheduleVisible: ({ is_schedule_visible }) => is_schedule_visible,
  isPublic: ({ is_public }) => is_public,
  isParticipant: async ({id}, args, { userId, loaders }) => {
    if (!userId) return false;
    return await loaders.eventIsParticipatedByEventAndUser.load([ id, userId ]);
  },
  isAdministrator: async ({id}, args, { userId, loaders }) => {
    if (!userId) return false;
    return await loaders.eventIsAdministeredByEventAndUser.load([ id, userId ]);
  },
};

exports.resolver = {
  Event: {
    async __resolveType(event, ctx, info) {
      let { userId, loaders } = ctx;
      if (!userId) return 'ObservedEvent';
      let p1 = loaders.eventIsAdministeredByEventAndUser.load([event.id, userId]);
      let p2 = loaders.eventIsParticipatedByEventAndUser.load([event.id, userId]);
      let result = await new Promise((res) => {
        p1.then(r1 => { if (r1) res('AdministeredEvent'); });
        p2.then(async (r2) => {
          if (!(await p1)) res(r2 ? 'ParticipatedEvent' : 'ObservedEvent');
        });
      });
      return result;
    }
  },
  AdministeredEvent: {
    ...baseResolvers,
    initialFile: async ({ initial_file }, args, { userId, loaders }) => {
      if (!initial_file) return null;
      if (!userId) return null;
      return await loaders.filesById.load(initial_file);
    },
    invitedUsers: async (event, args, ctx) => {
      let { userId, loaders } = ctx;
      let { invitedUsersByEvent } = loaders;
      return await invitedUsersByEvent.load(event.id);
    }
  },
  ParticipatedEvent: { ...baseResolvers },
  ObservedEvent: { ...baseResolvers }
};
