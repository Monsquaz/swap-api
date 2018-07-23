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
    sortFields: ['id'],
    directFields: {
      status: 'EventStatus',
      isParticipating: 'Boolean',
      isPublic: 'Boolean',
      hostUserId: 'Int'
    },
    numericFields: [
      ['id', 'Int']
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
    numericFields: [
      ['id', 'Int']
    ]
  })}
`;
