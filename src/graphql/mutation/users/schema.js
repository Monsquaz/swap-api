exports.mutation = `
  createUser(params: UserCreation!): StatusResponse!
  updateUser(params: UserUpdate!): StatusResponse!
  deleteUser(id: ID!): StatusResponse!
  verifyUser(params: UserVerification!): StatusResponse!
  loginUser(params: LoginCredentials!): LoginResponse!
  requestPasswordReset(usernameOrEmail: String!): StatusResponse!
  updateUserPassword(params: UserPasswordUpdate!): StatusResponse!
`;

exports.schema = `
  input UserCreation {
    email: String!
    username: String!
    password: String!
    firstname: String!
    lastname: String!
    captchaResponse: String!
  }
  input UserUpdate {
    id: ID!
    email: String
    password: String
    firstname: String
    lastname: String
  }
  input UserVerification {
    id: ID!
    code: String!
  }
  input LoginCredentials {
    username: String!
    password: String!
  }
  input UserPasswordUpdate {
    code: String!
    userId: ID!
    password: String!
  }
  type LoginResponse {
    user: User!
    authToken: String!
  }
`;
