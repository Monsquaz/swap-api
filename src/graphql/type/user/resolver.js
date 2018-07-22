import md5 from 'md5';

exports.resolver = {
  User: {
    async __resolveType(user, ctx) {
      let { userId, loaders } = ctx;
      if (String(user.id) === userId) return 'OwnedUser';
      // TODO: Administered user?
      return 'ObservedUser';
    },
    gravatar: (user, args, ctx) => {
      let { email } = user;
      let { size } = args;
      let hash = md5(email.trim().toLowerCase());
      let url = `https://www.gravatar.com/avatar/${hash}`;
      if (size) return `${url}?s=${size}`;
      else return url;
    }
  }
};
