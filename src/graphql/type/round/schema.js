let baseDefinition = `
  id: ID!
  index: Int!
  publicSubmissions: [RoundSubmissions!]!
`;

exports.schema = `
  interface Round {
    ${baseDefinition}
  }
  type AdministeredRound implements Round {
    ${baseDefinition}
    allSubmissions: [RoundSubmissions!]!
  }
  type ParticipatedRound implements Round {
    ${baseDefinition}
    mySubmission: RoundSubmission!
  }
  type ObservedRound implements Round {
    ${baseDefinition}
  }
`;
