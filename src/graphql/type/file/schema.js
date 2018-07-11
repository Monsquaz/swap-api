exports.schema = `
  type File {
    id: ID!
    filename: String!
    sizeBytes: Int!
    sizeHuman: String!
    downloadUrl: String!
  }
`;
