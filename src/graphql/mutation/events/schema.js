exports.mutation = `
  createEvent(params: EventCreation!): StatusResponse!
  updateEvent(params: EventUpdate!): StatusResponse!
  removeParticipantFromEvent(user_id: ID!): StatusResponse!
  joinEvent(id: ID!): StatusResponse!
  inviteUser(params: EventInvitation!): StatusResponse!
  forceNextEventRound(id: ID!): StatusResponse!
`;

exports.schema = `
  input EventCreation {
    name: String!
    signupStart: String!
    signupEnd: String
    areChangesVisible: Boolean!
    isScheduleVisible: Boolean!
    isPublic: Boolean!
  }
  input EventUpdate {
    name: String
    signupStart: String
    signupEnd: String
    areChangesVisible: Boolean
    isScheduleVisible: Boolean
    isPublic: Boolean
  }
  input EventInvitation {
    id: ID!
    user_id: Int!
  }
`;
