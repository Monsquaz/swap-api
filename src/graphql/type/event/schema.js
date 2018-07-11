let baseDefinition = `
  id: ID!
  currentRound: Round
  numRounds: Int!
  numParticipants: Int!
  publicParticipants: [User!]!
  host: User!
  publicRounds: [Round!]!
  areChangesVisible: Boolean!
  isScheduleVisible: Boolean!
  isPublic: Boolean!
`;

exports.schema = `
  interface Event {
    ${baseDefinition}
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
  }
  type ParticipatedEvent implements Event {
    ${baseDefinition}
    participatedRounds: [Round!]!
  }
  type ObservedEvent implements Event {
    ${baseDefinition}
  }
`;
