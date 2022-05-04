/* eslint-disable mocha/no-hooks-for-single-case */

// Delete the serialbridge module from the cache to be able to mock the net modul
delete require.cache[require.resolve('../lib/serialbridge')];

const assert = require('chai').assert;
const rewireMock = require('rewiremock/node');
const appliances = require('../lib');

rewireMock.enable();

rewireMock('net').by('./mocks/net');

const networkNotificationResponse = Buffer.from([
  0xAA, 0x1F, 0xAC, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x0D,
  0x01, 0x01, 0x04, 0x04, 0x05, 0xA8, 0xC0, 0xFF, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x7B, 0x31
]);

const getStatusResponse = Buffer.from([
  0xAA, 0x22, 0xAC, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x03,
  0xC0, 0x00, 0x48, 0x66, 0x7F, 0x7F, 0x00, 0x30, 0x00, 0x00,
  0x00, 0x67, 0x53, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x40, 0xA5
]);

const getCapabilitiesResponse = Buffer.from([
  0xAA, 0x29, 0xAC, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x03,
  0xB5, 0x07, 0x12, 0x02, 0x01, 0x00, 0x13, 0x02, 0x01, 0x01,
  0x14, 0x02, 0x01, 0x01, 0x15, 0x02, 0x01, 0x01, 0x16, 0x02,
  0x01, 0x01, 0x17, 0x02, 0x01, 0x00, 0x1A, 0x02, 0x01, 0x01,
  0x8C, 0x2E
]);

var ac;
var eventInitialized;

describe('Connection tests serial bridge:', function () {
  it('creating an appliance without specifying a communication type should throw an error', function () {
    assert.throws(() => {
      ac = appliances.createAppliance();
    }, 'No communication method specified', 'should have thrown an error');
  });

  it('creating any appliance by specifying an unsupported communication type should throw an error', function () {
    assert.throws(() => {
      ac = appliances.createAppliance({ communicationMethod: 'unsupported' });
    }, 'Unknown communication method specified', 'should have thrown an error');
  });

  it('using the serialbridge method without specifying a host should throw an error', function () {
    assert.throws(() => {
      ac = appliances.createAppliance({
        communicationMethod: 'serialbridge',
        port: 23
      });
    }, 'Cannot create serialbridge connection, no host and/or port specified', 'should have thrown an error');
  });

  it('using the serialbridge method without specifying a port should throw an error', function () {
    assert.throws(() => {
      ac = appliances.createAppliance({
        communicationMethod: 'serialbridge',
        host: 'midea.serialbridge.com'
      });
    }, 'Cannot create serialbridge connection, no host and/or port specified', 'should have thrown an error');
  });

  it('creating an appliance object successfully', function () {
    assert.doesNotThrow(() => {
      ac = appliances.createAppliance({
        communicationMethod: 'serialbridge',
        host: 'midea.serialbridge.com',
        port: 23
      });
    });
  });
});

describe('Integration tests serial bridge:', function () {
  describe('get capabilities when supported', function () {
    let capabilities;
    let errorMsg;

    before(async function () {
      // Explicitly connect in order to add the simulated responses to the mocked connection instance
      await ac._connect();

      // Specifify the simulated response
      ac._connection.mockResponses.push(getCapabilitiesResponse);

      capabilities = await ac.getCapabilities()
        .catch(error => {
          errorMsg = error.message;
        });
    });

    it('Valid response received', function () {
      assert.strictEqual(errorMsg, undefined, 'an error is reported');
    });

    it('B5 response parser', function () {
      assert.strictEqual(capabilities.autoMode, true, 'autoMode is reported incorrect');
      assert.strictEqual(capabilities.coolMode, true, 'coolMode is reported incorrect');
      assert.strictEqual(capabilities.dryMode, true, 'dryMode is reported incorrect');
      assert.strictEqual(capabilities.frostProtectionMode, true, 'frostProtectionMode is reported incorrect');
      assert.strictEqual(capabilities.leftrightFan, true, 'leftrightFan is reported incorrect');
      assert.strictEqual(capabilities.heatMode, true, 'heatMode is reported incorrect');
      assert.strictEqual(capabilities.turboCool, true, 'turboCool is reported incorrect');
      assert.strictEqual(capabilities.turboHeat, true, 'turboHeat is reported incorrect');
      assert.strictEqual(capabilities.updownFan, true, 'updownFan is reported incorrect');
    });
  });

  describe('get capabilities when not supported', function () {
    let capabilities;
    let errorMsg;

    before(async function () {
      this.timeout(3000);

      // Explicitly connect in order to add the simulated responses to the mocked connection instance
      await ac._connect();

      // Specifify the simulated response
      ac._connection.mockResponses.push([0x99]);

      capabilities = await ac.getCapabilities()
        .catch(error => {
          errorMsg = error.message;
        });
    });

    it('Timeout received', function () {
      assert.strictEqual(errorMsg, 'No response received', 'No or unexpected error is reported');
    });
  });
});
