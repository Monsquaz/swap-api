exports.schema = `
  input RoundSkip {
    roundsubmissionId: ID!
    userId: ID
  }
`;

exports.mutation = `
  skipRound(params: RoundSkip!): StatusResponse!
`;
