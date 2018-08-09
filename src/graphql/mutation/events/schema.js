exports.mutation = `
  createEvent(params: EventCreation!): Event!
  startEvent(id: ID!): StatusResponse!
  publishEvent(id: ID!): StatusResponse!
  updateEvent(params: EventUpdate!): StatusResponse!
  removeParticipantFromEvent(params: EventParticipantRemoval!): StatusResponse!
  joinEvent(id: ID!): StatusResponse!
  inviteUser(params: EventInvitation!): StatusResponse!
  nextEventRound(id: ID!): StatusResponse!
  leaveEvent(id: ID!): StatusResponse!
  cancelEvent(id: ID!): StatusResponse!
`;

exports.schema = `
  input EventCreation {
    name: String!
    description: String!
    areChangesVisible: Boolean!
    isScheduleVisible: Boolean!
    isPublic: Boolean!
    captchaResponse: String!
  }
  input EventUpdate {
    id: ID!
    name: String
    description: String
    areChangesVisible: Boolean
    isScheduleVisible: Boolean
    isPublic: Boolean
  }
  input EventInvitation {
    eventId: ID!
    userId: ID!
  }
  input EventParticipantRemoval {
    eventId: ID!
    userId: ID!
  }
`;
