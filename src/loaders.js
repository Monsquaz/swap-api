import DataLoader from 'dataloader';

// TODO: Get all exported functions withon dataloaders folder into batchFunctions variable.

let options = { maxBatchSize: 500 }

let createLoadersFromBatchFunctions = (batchFunctions) => {
  return Object.keys(batchFunctions).reduce(
    (ack, e) => ({...ack, [e]: new DataLoader(ids => batchFunctions[e](ids), options)}), {}
  );
}

exports.createLoaders = () => ({
  ...createLoadersFromBatchFunctions({
    // TODO functions!
  })
});
