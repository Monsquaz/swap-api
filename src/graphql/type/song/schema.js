exports.schema = `
  type Song {
    id: ID!
    roundSubmissions: [Roundsubmission!]!
    currentFile: File
  }
`;
