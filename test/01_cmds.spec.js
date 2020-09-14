/* eslint-disable mocha/no-hooks-for-single-case */

const assert = require('chai').assert
const logger = require('winston')

const MockedConnection = require('./mocks/connection')

logger.remove(logger.transports.Console)
logger.add(new logger.transports.Console({
  format: logger.format.combine(
    logger.format.timestamp(),
    logger.format.colorize(),
    logger.format.printf(event => {
      return `${event.timestamp} ${event.level}: ${event.message}`
    })
  ),
  level: 'none'
}))

describe('Check construction of commands', function () {
  var ac

  before(function () {
    ac = new MockedConnection()
  })

  it('check construction of getStatus command', async function () {
    try {
      await ac.getStatus()
    } catch (error) {
      assert.strictEqual(error.message, 'aa20ac00000000000303418100ff03ff000200000000000000000000000003cd99', 'getStatus command corrupted')
    }
  })

  it('check construction of getCapabilities command', async function () {
    try {
      await ac.getCapabilities()
    } catch (error) {
      assert.strictEqual(error.message, 'aa0fac00000000000303b50101012166', 'getCapabilities command corrupted')
    }
  })

  it('check construction of setStatus command - unknown', async function () {
    try {
      await ac.setStatus({ unknown: 4 })
    } catch (error) {
      assert.strictEqual(error.message, 'Unsupported property to be set (unknown)', 'setting unknown property succeeded')
    }
  })

  it('check construction of setStatus command - beep', async function () {
    try {
      await ac.setStatus({ beep: 4 })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac0000000000030240020000000000300000000000000000000000000000000000b405', 'setting beep: invalid value failed')
    }

    try {
      await ac.setStatus({ beep: true })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200000000003000000000000000000000000000000000001c5d', 'setting beep: true failed')
    }

    try {
      await ac.setStatus({ beep: false })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac0000000000030240020000000000300000000000000000000000000000000000b405', 'setting beep: false failed')
    }
  })

  it('check construction of setStatus command - fanSpeed', async function () {
    try {
      await ac.setStatus({ fanSpeed: 20 })
    } catch (error) {
      assert.strictEqual(error.message, 'fanSpeed must be one of: auto, silent, low, medium or high', 'setting fanSpeed: invalid value failed')
    }

    try {
      await ac.setStatus({ fanSpeed: 'auto' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac0000000000030240420066000000300000000000000000000000000000000000a86b', 'setting fanSpeed: auto failed')
    }

    try {
      await ac.setStatus({ fanSpeed: 'silent' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac0000000000030240420014000000300000000000000000000000000000000000d392', 'setting fanSpeed: silent failed')
    }

    try {
      await ac.setStatus({ fanSpeed: 'low' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200280000003000000000000000000000000000000000009bb6', 'setting fanSpeed: low failed')
    }

    try {
      await ac.setStatus({ fanSpeed: 'medium' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac000000000003024042003c00000030000000000000000000000000000000000054e9', 'setting fanSpeed: medium failed')
    }

    try {
      await ac.setStatus({ fanSpeed: 'high' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200500000003000000000000000000000000000000000000b1e', 'setting fanSpeed: high failed')
    }
  })

  it('check construction of setStatus command - frostProtectionModeActive', async function () {
    try {
      await ac.setStatus({ frostProtectionModeActive: true, mode: 'cool' })
    } catch (error) {
      assert.strictEqual(error.message, 'frostProtection capability is only available in heat mode', 'setting frostProtectionModeActive: true while in cool mode failed')
    }

    try {
      await ac.setStatus({ frostProtectionModeActive: 4, mode: 'heat' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac0000000000030240428000000000300000000000000000000000000000000000db1e', 'setting frostProtectionModeActive: invalid value failed')
    }

    try {
      await ac.setStatus({ frostProtectionModeActive: true, mode: 'heat' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404280000000003000000000000000000000000000800000000277', 'setting frostProtectionModeActive: true failed')
    }

    try {
      await ac.setStatus({ frostProtectionModeActive: false, mode: 'heat' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac0000000000030240428000000000300000000000000000000000000000000000db1e', 'setting frostProtectionModeActive: false failed')
    }
  })

  it('check construction of setStatus command - horizontalSwingActive', async function () {
    try {
      await ac.setStatus({ horizontalSwingActive: 4 })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200000000003000000000000000000000000000000000001c5d', 'setting horizontalSwingActive: invalid value failed')
    }

    try {
      await ac.setStatus({ horizontalSwingActive: true })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200000000003c0000000000000000000000000000000000b6b7', 'setting horizontalSwingActive: true failed')
    }

    try {
      await ac.setStatus({ horizontalSwingActive: false })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200000000003000000000000000000000000000000000001c5d', 'setting horizontalSwingActive: false failed')
    }
  })

  it('check construction of setStatus command - mode', async function () {
    try {
      await ac.setStatus({ mode: 4 })
    } catch (error) {
      assert.strictEqual(error.message, 'Mode must be one of: auto, cool, dry, heat or fanonly', 'setting mode: invalid value failed')
    }

    try {
      await ac.setStatus({ mode: 'auto' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac0000000000030240422000000000300000000000000000000000000000000000e772', 'setting mode: auto failed')
    }

    try {
      await ac.setStatus({ mode: 'cool' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac0000000000030240424000000000300000000000000000000000000000000000f346', 'setting mode: cool failed')
    }

    try {
      await ac.setStatus({ mode: 'dry' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404260000000003000000000000000000000000000000000000811', 'setting mode: dry failed')
    }

    try {
      await ac.setStatus({ mode: 'fanonly' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac000000000003024042a00000000030000000000000000000000000000000000020b9', 'setting mode: fanonly failed')
    }

    try {
      await ac.setStatus({ mode: 'heat' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac0000000000030240428000000000300000000000000000000000000000000000db1e', 'setting mode: heat failed')
    }
  })

  it('check construction of setStatus command - powerOn', async function () {
    try {
      await ac.setStatus({ powerOn: 4 })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200000000003000000000000000000000000000000000001c5d', 'setting powerOn: invalid value failed')
    }

    try {
      await ac.setStatus({ powerOn: true })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac0000000000030240430000000000300000000000000000000000000000000000b1c7', 'setting powerOn: true failed')
    }

    try {
      await ac.setStatus({ powerOn: false })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200000000003000000000000000000000000000000000001c5d', 'setting powerOn: false failed')
    }
  })

  it('check construction of setStatus command - setpoint', async function () {
    try {
      await ac.setStatus({ setpoint: 13, temperatureUnit: 'celcius' })
    } catch (error) {
      assert.strictEqual(error.message, 'The setpoint must be between 16 - 31°C', 'setting setpoint: 13°C succeeded')
    }

    try {
      await ac.setStatus({ setpoint: 13, temperatureUnit: 'fahrenheit' })
    } catch (error) {
      assert.strictEqual(error.message, 'The setpoint must be between 60 - 87°F', 'setting setpoint: 13°F succeeded')
    }

    try {
      await ac.setStatus({ setpoint: 34, temperatureUnit: 'celcius' })
    } catch (error) {
      assert.strictEqual(error.message, 'The setpoint must be between 16 - 31°C', 'setting setpoint: 34°C succeeded')
    }

    try {
      await ac.setStatus({ setpoint: 90, temperatureUnit: 'fahrenheit' })
    } catch (error) {
      assert.strictEqual(error.message, 'The setpoint must be between 60 - 87°F', 'setting setpoint: 90°F succeeded')
    }

    try {
      await ac.setStatus({ setpoint: 18, temperatureUnit: 'celcius' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404202000000003000000000000000000000000000000000002156', 'setting setpoint: 18°C failed')
    }

    try {
      await ac.setStatus({ setpoint: 64, temperatureUnit: 'fahrenheit' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404202000000003000000400000000000000000000000000001360', 'setting setpoint: 64°F failed')
    }
    try {
      await ac.setStatus({ setpoint: 23.5, temperatureUnit: 'celcius' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac0000000000030240421700000000300000000000000000000000000000000000382a', 'setting setpoint: 23.5°C failed')
    }

    try {
      await ac.setStatus({ setpoint: 74, temperatureUnit: 'fahrenheit' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404217000000003000000400000000000000000000000000000a54', 'setting setpoint: 74°F failed')
    }

  })

  it('check construction of setStatus command - sleepModeActive', async function () {
    try {
      await ac.setStatus({ sleepModeActive: 4 })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200000000003000000000000000000000000000000000001c5d', 'setting sleepModeActive: invalid value failed')
    }

    try {
      await ac.setStatus({ sleepModeActive: true })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200000000003000000100000000000000000000000000009cdc', 'setting sleepModeActive: true failed')
    }

    try {
      await ac.setStatus({ sleepModeActive: false })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200000000003000000000000000000000000000000000001c5d', 'setting sleepModeActive: false failed')
    }
  })

  it('check construction of setStatus command - temperatureUnit', async function () {
    try {
      await ac.setStatus({ temperatureUnit: 4 })
    } catch (error) {
      assert.strictEqual(error.message, 'The temperatureUnit must either be fahrenheit or celcius', 'setting temperatureUnit: invalid value failed')
    }

    try {
      await ac.setStatus({ temperatureUnit: 'fahrenheit' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200000000003000000400000000000000000000000000002e47', 'setting tempertureUnit: fahrenheit failed')
    }

    try {
      await ac.setStatus({ temperatureUnit: 'celcius' })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200000000003000000000000000000000000000000000001c5d', 'setting tempertureUnit: ceclius failed')
    }
  })

  it('check construction of setStatus command - turboModeActive', async function () {
    try {
      await ac.setStatus({ turboModeActive: 4 })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200000000003000000000000000000000000000000000001c5d', 'setting turboModeActive: invalid value failed')
    }

    try {
      await ac.setStatus({ turboModeActive: true })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac000000000003024042000000000030200002000000000000000000000000000098bf', 'setting turboModeActive: true failed')
    }

    try {
      await ac.setStatus({ turboModeActive: false })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200000000003000000000000000000000000000000000001c5d', 'setting turboModeActive: false failed')
    }
  })

  it('check construction of setStatus command - verticalSwingActive', async function () {
    try {
      await ac.setStatus({ verticalSwingActive: 4 })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200000000003000000000000000000000000000000000001c5d', 'setting verticalSwingActive: invalid value failed')
    }

    try {
      await ac.setStatus({ verticalSwingActive: true })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac0000000000030240420000000000330000000000000000000000000000000000babc', 'setting verticalSwingActive: true failed')
    }

    try {
      await ac.setStatus({ verticalSwingActive: false })
    } catch (error) {
      assert.strictEqual(error.message, 'aa24ac00000000000302404200000000003000000000000000000000000000000000001c5d', 'setting verticalSwingActive: false failed')
    }
  })
})
