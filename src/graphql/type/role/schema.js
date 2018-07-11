let baseDefinition = `
  id: ID!
`;

exports.schema = `
  enum Role {
    Administrator,
    Participant,
    Auditor,
    Observer
  }
`;
