/* eslint-disable mocha/no-hooks-for-single-case */

const assert = require('chai').assert;
const logger = require('winston');
const SerialBridge = require('../lib/serialbridge');

class MockedSerialBridge extends SerialBridge {
  _request (cmd, label = 'unknown') {
    return new Promise((resolve, reject) => {
      reject(new Error(cmd.toString('hex')));
    });
  }
};

logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console({
  format: logger.format.combine(
    logger.format.timestamp(),
    logger.format.colorize(),
    logger.format.printf(event => {
      return `${event.timestamp} ${event.level}: ${event.message}`;
    })
  ),
  level: 'none'
}));

describe('Check construction of commands', function () {
  var ac;

  before(function () {
    ac = new MockedSerialBridge({ host: 'test.com', port: 25 });
  });

  it('check construction of getElectronicId command', async function () {
    try {
      await ac.getElectronicId();
    } catch (error) {
      assert.strictEqual(error.message, 'aa0bff0000000000030700ec', 'getElectronicId command corrupted');
    }
  });

  it('check construction of sendNetworkStatusNotification command', async function () {
    try {
      await ac.sendNetworkStatusNotification();
    } catch (error) {
      assert.strictEqual(error.message, 'aa1eac0000000000030d0101040100007fff0001010100000000000000009e', 'sendNetworkStatusNotification command corrupted');
    }
  });
});
