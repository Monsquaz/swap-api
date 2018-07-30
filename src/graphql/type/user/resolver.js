import md5 from 'md5';

const resolvers = {
  gravatar: (user, args, ctx) => {
    let { email } = user;
    let { size } = args;
    let hash = md5(email.trim().toLowerCase());
    let url = `https://www.gravatar.com/avatar/${hash}`;
    if (size) return `${url}?s=${size}`;
    else return url;
  },
  participatedEvents: async (user, args, ctx) => {
    let { userId, loaders } = ctx;
    let { participatedEventsByUserIdAuthed } = loaders;
    // TODO: Create dataloader!
    return events;
  },
  hostedEvents: async (user, args, ctx) => {
    let { userId, loaders } = ctx;
    let { hostedEventsByUserIdAuthed } = loaders;
    // TODO: Create dataloader!
    return events;
  }
};

exports.resolver = {
  User: {
    async __resolveType(user, ctx) {
      let { userId, loaders } = ctx;
      if (String(user.id) === userId) return 'OwnedUser';
      // TODO: Administered user?
      return 'ObservedUser';
    }
  },
  ObservedUser: { ...resolvers },
  AdministeredUser: { ...resolvers },
  OwnedUser: { ...resolvers }
};
