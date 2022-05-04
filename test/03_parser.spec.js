/* eslint-disable mocha/no-hooks-for-single-case */

const assert = require('chai').assert;
const { parse } = require('../lib/parsers');

const unknownResponse = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0x00, 0x44, 0x66, 0x7F, 0x7F, 0x00, 0x30, 0x00, 0x00,
  0x00, 0x5F, 0x59, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00
]);

const c0Response = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xc0, 0x00, 0x47, 0x66, 0x7f, 0x7f, 0x00, 0x30, 0x00, 0x00,
  0x00, 0x61, 0x4a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x9c
]);

const c1Response = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xC1, 0x21, 0x01, 0x44, 0x00, 0x00, 0x12, 0x20, 0x00, 0x00,
  0x07, 0x43, 0x00, 0x00, 0x00, 0x16, 0x00, 0x39, 0x10, 0x00,
  0x04
]);

const b5Response = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xB5, 0x0A, 0x12, 0x02, 0x01, 0x01, 0x18, 0x00, 0x01, 0x00,
  0x14, 0x02, 0x01, 0x01, 0x15, 0x02, 0x01, 0x01, 0x16, 0x02,
  0x01, 0x03, 0x1A, 0x02, 0x01, 0x01, 0x10, 0x02, 0x01, 0x01,
  0x1F, 0x02, 0x01, 0x00, 0x25, 0x02, 0x07, 0x20, 0x3C, 0x20,
  0x3C, 0x20, 0x3C, 0x05, 0x40, 0x00, 0x01, 0x00, 0x01, 0x00
]);

describe('Parser tests:', function () {
  let result;

  it('Parsing unknown response', function () {
    result = parse(unknownResponse);

    assert.strictEqual(typeof result, 'object', 'result is not an object');
    assert.strictEqual(Object.keys(result).length, 0, 'result is not empty');
  });

  it('C0 response parser', function () {
    var result = parse(c0Response);

    assert.strictEqual(result.braceletControl, false, 'braceletControl is reported incorrect');
    assert.strictEqual(result.braceletSleep, false, 'braceletSleep is reported incorrect');
    assert.strictEqual(result.catchCold, false, 'catchCold is reported incorrect');
    assert.strictEqual(result.childSleep, false, 'childSleep is reported incorrect');
    assert.strictEqual(result.coolFan, false, 'coolFan is reported incorrect');
    assert.strictEqual(result.cosySleep, 0, 'cosySleep is reported incorrect');
    assert.strictEqual(result.downWindControl, false, 'downWindControl is reported incorrect');
    assert.strictEqual(result.downWindControlLR, false, 'downWindControlLR is reported incorrect');
    assert.strictEqual(result.dryClean, false, 'dryClean is reported incorrect');
    assert.strictEqual(result.dualControl, false, 'dualControl is reported incorrect');
    assert.strictEqual(result.dustFull, false, 'dustFull is reported incorrect');
    assert.strictEqual(result.ecoMode, false, 'ecoMode is reported incorrect');
    assert.strictEqual(result.ecoSleepRunningHours, 0, 'ecoSleepRunningHours is reported incorrect');
    assert.strictEqual(result.ecoSleepRunningMinutes, 0, 'ecoSleepRunningMinutes is reported incorrect');
    assert.strictEqual(result.ecoSleepRunningSeconds, 0, 'ecoSleepRunningSeconds is reported incorrect');
    assert.strictEqual(result.fanSpeed, 102, 'fanSpeed is reported incorrect');
    assert.strictEqual(result.fastCheck, false, 'fastCheck is reported incorrect');
    assert.strictEqual(result.frostProtection, false, 'frostProtection is reported incorrect');
    assert.strictEqual(result.feelOwn, false, 'feelOwn is reported incorrect');
    assert.strictEqual(result.humiditySetpoint, 0, 'humiditySetpoint is reported incorrect');
    assert.strictEqual(result.indoorTemperature, 23.5, 'indoorTemperature is reported incorrect');
    assert.strictEqual(result.inError, false, 'inError flag is reported incorrect');
    assert.strictEqual(result.keepWarm, false, 'keepWarm is reported incorrect');
    assert.strictEqual(result.light, 0, 'light is reported incorrect');
    assert.strictEqual(result.leftrightFan, false, 'leftrightFan is reported incorrect');
    assert.strictEqual(result.lowFrequencyFan, false, 'lowFrequencyFan is reported incorrect');
    assert.strictEqual(result.mode, 2, 'mode is reported incorrect');
    assert.strictEqual(result.naturalFan, false, 'naturalFan is reported incorrect');
    assert.strictEqual(result.nightLight, false, 'nightLight is reported incorrect');
    assert.strictEqual(result.offTimer, false, 'offTimer is reported incorrect');
    assert.strictEqual(result.offTimerHours, 0, 'offTimerHours is reported incorrect');
    assert.strictEqual(result.offTimerMinutes, 0, 'offTimerMinutes is reported incorrect');
    assert.strictEqual(result.onTimer, false, 'onTimer is reported incorrect');
    assert.strictEqual(result.onTimerHours, 0, 'onTimerHours is reported incorrect');
    assert.strictEqual(result.onTimerMinutes, 0, 'onTimerMinutes is reported incorrect');
    assert.strictEqual(result.outdoorTemperature, 12, 'outdoorTemperature is reported incorrect');
    assert.strictEqual(result.pmv, 0, 'pmv is reported incorrect');
    assert.strictEqual(result.purify, false, 'purify is reported incorrect');
    assert.strictEqual(result.purify, false, 'purify is reported incorrect');
    assert.strictEqual(result.ptcHeater, false, 'ptcHeater is reported incorrect');
    assert.strictEqual(result.powerOn, false, 'powerOn is reported incorrect');
    assert.strictEqual(result.resume, false, 'resume is reported incorrect');
    assert.strictEqual(result.temperatureSetpoint, 23, 'setpoint is reported incorrect');
    assert.strictEqual(result.save, false, 'save is reported incorrect');
    assert.strictEqual(result.selfCosySleep, false, 'selfCosySleep is reported incorrect');
    assert.strictEqual(result.selfFeelOwn, false, 'selfFeelOwn is reported incorrect');
    assert.strictEqual(result.sleepMode, false, 'sleepMode is reported incorrect');
    assert.strictEqual(result.smartEye, false, 'smartEye is reported incorrect');
    assert.strictEqual(result.smartWind, false, 'smartWind is reported incorrect');
    assert.strictEqual(result.statusCode, 0, 'statusCode is reported incorrect');
    assert.strictEqual(result.temp, 0, 'temp is reported incorrect');
    assert.strictEqual(result.tempDecimal, false, 'tempDecimal is reported incorrect');
    assert.strictEqual(result.temperatureUnit, 0, 'temperatureUnit is reported incorrect');
    assert.strictEqual(result.turboMode, false, 'turboMode is reported incorrect');
    assert.strictEqual(result.timerMode, 0, 'timerMode is reported incorrect');
    assert.strictEqual(result.updownFan, false, 'updownFan is reported incorrect');
    assert.strictEqual(result.ventilation, false, 'ventilation is reported incorrect');
    assert.strictEqual(result.windBlowing, false, 'windBlowing is reported incorrect');
  });

  it('C1 response parser', function () {
    var result = parse(c1Response);

    assert.strictEqual(result.powerUsage, 0.391, 'powerUsage is reported incorrect');
  });

  it('B5 response parser', function () {
    var result = parse(b5Response);

    assert.strictEqual(result.capabilities.autoMode, true, 'autoMode is reported incorrect');
    assert.strictEqual(result.capabilities.coolMode, true, 'coolMode is reported incorrect');
    assert.strictEqual(result.capabilities.dryMode, true, 'dryMode is reported incorrect');
    assert.strictEqual(result.capabilities.ecoMode, true, 'ecoMode is reported incorrect');
    assert.strictEqual(result.capabilities.leftrightFan, true, 'leftrightFan is reported incorrect');
    assert.strictEqual(result.capabilities.maxTempAuto, 30, 'maxTempAuto is reported incorrect');
    assert.strictEqual(result.capabilities.maxTempCool, 30, 'maxTempCool is reported incorrect');
    assert.strictEqual(result.capabilities.maxTempHeat, 30, 'maxTempHeat is reported incorrect');
    assert.strictEqual(result.capabilities.minTempAuto, 16, 'minTempAuto is reported incorrect');
    assert.strictEqual(result.capabilities.minTempCool, 16, 'minTempCool is reported incorrect');
    assert.strictEqual(result.capabilities.minTempHeat, 16, 'minTempHeat is reported incorrect');
    assert.strictEqual(result.capabilities.heatMode, true, 'heatMode is reported incorrect');
    assert.strictEqual(result.capabilities.turboCool, true, 'turboCool is reported incorrect');
    assert.strictEqual(result.capabilities.turboHeat, true, 'turboHeat is reported incorrect');
    assert.strictEqual(result.capabilities.updownFan, true, 'updownFan is reported incorrect');
  });
});
