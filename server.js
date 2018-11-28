import { GraphQLServer, PubSub } from 'graphql-yoga'
import glue from 'schemaglue';
import { createLoaders } from './src/loaders';
import { getUserIdFromToken } from './src/util';
import {
  getFile,
  uploadRoundsubmissionFile,
  uploadEventFile
} from './src/services/files';
import fileUpload from 'express-fileupload';
import config from './config';
import fs from 'fs';

process.setMaxListeners(0); 

const pubSub = new PubSub();

process.chdir(__dirname);
const { schema, resolver } = glue(`src/graphql`);

const server = new GraphQLServer({
  typeDefs: schema,
  resolvers: resolver,
  context: (params) => {
    let { request } = params;
    let authorization = null;
    if (request) {
      let { headers } = request;
      authorization = headers.authorization;
    }
    let userId = null;
    let loaders = createLoaders();
    if (authorization) {
      userId = getUserIdFromToken(authorization);
    }
    return { userId, loaders, pubSub };
  }
});

server.start({
  deduplicator: true,
  https: {
    key: fs.readFileSync('./ssl/privkey.pem'),
    cert: fs.readFileSync('./ssl/fullchain.pem')
  }
},() => console.log('Server is running on localhost:4000'));

// Additional services
server.express.use(fileUpload({
  limits: { fileSize: 20 * 1024 * 1024 },
  safeFileNames: false,
  abortOnLimit: true
}));
server.express.get('/files/:id', getFile);
server.express.post('/roundsubmissions/:id/file', uploadRoundsubmissionFile(pubSub));
server.express.post('/events/:id/file', uploadEventFile(pubSub));
