exports.resolver = {
  Round: {
    async __resolveType(round, ctx, info) {
      let { userId, loaders } = ctx;
      if (!userId) return 'ObservedRound';
      let p1 = loaders.eventIsAdministeredByEventAndUser.load([round.event_id, userId]);
      let p2 = loaders.roundParticipationByRoundAndUser.load([round.id, userId]);
      let result = await new Promise((res) => {
        p1.then(r1 => { if (r1) res('AdministeredRound'); });
        p2.then(async (r2) => {
          if (!(await p1)) res(r2 ? 'ParticipatedRound' : 'ObservedRound');
        });
      });
      return result;
    }
  }
};
