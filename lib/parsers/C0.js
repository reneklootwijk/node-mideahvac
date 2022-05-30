'use strict';

const logger = require('winston');

// Add a transport as fall back when no parent logger has been initialized
// to prevent the error: "Attempt to write logs with no transports"
logger.add(new logger.transports.Console({
  level: 'none'
}));

exports.parser = (data) => {
  const status = {};

  logger.debug(`C0.parser: Entering with ${data.toString('hex')} - ${data.length}`);

  if (data.length < 19) {
    logger.error(`C0.parser: Invalid data length (${data.length})`);
    return status;
  }

  // Byte 1
  // ABCDEFGH
  // A: inError
  // B: -
  // C: fastCheck
  // D: timerMode (0: relative, 1: absolute)
  // E: resume
  // F: -
  // G: -
  // H: powerOn
  status.inError = (data[1] & 0x80) === 0x80;
  status.byte1bit6 = (data[1] & 0x40) >> 6;
  status.fastCheck = (data[1] & 0x20) === 0x20;
  status.timerMode = (data[1] & 0x10) >> 4;
  status.resume = (data[1] & 0x04) === 0x04;
  status.byte1bit2 = (data[1] & 0x04) >> 3;
  status.byte1bit1 = (data[1] & 0x02) >> 2;
  status.powerOn = (data[1] & 0x01) === 0x01;

  // Byte 2
  // AAABCCCC
  // A: mode
  // B: decimal (0.5) of temperatureSetpoint
  // C: degrees of temperatureSetpoint - 16
  status.temperatureSetpoint = (data[2] & 0x0F) + 16 + ((data[2] & 0x10) >> 4) * 0.5;
  status.mode = (data[2] & 0xE0) >> 5;

  // Byte 3
  // ABBBBBBB
  // A: -
  // B: fanSpeed 0 - 100%, 101: Fixed, 102: Auto
  status.byte3bit7 = (data[3] & 0x80) >> 7;
  status.fanSpeed = data[3] & 0x7F;

  // Byte 4
  // ABBBBBCC
  // A: onTimer
  // B: onTimerHours
  // C: onTimer quarters
  // Byte 5
  // ABBBBBCC
  // A: offTimer
  // B: offTimerHours
  // C: offTimer quarters
  // Byte 6
  // AAAABBBB
  // A: onTimer minutes elapsed
  // B: offTimer minutes elapsed
  status.onTimer = (data[4] & 0x80) === 0x80;
  status.offTimer = (data[5] & 0x80) === 0x80;

  status.onTimerHours = status.onTimer ? (data[4] & 0x7C) >> 2 : 0;
  status.onTimerMinutes = status.onTimer ? ((data[4] & 0x03) + 1) * 15 - (data[6] >> 4) : 0;
  if (status.onTimerMinutes === 60) {
    status.onTimerMinutes = 0;
    status.onTimerHours++;
  }

  status.offTimerHours = status.offTimer ? (data[5] & 0x7C) >> 2 : 0;
  status.offTimerMinutes = status.offTimer ? ((data[5] & 0x03) + 1) * 15 - (data[6] & 0x0F) : 0;
  if (status.offTimerMinutes === 60) {
    status.offTimerMinutes = 0;
    status.offTimerHours++;
  }

  // Byte 7
  // AAAABBCC
  // A: - (default 0b0011)
  // B: updownFan
  // C: leftrightFan
  // From T0xAC: comfortable wind
  // 0x11: wide angle
  // 0x12: left wide angle
  // 0x13: right wide angle
  // 0x14: left fixed point
  // 0x15: right fixed point
  // 0x16: Front fixed point
  // 0x17: Surrounding the three-dimensional wind
  // 0x18: Follow-windward
  // 0x19: Avoid-avoid wind
  // 0x20: Swing up and down when the wind is out
  // 0x21: Swing left and right when the wind is out
  // 0x22: Swing from side to side
  status.byte7bit47 = (data[7] & 0xF0) >> 4;
  status.leftrightFan = (data[7] & 0x03) === 0x03;
  status.updownFan = (data[7] & 0x0C) === 0x0C;

  //  Byte 8
  // ABCDEFGG
  // A: feelOwn (Is this using the RC as remote temperature sensor???) (personalFeeling -> portable??)
  // B: wiseEye/smartEye (not used??)
  // C: turbo2
  // D: lowFrequencyFan (silence mode???)
  // E: save
  // F: -
  // G: cosySleep (sleepMode)
  status.feelOwn = (data[8] & 0x80) === 0x80;
  status.smartEye = (data[8] & 0x40) === 0x40;
  const turbo2 = (data[8] & 0x20) === 0x20;
  status.lowFrequencyFan = (data[8] & 0x10) === 0x10;
  status.save = (data[8] & 0x08) === 0x08;
  status.byte8bit2 = (data[8] & 0x40) >> 2;
  status.cosySleep = data[8] & 0x03;

  // Byte 9
  // ABCDEFGH
  // A: selfFeelOwn (selfPersonalFeeling -> device is portable??)
  // B: selfCosySleep (selfSleep) (seems a bug on the Midea code, is assigned to sleepFunc)
  // C: purify
  // D: ecoMode
  // E: ptcHeater
  // F: dryClean
  // G: naturalFan (naturalWind)
  // H: childSleep (sleep patterns for children)
  status.selfFeelOwn = (data[9] & 0x80) === 0x80;
  status.selfCosySleep = (data[9] & 0x40) === 0x40;
  status.purify = (data[9] & 0x20) === 0x20;
  status.ecoMode = (data[9] & 0x10) === 0x10;
  status.ptcHeater = (data[9] & 0x08) === 0x08;
  status.dryClean = (data[9] & 0x04) === 0x04;
  status.naturalFan = (data[9] & 0x02) === 0x02;
  status.childSleep = (data[9] & 0x01) === 0x01;

  // Byte 10
  // ABCDEFGH
  // A: coolFan (coolWind)
  // B: peakValleyElectricitySaving
  // C: catchCold/Prevent Cold
  // D: nightLight
  // E: ventilation (exchange air)
  // F: temperatureUnit
  // G: turboMode
  // H: sleepMode (sleepFunctionStatus)
  status.coolFan = (data[10] & 0x80) === 0x80;
  status.peakValleyElectricitySaving = (data[10] & 0x40) === 0x40;
  status.catchCold = (data[10] & 0x20) === 0x20;
  status.nightLight = (data[10] & 0x10) === 0x10;
  status.ventilation = (data[10] & 0x08) === 0x08;
  status.temperatureUnit = (data[10] & 0x04) >> 2;
  status.turboMode = (((data[10] & 0x02) === 0x02) | turbo2) === 0x01;
  status.sleepMode = (data[10] & 0x01) === 0x01;

  // Byte 11
  // AAAAAAAA
  // A: indoorTemperature
  status.indoorTemperature = (data[11] - 50) / 2;

  // Byte 12
  // AAAAAAAA
  // A: outdoorTemperature
  status.outdoorTemperature = (data[12] - 50) / 2;

  // Byte 13
  // ABCDDDDD
  // A: -
  // B: -
  // C: dustFull (dustFullMark)
  // D: temperatureSetpoint2
  status.byte13bit7 = (data[13] & 0x80) >> 7;
  status.byte13bit6 = (data[13] & 0x40) >> 6;
  status.dustFull = (data[13] & 0x20) === 0x20;
  if ((data[13] & 0x1F) > 0) {
    status.temperatureSetpoint = (data[13] & 0x1F) + 12;
  }

  // Byte 14
  // ABBBCCCC
  // A: -
  // B: light
  //      0: on, brightest
  //      1: on, dim level 1
  //      2: on, dim level 2
  //      3: on, dim level 3
  //      4: on, dim level 4
  //      5: on, dim level 5
  //      6: on, dim level 6
  //      7: Off
  // C: pmv ("Predicted Mean Vote", experienced temperature)
  //    Values for pmv:
  //      0: "PMV off"
  //      1: "PMV=-3" cold
  //      2: "PMV=-2.5"
  //      3: "PMV=-2" chill
  //      4: "PMV=-1.5"
  //      5: "PMV=-1" cool
  //      6: "PMV=-0.5"
  //      7: "PMV=0" comfortable
  //      8: "PMV=0.5"
  //      9: "PMV=1" slightly warm
  //      10: "PMV=1.5"
  //      11: "PMV=2" warm
  //      12: "PMV=2.5"
  status.byte14bit7 = (data[14] & 0x80) >> 7;
  status.light = (data[14] & 0x70) >> 4;
  status.pmv = data[14] & 0x0F;

  // Byte 15
  // AAAABBBB
  // A: outdoorTemperatureDecimal
  // B: indoorTemperatureDecimal
  const indoorTemperatureDecimal = data[15] & 0x0F;
  const outdoorTemperatureDecimal = (data[15] & 0xF0) >> 4;

  if (status.indoorTemperature > 0) {
    status.indoorTemperature += (indoorTemperatureDecimal / 10);
  } else {
    status.indoorTemperature -= (indoorTemperatureDecimal / 10);
  }

  if (status.outdoorTemperature > 0) {
    status.outdoorTemperature += (outdoorTemperatureDecimal / 10);
  } else {
    status.outdoorTemperature -= (outdoorTemperatureDecimal / 10);
  }

  // Byte 16
  // AAAAAAAA
  // A: statusCode
  // Status codes:
  //  0:  "OK"
  //  1:  "Interior board and display board communication failure"
  //  2:  "Indoor main control board E party failure"
  //  3:  "Indoor board and Outdoor board communication failure"
  //  4:  "Zero crossing detection failure"
  //  5:  "Indoor board fan stall failure"
  //  6:  "Outdoor condenser sensor failure"
  //  7:  "Outdoor ambient temperature sensor failure"
  //  8:  "Outdoor compression Engine exhaust temperature sensor failure"
  //  9:  "Outdoor E side failure"
  //  10: "Indoor temperature sensor failure"
  //  11: "Indoor evaporator temperature sensor failure"
  //  12: "Outdoor wind speed stall failure"
  //  13: "IPM Module protection"
  //  14: "Voltage protection"
  //  15: "Outdoor compressor top temperature protection"
  //  16: "Outdoor temperature low protection"
  //  17: "Compressor position protection"
  //  18: "Display board E side fault"
  //  21: "Outer pipe temperature protection"
  //  23: "Exhaust high temperature protection"
  //  25: "Heating and cold wind protection"
  //  26: "Current protection"
  //  29: "Evaporator high and low temperature protection"
  //  30: "Condenser High and low temperature protection frequency limit"
  //  31: "Exhaust high and low temperature protection"
  //  32: "Indoor and outdoor communication mismatch protocol"
  //  33: "Refrigerant leakage protection"
  status.statusCode = data[16];

  // Byte 17
  // AAAAAABB
  // A: ecoSleepRunningMinutes
  // B: ecoSleepRunningSeconds (part 1)
  status.ecoSleepRunningMinutes = (data[17] & 0xFC) >> 3;

  // Byte 18
  // AAAABBBB
  // A: ecoSleepRunningSeconds (part 2)
  // B: ecoSleepRunningHours
  // ecoSleepRunningSecond = ecoSleepRunningSecond1 << 2 | ecoSleepRunningSecond0
  status.ecoSleepRunningSeconds = (data[18] & 0xF0) >> 2 | data[17] & 0x02;
  status.ecoSleepRunningHours = data[18] & 0x0F;

  if (data.length >= 20) {
    // Byte 19
    // ABBBBBBB
    // A: downWindControl
    // B: humiditySetpoint
    status.downWindControl = (data[19] & 0x80) === 0x80;
    status.humiditySetpoint = data[19] & 0x7F;

    // Byte 20
    // ABBBBBBB
    // A downWindControlLR (downWind)
    // B -
    status.downWindControlLR = (data[20] & 0x80) === 0x80;
    status.byte20bit06 = data[20] & 0x7F;

    // Byte 21
    // ABCCCCCD
    // A: frostProtection
    // B: dualControl
    // C: temp (???)
    // D: tempDecimal (???)
    status.frostProtection = (data[21] & 0x80) === 0x80;
    status.dualControl = (data[21] & 0x40) === 0x40;
    status.temp = (data[21] & 0x3E) >> 1;
    status.tempDecimal = (data[21] & 0x01) === 0x01;

    if (data.length >= 23) {
      // Byte 22
      // AAABCDEF
      // A: - (default 0b111)
      // B: windBlowing
      // C: smartWind
      // D: braceletControl
      // E: braceletSleep
      // F: keepWarm (readyColdOrHot)
      status.byte22bit57 = (data[22] & 0xE0) >> 5;
      status.windBlowing = (data[22] & 0x10) === 0x10;
      status.smartWind = (data[22] & 0x08) === 0x08;
      status.braceletControl = (data[22] & 0x04) === 0x04;
      status.braceletSleep = (data[22] & 0x02) === 0x02;
      status.keepWarm = (data[22] & 0x01) === 0x01;
    }
  }

  // Correct temperature when unit is set to Fahrenheit
  if (status.temperatureUnit) {
    status.temperatureSetpoint = Math.round(status.temperatureSetpoint * 1.8 + 32);
    status.indoorTemperature = Math.round(status.indoorTemperature * 1.8 + 32);
    status.outdoorTemperature = Math.round(status.outdoorTemperature * 1.8 + 32);
  }

  return status;
};
