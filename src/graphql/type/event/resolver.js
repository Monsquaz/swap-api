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
  }
};
