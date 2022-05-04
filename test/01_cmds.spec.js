/* eslint-disable mocha/no-hooks-for-single-case */

const assert = require('chai').assert;
const logger = require('winston');
const AC = require('../lib/ac');

class MockedAC extends AC {
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
  let ac;

  before(function () {
    ac = new MockedAC();
  });

  it('check construction of getPowerUsage command', async function () {
    try {
      await ac.getPowerUsage();
    } catch (error) {
      assert.strictEqual(error.message, 'aa11ac00000000000303412101440001098c', 'getPowerUsage command corrupted');
    }
  });

  it('check construction of getStatus command', async function () {
    try {
      await ac.getStatus();
    } catch (error) {
      assert.strictEqual(error.message, 'aa20ac00000000000003418100ff03ff000200000000000000000000000003cd9c', 'getStatus command corrupted');
    }
  });

  it('check construction of getCapabilities command', async function () {
    try {
      await ac.getCapabilities();
    } catch (error) {
      assert.strictEqual(error.message, 'aa0eac00000000000303b501118eeb', 'getCapabilities command corrupted');
    }
  });

  it('check construction of _getMoreCapabilities command without specified num', async function () {
    try {
      await ac._getMoreCapabilities();
    } catch (error) {
      assert.strictEqual(error.message, 'aa0fac00000000000303b50101012166', '_getMoreCapabilities without num command corrupted');
    }
  });

  it('check construction of _getMoreCapabilities command with num=2', async function () {
    try {
      await ac._getMoreCapabilities(2);
    } catch (error) {
      assert.strictEqual(error.message, 'aa0fac00000000000303b5010102c3c3', '_getMoreCapabilities with num command corrupted');
    }
  });

  it('check construction of setStatus command - unknown', async function () {
    try {
      await ac.setStatus({ unknown: 4 });
    } catch (error) {
      assert.strictEqual(error.message, 'Unsupported property to be set (unknown)', 'setting unknown property succeeded');
    }
  });

  it('check construction of setStatus command - beep', async function () {
    try {
      await ac.setStatus({ beep: 4 });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302400200000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting beep: invalid value failed');
    }

    try {
      await ac.setStatus({ beep: true });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting beep: true failed');
    }

    try {
      await ac.setStatus({ beep: false });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302400200000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting beep: false failed');
    }
  });

  it('check construction of setStatus command - fanSpeed', async function () {
    try {
      await ac.setStatus({ fanSpeed: 'unknown' });
    } catch (error) {
      assert.strictEqual(error.message, 'fanSpeed must be one of: auto, silent, low, medium or high', 'setting fanSpeed: invalid value failed');
    }

    try {
      await ac.setStatus({ fanSpeed: 110 });
    } catch (error) {
      assert.strictEqual(error.message, 'fanSpeed must be between 0 - 100%', 'setting fanSpeed: invalid value failed');
    }

    try {
      await ac.setStatus({ fanSpeed: 'auto' });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200660000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting fanSpeed: auto failed');
    }

    try {
      await ac.setStatus({ fanSpeed: 'silent' });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200140000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting fanSpeed: silent failed');
    }

    try {
      await ac.setStatus({ fanSpeed: 'low' });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200280000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting fanSpeed: low failed');
    }

    try {
      await ac.setStatus({ fanSpeed: 'medium' });
    } catch (error) {
      assert.match(error.message, /^aa24ac000000000003024042003c0000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting fanSpeed: medium failed');
    }

    try {
      await ac.setStatus({ fanSpeed: 'high' });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200500000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting fanSpeed: high failed');
    }

    try {
      await ac.setStatus({ fanSpeed: 23 });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200170000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting fanSpeed: 23% failed');
    }
  });

  it('check construction of setStatus command - frostProtectionMode', async function () {
    try {
      await ac.setStatus({ frostProtectionMode: true, mode: 'cool' });
    } catch (error) {
      assert.strictEqual(error.message, 'frostProtection capability is only available in heat mode', 'setting frostProtectionMode: true while in cool mode failed');
    }

    try {
      await ac.setStatus({ frostProtectionMode: 4, mode: 'heat' });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404280000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting frostProtectionMode: invalid value failed');
    }

    try {
      await ac.setStatus({ frostProtectionMode: true, mode: 'heat' });
    } catch (error) {
      assert.match(error.message, /aa24ac00000000000302404280000000003000000000000000000000000000808000[a-z0-9]{6}/, 'setting frostProtectionMode: true failed');
    }

    try {
      await ac.setStatus({ frostProtectionMode: false, mode: 'heat' });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404280000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting frostProtectionMode: false failed');
    }
  });

  it('check construction of setStatus command - humiditySetpoint', async function () {
    try {
      await ac.setStatus({ humiditySetpoint: 30 });
    } catch (error) {
      assert.strictEqual(error.message, 'The humiditySetpoint must be between 35 - 85%', 'setting humiditySetpoint: 30% succeeded');
    }

    try {
      await ac.setStatus({ humiditySetpoint: 86 });
    } catch (error) {
      assert.strictEqual(error.message, 'The humiditySetpoint must be between 35 - 85%', 'setting humiditySetpoint: 86% succeeded');
    }

    try {
      await ac.setStatus({ humiditySetpoint: 40 });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003000000000000000000000002800008000[a-z0-9]{6}/, 'setting humiditySetpoint: 40% failed');
    }
  });

  it('check construction of setStatus command - leftrightFan', async function () {
    try {
      await ac.setStatus({ leftrightFan: 4 });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting leftrightFan: invalid value failed');
    }

    try {
      await ac.setStatus({ leftrightFan: true });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003300000000000000000000000000008000[a-z0-9]{6}/, 'setting leftrightFan: true failed');
    }

    try {
      await ac.setStatus({ leftrightFan: false });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting leftrightFan: false failed');
    }
  });

  it('check construction of setStatus command - mode', async function () {
    try {
      await ac.setStatus({ mode: 4 });
    } catch (error) {
      assert.strictEqual(error.message, 'Mode must be one of: auto, cool, dry, heat, fanonly or customdry', 'setting mode: invalid value failed');
    }

    try {
      await ac.setStatus({ mode: 'auto' });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404220000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting mode: auto failed');
    }

    try {
      await ac.setStatus({ mode: 'cool' });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404240000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting mode: cool failed');
    }

    try {
      await ac.setStatus({ mode: 'dry' });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404260000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting mode: dry failed');
    }

    try {
      await ac.setStatus({ mode: 'fanonly' });
    } catch (error) {
      assert.match(error.message, /^aa24ac000000000003024042a0000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting mode: fanonly failed');
    }

    try {
      await ac.setStatus({ mode: 'heat' });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404280000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting mode: heat failed');
    }

    try {
      await ac.setStatus({ mode: 'customdry' });
    } catch (error) {
      assert.match(error.message, /^aa24ac000000000003024042c0000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting mode: customdry failed');
    }
  });

  it('check construction of setStatus command - powerOn', async function () {
    try {
      await ac.setStatus({ powerOn: 4 });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting powerOn: invalid value failed');
    }

    try {
      await ac.setStatus({ powerOn: true });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404300000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting powerOn: true failed');
    }

    try {
      await ac.setStatus({ powerOn: false });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting powerOn: false failed');
    }
  });

  it('check construction of setStatus command - temperatureSetpoint', async function () {
    try {
      await ac.setStatus({ temperatureSetpoint: 13, temperatureUnit: 'celsius' });
    } catch (error) {
      assert.strictEqual(error.message, 'The temperatureSetpoint must be between 16 - 31°C', 'setting temperatureSetpoint: 13°C succeeded');
    }

    try {
      await ac.setStatus({ temperatureSetpoint: 13, temperatureUnit: 'fahrenheit' });
    } catch (error) {
      assert.strictEqual(error.message, 'The temperatureSetpoint must be between 60 - 87°F', 'setting temperatureSetpoint: 13°F succeeded');
    }

    try {
      await ac.setStatus({ temperatureSetpoint: 34, temperatureUnit: 'celsius' });
    } catch (error) {
      assert.strictEqual(error.message, 'The temperatureSetpoint must be between 16 - 31°C', 'setting temperatureSetpoint: 34°C succeeded');
    }

    try {
      await ac.setStatus({ temperatureSetpoint: 90, temperatureUnit: 'fahrenheit' });
    } catch (error) {
      assert.strictEqual(error.message, 'The temperatureSetpoint must be between 60 - 87°F', 'setting temperatureSetpoint: 90°F succeeded');
    }

    try {
      await ac.setStatus({ temperatureSetpoint: 18, temperatureUnit: 'celsius' });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404202000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting temperatureSetpoint: 18°C failed');
    }

    try {
      await ac.setStatus({ temperatureSetpoint: 64, temperatureUnit: 'fahrenheit' });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404202000000003000000400000000000000000000008000[a-z0-9]{6}/, 'setting temperatureSetpoint: 64°F failed');
    }
    try {
      await ac.setStatus({ temperatureSetpoint: 23.5, temperatureUnit: 'celsius' });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404217000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting temperatureSetpoint: 23.5°C failed');
    }

    try {
      await ac.setStatus({ temperatureSetpoint: 74, temperatureUnit: 'fahrenheit' });
    } catch (error) {
      assert.match(error.message, /aa24ac00000000000302404217000000003000000400000000000000000000008000[a-z0-9]{6}/, 'setting temperatureSetpoint: 74°F failed');
    }
  });

  it('check construction of setStatus command - sleepMode', async function () {
    try {
      await ac.setStatus({ sleepMode: 4 });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting sleepMode: invalid value failed');
    }

    try {
      await ac.setStatus({ sleepMode: true });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003000000100000000000000000000008000[a-z0-9]{6}/, 'setting sleepMode: true failed');
    }

    try {
      await ac.setStatus({ sleepMode: false });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting sleepMode: false failed');
    }
  });

  it('check construction of setStatus command - temperatureUnit', async function () {
    try {
      await ac.setStatus({ temperatureUnit: 4 });
    } catch (error) {
      assert.strictEqual(error.message, 'The temperatureUnit must either be fahrenheit or celsius', 'setting temperatureUnit: invalid value failed');
    }

    try {
      await ac.setStatus({ temperatureUnit: 'fahrenheit' });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003000000400000000000000000000008000[a-z0-9]{6}/, 'setting tempertureUnit: fahrenheit failed');
    }

    try {
      await ac.setStatus({ temperatureUnit: 'celsius' });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting tempertureUnit: ceclius failed');
    }
  });

  it('check construction of setStatus command - turboMode', async function () {
    try {
      await ac.setStatus({ turboMode: 4 });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting turboMode: invalid value failed');
    }

    try {
      await ac.setStatus({ turboMode: true });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003020000200000000000000000000008000[a-z0-9]{6}/, 'setting turboMode: true failed');
    }

    try {
      await ac.setStatus({ turboMode: false });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting turboMode: false failed');
    }
  });

  it('check construction of setStatus command - updownFan', async function () {
    try {
      await ac.setStatus({ updownFan: 4 });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting updownFan: invalid value failed');
    }

    try {
      await ac.setStatus({ updownFan: true });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003c00000000000000000000000000008000[a-z0-9]{6}/, 'setting updownFan: true failed');
    }

    try {
      await ac.setStatus({ updownFan: false });
    } catch (error) {
      assert.match(error.message, /^aa24ac00000000000302404200000000003000000000000000000000000000008000[a-z0-9]{6}/, 'setting updownFan: false failed');
    }
  });
});
