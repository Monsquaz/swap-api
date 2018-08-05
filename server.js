import { GraphQLServer } from 'graphql-yoga'
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

process.chdir(__dirname);
const { schema, resolver } = glue(`src/graphql`);

const server = new GraphQLServer({
  typeDefs: schema,
  resolvers: resolver,
  context: ({ request, response }) => {
    let { headers } = request;
    let { authorization } = headers;
    let userId = null;
    let loaders = createLoaders();
    if (authorization) {
      userId = getUserIdFromToken(authorization);
    }
    return { userId, loaders };
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
server.express.post('/roundsubmissions/:id/file', uploadRoundsubmissionFile);
server.express.post('/events/:id/file', uploadEventFile);
