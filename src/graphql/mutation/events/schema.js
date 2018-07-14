exports.mutation = `
  createEvent(params: EventCreation!): StatusResponse!
  updateEvent(params: EventUpdate!): StatusResponse!
  removeParticipantFromEvent(params: EventParticipantRemoval!): StatusResponse!
  joinEvent(id: ID!): StatusResponse!
  inviteUser(params: EventInvitation!): StatusResponse!
  forceNextEventRound(id: ID!): StatusResponse!
`;

exports.schema = `
  input EventCreation {
    name: String!
    areChangesVisible: Boolean!
    isScheduleVisible: Boolean!
    isPublic: Boolean!
    captchaResponse: String!
  }
  input EventUpdate {
    name: String
    areChangesVisible: Boolean
    isScheduleVisible: Boolean
    isPublic: Boolean
  }
  input EventInvitation {
    id: ID!
    userId: Int!
  }
  input EventParticipantRemoval {
    eventId: ID!
    userId: ID!
  }
`;
