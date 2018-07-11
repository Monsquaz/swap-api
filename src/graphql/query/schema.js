import { schemaHelper } from '../../util';
const { createRootQuery, createSelection } = schemaHelper;

exports.query = `
  ${[
    'event',
    'file',
    'roundsubmission',
    'song',
    'user'
  ].map(createRootQuery).join('\n')}`;

exports.schema = `
  ${createSelection(
    'event',
    ['id'],
    [
      ['id', 'Int']
    ]
  )}
  ${createSelection(
    'file',
    ['id'],
    [
      ['id', 'Int']
    ]
  )}
  ${createSelection(
    'roundsubmission',
    ['id'],
    [
      ['id', 'Int']
    ]
  )}
  ${createSelection(
    'song',
    ['id'],
    [
      ['id', 'Int']
    ]
  )}
  ${createSelection(
    'user', 
    ['id'],
    [
      ['id', 'Int']
    ]
  )}
`;
