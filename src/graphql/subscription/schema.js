exports.subscription = `
  eventChanged(id: ID!): EventChange
  eventsChanged: [Event!]!
`;

exports.schema = `
  type EventChange {
    event: Event!
    message: String!
  }
`;
