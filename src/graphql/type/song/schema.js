exports.schema = `
  type Song {
    id: ID!
    index: Int!
    roundSubmissions: [Roundsubmission!]!
    currentFile: File
  }
`;
