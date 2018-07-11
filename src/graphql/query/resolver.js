const squel = require("squel");
import { performSelection, filterFns } from '../../util';

exports.resolver = {
  Query: {

    events: async (_, { selection }, ctx ) => {
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
