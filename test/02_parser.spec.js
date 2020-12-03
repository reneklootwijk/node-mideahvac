/* eslint-disable mocha/no-hooks-for-single-case */

const assert = require('chai').assert
const { parse } = require('../lib/parsers')

const unknownResponse = Buffer.from([
  0xAA, 0x22, 0xAC, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x02,
  0xFF, 0x00, 0x44, 0x66, 0x7F, 0x7F, 0x00, 0x30, 0x00, 0x00,
  0x00, 0x5F, 0x59, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x3A, 0xA3
])

const c0Response = Buffer.from([
  0xAA, 0x22, 0xAC, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x02,
  0xC0, 0x00, 0x44, 0x66, 0x7F, 0x7F, 0x00, 0x30, 0x00, 0x00,
  0x00, 0x5F, 0x59, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x3A, 0xA3
])

const c1Response = Buffer.from([
  0xAA, 0x20, 0xAC, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x03,
  0xC1, 0x21, 0x01, 0x44, 0x00, 0x00, 0x12, 0x20, 0x00, 0x00,
  0x07, 0x43, 0x00, 0x00, 0x00, 0x16, 0x00, 0x39, 0x10, 0x00,
  0x04, 0xCF, 0x59
])

const b5Response = Buffer.from([
  0xAA, 0x3D, 0xAC, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x03,
  0xB5, 0x0A, 0x12, 0x02, 0x01, 0x01, 0x18, 0x00, 0x01, 0x00,
  0x14, 0x02, 0x01, 0x01, 0x15, 0x02, 0x01, 0x01, 0x16, 0x02,
  0x01, 0x03, 0x1A, 0x02, 0x01, 0x01, 0x10, 0x02, 0x01, 0x01,
  0x1F, 0x02, 0x01, 0x00, 0x25, 0x02, 0x07, 0x20, 0x3C, 0x20,
  0x3C, 0x20, 0x3C, 0x05, 0x40, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x79, 0x80
])

const c8Response = Buffer.from([
  0xaa, 0x22, 0xa1, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x03,
  0xc8, 0x01, 0x01, 0xd0, 0x7f, 0x89, 0x00, 0x4b, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2f, 0x64, 0x00, 0x00,
  0x00, 0x00, 0xa4, 0x62, 0xb1
])

describe('Parser tests:', function () {
  let result

  it('Parsing unknown response', function () {
    result = parse(unknownResponse)

    assert.strictEqual(typeof result, 'object', 'result is not an object')
    assert.strictEqual(Object.keys(result).length, 0, 'result is not empty')
  })

  it('C0 response parser', function () {
    var result = parse(c0Response)

    assert.strictEqual(result.inError, false, 'inError flag is reported incorrect')
    assert.strictEqual(result.setpoint, 20, 'setpoint is reported incorrect')
    assert.strictEqual(result.mode, 2, 'mode is reported incorrect')
    assert.strictEqual(result.fanSpeed, 102, 'fanSpeed is reported incorrect')
    assert.strictEqual(result.temperatureUnit, 0, 'temperatureUnit is reported incorrect')
    assert.strictEqual(result.sleepModeActive, false, 'sleepModeActive is reported incorrect')
    assert.strictEqual(result.indoorTemperature, 22.5, 'indoorTemperature is reported incorrect')
    assert.strictEqual(result.outdoorTemperature, 19.5, 'outdoorTemperature is reported incorrect')
    assert.strictEqual(result.verticalSwingActive, false, 'verticalSwingActive is reported incorrect')
  })

  it('C1 response parser', function () {
    var result = parse(c1Response)

    assert.strictEqual(result.powerUsage, 0.391, 'powerUsage is reported incorrect')
  })

  it('B5 response parser', function () {
    var result = parse(b5Response)

    assert.strictEqual(result.autoMode, true, 'autoMode is reported incorrect')
    assert.strictEqual(result.autoAdjustDownTemp, 16, 'autoAdjustDownTemp is reported incorrect')
    assert.strictEqual(result.autoAdjustUpTemp, 30, 'autoAdjustUpTemp is reported incorrect')
    assert.strictEqual(result.coolMode, true, 'coolMode is reported incorrect')
    assert.strictEqual(result.coolAdjustDownTemp, 16, 'coolAdjustDownTempt is reported incorrect')
    assert.strictEqual(result.coolAdjustUpTemp, 30, 'coolAdjustUpTemp is reported incorrect')
    assert.strictEqual(result.dryMode, true, 'dryMode is reported incorrect')
    assert.strictEqual(result.ecoMode, true, 'ecoMode is reported incorrect')
    assert.strictEqual(result.heatAdjustDownTemp, 16, 'heatAdjustDownTemp is reported incorrect')
    assert.strictEqual(result.heatAdjustUpTemp, 30, 'heatAdjustUpTemp is reported incorrect')
    assert.strictEqual(result.heatMode, true, 'heatMode is reported incorrect')
    assert.strictEqual(result.horizontalSwingMode, true, 'horizontalSwingMode is reported incorrect')
    assert.strictEqual(result.strongHeat, true, 'strongHeat is reported incorrect')
    assert.strictEqual(result.strongCool, true, 'strongCool is reported incorrect')
    assert.strictEqual(result.verticalSwingMode, true, 'verticalSwingMode is reported incorrect')
  })

  it('C8 response parser', function () {
    var result = parse(c8Response)

    assert.strictEqual(result.powerOn, true, 'powerOn is reported incorrect')
    assert.strictEqual(result.dehumidifierMode, 1, 'dehumidifierMode is reported incorrect')
    assert.strictEqual(result.fanSpeed, 80, 'fanSpeed is reported incorrect')
    assert.strictEqual(result.onTimerActive, false, 'onTimerActive is reported incorrect')
    assert.strictEqual(result.onTimerMinutes, 0, 'onTimerMinutes is reported incorrect')
    assert.strictEqual(result.onTimerHours, 0, 'onTimerHours is reported incorrect')
    assert.strictEqual(result.offTimerActive, true, 'offTimerActive is reported incorrect')
    assert.strictEqual(result.offTimerHours, 2.5, 'offTimerHours is reported incorrect')
    assert.strictEqual(result.offTimerMinutes, 30, 'offTimerMinutes is reported incorrect')
    assert.strictEqual(result.humiditySetpoint, 75, 'humiditySetpoint is reported incorrect')
    assert.strictEqual(result.currentHumidity, 47, 'currentHumidity is reported incorrect')
    assert.strictEqual(result.errorCode, 0, 'errorCode is reported incorrect')
  })
})
