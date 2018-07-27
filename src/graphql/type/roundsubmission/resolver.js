let resolvers = {
  id: ({id}) => id,
  status: ({ status }) => status,
  round: async ({ round_id }, args, ctx) => {
    let { userId, loaders } = ctx;
    let { roundsById } = loaders;
    if (!round_id) return null;
    return await roundsById.load(round_id);
  },
  participant: async (parent, args, ctx) => {
    let { participant, fill_in_participant, status } = parent;
    let { userId, loaders } = ctx;
    let { usersById } = loaders;
    if (!participant) return null;
    return await usersById.load(
      status == 'FillInRequested' ?
        participant :
        fill_in_participant || participant
    );
  },
  originalParticipant: async ({ participant }, args, ctx) => {
    let { userId, loaders } = ctx;
    let { usersById } = loaders;
    if (!participant) return null;
    return await usersById.load(participant);
  },
  song: async ({ song_id }, args, ctx) => {
    let { userId, loaders } = ctx;
    let { songsById } = loaders;
    if (!song_id) return null;
    return await songsById.load(song_id);
  },
  fileSeeded: async ({ file_id_seeded }, args, ctx) => {
    let { userId, loaders } = ctx;
    let { filesById } = loaders;
    if (!file_id_seeded) return null;
    return await filesById.load(file_id_seeded);
  },
  fileSubmitted: async ({ file_id_submitted }, args, ctx) => {
    let { userId, loaders } = ctx;
    let { filesById } = loaders;
    if (!file_id_submitted) return null;
    return await filesById.load(file_id_submitted);
  },
  event: async ({ event_id }, args, ctx) => {
    let { userId, loaders } = ctx;
    let { eventsById } = loaders;
    if (!event) return null;
    return await eventsById.load(event_id);
  },
};

exports.resolver = {
  Roundsubmission: {
    async __resolveType(roundsubmission, ctx, info) {
      let { userId, loaders } = ctx;
      if (!userId) return 'ObservedRoundsubmission';
      let isAdmin = loaders.eventIsAdministeredByEventAndUser.load([roundsubmission.event_id, userId]);
      if (isAdmin) return 'AdministeredRoundsubmission';
      if ([
        roundsubmission.participant,
        roundsubmission.fillin_participant
      ].includes(userId)) return 'ParticipatedRoundsubmission';
      return 'ObservedRoundsubmission';
    }
  },
  ObservedRoundsubmission: { ...resolvers },
  AdministeredRoundsubmission: { ...resolvers },
  ParticipatedRoundsubmission: { ...resolvers }
};
