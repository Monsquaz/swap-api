let baseDefinition = `
  id: ID!
  slug: String!
  username: String!
  gravatar(size: Int): String!
  participatedEvents: [Event!]!
  hostedEvents: [Event!]!
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
