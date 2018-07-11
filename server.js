
const config = require('./config').default;
import db from './db';
import { GraphQLServer } from 'graphql-yoga'
import glue from 'schemaglue';
import { createLoaders } from './src/loaders';

const { schema, resolver } = glue('src/graphql');

const server = new GraphQLServer({ typeDefs: schema, resolvers: resolver });

server.start(() => console.log('Server is running on localhost:4000'));
