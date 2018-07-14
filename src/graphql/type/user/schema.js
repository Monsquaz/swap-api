let baseDefinition = `
  id: ID!
  username: String!
`

exports.schema = `
  interface User {
    ${baseDefinition}
  }
  type AdministeredUser implements User {
    ${baseDefinition}
    firstname: String!
    lastname: String!
    email: String!
  }
  type OwnedUser implements User {
    ${baseDefinition}
    firstname: String!
    lastname: String!
    email: String!
  }
  type ObservedUser implements User {
    ${baseDefinition}
  }
`;
