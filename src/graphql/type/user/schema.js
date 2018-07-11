let baseDefinition = `
  id: ID!
  username: String!
`

exports.schema = `
  interface User {
    ${baseDefinition}
  }
  type AdministeredUser {
    ${baseDefinition}
    firstname: String!
    lastname: String!
    email: String!
  }
  type OwnedUser {
    ${baseDefinition}
    firstname: String!
    lastname: String!
    email: String!
  }
  type ObservedUser {
    ${baseDefinition}
  }
`;
