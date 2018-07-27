let baseDefinition = `
  id: ID!
  index: Int!
`;

exports.schema = `
  interface Round {
    ${baseDefinition}
  }
  type AdministeredRound implements Round {
    ${baseDefinition}
  }
  type ParticipatedRound implements Round {
    ${baseDefinition}
  }
  type ObservedRound implements Round {
    ${baseDefinition}
  }
`;
