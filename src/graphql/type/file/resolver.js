exports.resolver = {
  File: {
    id: ({ id }) => id,
    filename: ({ filename }) => filename.split(/[\\/]/).pop(),
    sizeBytes: ({ sizeBytes }) => sizeBytes || 0,
    sizeHuman: ({ sizeBytes }) => sizeBytes || '0',
    downloadUrl: ({ id }) => `/files/${id}`
  }
};
