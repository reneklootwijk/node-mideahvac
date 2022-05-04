'use strict';

exports.createAppliance = (options = {}) => {
  let Method;

  if (!options.communicationMethod) {
    throw new Error('No communication method specified');
  }

  switch (options.communicationMethod) {
    case 'serialbridge':
      Method = require('./serialbridge');
      return new Method(options);

    case 'sk103':
      Method = require('./sk103');
      return new Method(options);

    default:
      throw new Error('Unknown communication method specified');
  }
};
