let baseDefinition = `
  id: ID!
  status: RoundSubmissionStatus!
  round: Round!
  participant: User
  originalParticipant: User
  song: Song!
  fileSeeded: File
  fileSubmitted: File
  event: Event!
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
    uploadUrl: String!
  }
  type ObservedRoundsubmission implements Roundsubmission {
    ${baseDefinition}
  }
  enum RoundSubmissionStatus {
    Planned,
    Started,
    FillInRequested,
    FillInAquired,
    Submitted,
    Refuted,
    Completed,
    Skipped
  }
`;
