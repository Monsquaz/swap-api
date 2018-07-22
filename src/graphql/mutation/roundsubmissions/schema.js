exports.schema = `
  input RoundSkip {
    roundsubmissionId: Int!
    userId: Int
  }
`;

exports.mutation = `
  skipRound(params: RoundSkip!): StatusResponse!
`;
