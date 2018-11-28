exports.schema = ``;

exports.mutation = `
  skipRoundsubmission(id: ID!): StatusResponse!
  refuteRoundsubmission(id: ID!, reason: String!): StatusResponse!
`;
