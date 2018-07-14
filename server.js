
import config from './config';
import db from './db';
import { GraphQLServer } from 'graphql-yoga'
import glue from 'schemaglue';
import { createLoaders } from './src/loaders';
import jwt from 'jsonwebtoken';

const { schema, resolver } = glue('src/graphql');

const server = new GraphQLServer({
  typeDefs: schema,
  resolvers: resolver,
  context: ({ request, response }) => {
    let { headers } = request;
    let { authorization } = headers;
    let userId = null;
    let loaders = createLoaders();
    if (authorization) {
      let [ authType, authToken, _ ] = authorization.split(' ');
      if (_ || authType !== 'Bearer') {
        throw new Error('Malformed authorization header');
      }
      userId = (jwt.verify(authToken, config.jwt.secret)).userId;
    }
    return { userId, loaders };
  }
});

server.start(() => console.log('Server is running on localhost:4000'));
