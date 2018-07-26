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
  publicRounds: [Round!]!
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
    Completed
  }
  type AdministeredEvent implements Event {
    ${baseDefinition}
    minGroupSize: Int!
    maxGroupSize: Int!
    minGroups: Int!
    maxGroups: Int!
    graceTime: Int!
    graceTimeMaxCount: Int!
    useGhosts: Boolean!
    initialFile: File
    allRounds: [Round!]!
    allParticipants: [User!]!
    invitedUsers: [User!]!
    participatedRounds: [Round!]!
  }
  type ParticipatedEvent implements Event {
    ${baseDefinition}
    participatedRounds: [Round!]!
  }
  type ObservedEvent implements Event {
    ${baseDefinition}
  }
`;
