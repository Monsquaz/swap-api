import { schemaHelper } from '../../util';
const { createRootQuery, createSelection } = schemaHelper;

exports.query = `
  currentUser: User
  ${[
    'event','file','roundsubmission','song','user'
  ].map(createRootQuery).join('\n')}`;

exports.schema = `
  ${createSelection({
    type: 'event',
    sortFields: ['id','status'],
    directFields: {
      slug: 'String',
      status: '[EventStatus!]',
      isParticipating: 'Boolean',
      isPublic: 'Boolean',
      hostUserId: 'Int'
    },
    numericFields: [
      ['id', 'Int'],
      ['created', 'String'],
      ['started', 'String'],
      ['completed', 'String']
    ]
  })}
  ${createSelection({
    type: 'file',
    sortFields: ['id'],
    numericFields: [
      ['id', 'Int']
    ]
  })}
  ${createSelection({
    type: 'roundsubmission',
    sortFields: ['id'],
    numericFields: [
      ['id', 'Int']
    ]
  })}
  ${createSelection({
    type: 'song',
    sortFields: ['id'],
    numericFields: [
      ['id', 'Int']
    ]
  })}
  ${createSelection({
    type: 'user',
    sortFields: ['id'],
    directFields: {
      id: '[ID!]',
      slug: 'String'
    },
    numericFields: [
      ['id', 'Int']
    ]
  })}
`;
