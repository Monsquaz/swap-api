let baseDefinition = `
  id: ID!
  index: Int!
  publicSubmissions: [Roundsubmission!]!
`;

exports.schema = `
  interface Round {
    ${baseDefinition}
  }
  type AdministeredRound implements Round {
    ${baseDefinition}
    allSubmissions: [Roundsubmission!]!
  }
  type ParticipatedRound implements Round {
    ${baseDefinition}
    mySubmission: Roundsubmission!
  }
  type ObservedRound implements Round {
    ${baseDefinition}
  }
`;
