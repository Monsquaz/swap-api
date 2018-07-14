exports.resolver = {
  User: {
    async __resolveType(user, ctx, info) {
      let { userId, loaders } = ctx;
      if (String(user.id) === userId) return 'OwnedUser';
      // TODO: Administered user?
      return 'ObservedUser';
    }
  }
};
