let baseDefinition = `
  id: ID!
  round: Round!
  participant: User
  song: Song!
  file: File
`;

exports.schema = `
  interface Roundsubmission {
    ${baseDefinition}
  }
  type AdministeredRoundsubmission implements Roundsubmission {
    ${baseDefinition}
  }
  type ParticipatedRoundsubmission implements Roundsubmission {
    ${baseDefinition}
  }
  type ObservedRoundsubmission implements Roundsubmission {
    ${baseDefinition}
  }
`;
