let baseDefinition = `
  id: ID!
  status: EventStatus!
  created: String!
  started: String!
  completed: String!
  name: String!
  description(maxLength: Int): String!
  slug: String!
  currentRound: Round
  roundsubmissions: [Roundsubmission!]!
  currentRoundsubmission: Roundsubmission
  numRounds: Int
  numParticipants: Int
  participants: [User!]!
  host: User
  areChangesVisible: Boolean!
  isScheduleVisible: Boolean!
  isPublic: Boolean!
  isParticipant: Boolean!
  isAdministrator: Boolean!
`;

exports.schema = `
  interface Event {
    ${baseDefinition}
  }
  enum EventStatus {
    Planned,
    Started,
    Completed,
    Published,
    Cancelled
  }
  type AdministeredEvent implements Event {
    ${baseDefinition}
    initialFile: File
    invitedUsers: [User!]!
  }
  type ParticipatedEvent implements Event {
    ${baseDefinition}
  }
  type ObservedEvent implements Event {
    ${baseDefinition}
  }
`;
