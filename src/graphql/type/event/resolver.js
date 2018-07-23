import { truncateWithEllipses } from '../../../util';

const baseResolvers = {
  id: ({ id }) => id,
  status: ({ status }) => status,
  created: ({ created }) => created,
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
  numRounds: ({ num_rounds }) => num_rounds,
  numParticipants: ({ num_participants }) => num_participants,
  publicParticipants: () => { return []; }, // TODO
  host: async ({ host_user_id }, args, ctx) => await ctx.loaders.usersById.load(host_user_id),
  publicRounds: () => null, // TODO
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
  AdministeredEvent: { ...baseResolvers },
  ParticipatedEvent: { ...baseResolvers },
  ObservedEvent: { ...baseResolvers }
};
