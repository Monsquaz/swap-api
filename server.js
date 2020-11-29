const { GraphQLServer, PubSub } = require('graphql-yoga');
const glue = require('schemaglue');
const { createLoaders } = require('./src/loaders');
const { getUserIdFromToken } = require('./src/util');
const {
  getFile,
  uploadRoundsubmissionFile,
  uploadEventFile 
} = require('./src/services/files');
const fileUpload = require('express-fileupload');
const config = require('./config');
const fs = require('fs');
const axios = require('axios');

process.setMaxListeners(0);

const pubSub = new PubSub();

pubSub.subscribe('event54Changed', (data) => {
  if (!data.eventChanged) { return; }
  if (typeof data.eventChanged !== 'object') { return; }
  if (!data.eventChanged.message) { return; }
  axios.post(
    `https://discord.com/api/webhooks/709808826542588025/gyawODfzcfeUzI8Go3I2bjmI2Imd4fXcm04bhR-7fQopIbZs2HBIcoDKRJcpaOGJV7Z8`, {
      content: data.eventChanged.message
    }
  );
});

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
