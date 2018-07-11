const squel = require("squel");
import { performSelection, filterFns } from '../../util';

exports.resolver = {
  Query: {

    events: async (_, { selection }, ctx ) => {
      /* TODO: We can list events that
        1. are public.
        2. we are participants of.
        3. we are administrators of */
      let { userId, loaders } = ctx;
      let query = squel.select(); // TODO: complete
      query = performSelection({
        query, selection,
        fieldAliases: {},
        customFilters: {}
      });
      let param = query.toParam();
      let rows = await loaders.sql.load(param);
      return await loaders.eventsById.loadMany(rows.map( ({id}) => id));
    },

    files: async (_, { selection }, ctx ) => {
      /* TODO: We can list files that
        belong to roundsubmissions that we can view (for whatever reason) */
      let { userId, loaders } = ctx;
      let query = squel.select(); // TODO: complete
      query = performSelection({
        query, selection,
        fieldAliases: {},
        customFilters: {}
      });
      let param = query.toParam();
      let rows = await loaders.sql.load(param);
      return await loaders.filesById.loadMany(rows.map( ({id}) => id));
    },

    roundsubmissions: async (_, { selection }, ctx ) => {
      /* TODO: We can list roundsubmissions that
      1. belong to events that we administer
      2. we participat in
      3. are fill-ins for
      4. where the event changes are public
      5. event is public and finnished */
      let { userId, loaders } = ctx;
      let query = squel.select(); // TODO: complete
      query = performSelection({
        query, selection,
        fieldAliases: {},
        customFilters: {}
      });
      let param = query.toParam();
      let rows = await loaders.sql.load(param);
      return await loaders.roundsubmissionsById.loadMany(rows.map( ({id}) => id));
    },

    songs: async (_, { selection }, ctx ) => {
      /* TODO: We can list songs that
      1. belong to events that we administer
      2. that belong to events that we are participating in
      3. that belong to events that we are fill in for (only the songs we filled in for!)
      4. belong to events with visible changes
      5. events that are public and finnished */
      let { userId, loaders } = ctx;
      let query = squel.select(); // TODO: complete
      query = performSelection({
        query, selection,
        fieldAliases: {},
        customFilters: {}
      });
      let param = query.toParam();
      let rows = await loaders.sql.load(param);
      return await loaders.songsById.loadMany(rows.map( ({id}) => id));
    },

    users: async (_, { selection }, ctx ) => {
      /* TODO: We can list all users */
      let { userId, loaders } = ctx;
      let query = squel.select(); // TODO: complete
      query = performSelection({
        query, selection,
        fieldAliases: {},
        customFilters: {}
      });
      let param = query.toParam();
      let rows = await loaders.sql.load(param);
      return await loaders.usersById.loadMany(rows.map( ({id}) => id));
    },

  }
};
