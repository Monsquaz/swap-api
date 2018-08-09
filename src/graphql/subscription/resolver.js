exports.resolver = {
  Subscription: {
    eventChanged: {
      subscribe: (_, args, { pubSub }) => {
        let { id } = args;
        return pubSub.asyncIterator(`event${id}Changed`);
      }
    },
    eventsChanged: {
      subscribe: (_, args, { pubSub }) => {
        return pubSub.asyncIterator(`eventsChanged`);
      }
    }
  }
};
