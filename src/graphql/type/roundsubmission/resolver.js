exports.resolver = {
  Roundsubmission: {
    async __resolveType(roundsubmission, ctx, info) {
      let { userId, loaders } = ctx;
      if (!userId) return 'ObservedRoundsubmission';;
      let isAdmin = loaders.eventIsAdministeredByEventAndUser.load([roundsubmission.event_id, userId]);
      if (isAdmin) return 'AdministeredRoundsubmission';
      if ([
        roundsubmission.participant,
        roundsubmission.fillin_participant
      ].includes(userId)) return 'ParticipatedRoundsubmission';
      return 'ObservedRoundsubmission';
    }
  }
};
