'use strict';

const logger = require('winston');

// Add a transport as fall back when no parent logger has been initialized
// to prevent the error: "Attempt to write logs with no transports"
logger.add(new logger.transports.Console({
  level: 'none'
}));

exports.parser = (data) => {
  logger.debug(`C1.parser: Entering with ${data.toString('hex')}`);

  if (data.len < 18) {
    logger.error(`C1.parser: Invalid length of message (${data.length})`);
    return {};
  }

  // Byte 16, 17, and 18 contain the binary coded decimal representation of
  // the current power usage
  let n = 0;
  let m = 1;
  for (let i = 0; i < 3; i++) {
    n += (data[18 - i] & 0x0F) * m;
    n += ((data[18 - i] >> 4) & 0x0F) * m * 10;
    m *= 100;
  }

  return { powerUsage: n / 10000 };
};
