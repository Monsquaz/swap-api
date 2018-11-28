import DataLoader from 'dataloader';
import fs from 'fs';
import path from 'path';

const options = { maxBatchSize: 500 }

const createLoadersFromBatchFunctions = (batchFunctions) => {
  return Object.keys(batchFunctions).reduce(
    (ack, e) => ({
      ...ack, [e]: new DataLoader(ids => batchFunctions[e](ids), options)
    }), {}
  );
}

const getAllJsFiles = dir =>
  fs.readdirSync(dir).reduce((files, file) => {
    if (file.indexOf('.js') === -1) return files;
    const name = path.join(dir, file);
    const isDirectory = fs.statSync(name).isDirectory();
    return isDirectory ? [...files, ...getAllFiles(name)] : [...files, name];
  }, []);

let batchFunctions = getAllJsFiles(`${__dirname}/dataloaders`)
  .reduce((ack, filename) => ({ ...ack, ...require(filename) }), {});

exports.createLoaders = () => ({
  ...createLoadersFromBatchFunctions(
    batchFunctions
  )
});
