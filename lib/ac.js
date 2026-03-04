'use strict';

const EventEmitter = require('events').EventEmitter;
const logger = require('winston');

const { createCommand } = require('./ac_common');
const { parse } = require('./parsers');
const reporter = require('./reporter');
const errors = require('./errors');

// Add a transport as fall back when no parent logger has been initialized
// to prevent the error: "Attempt to write logs with no transports"
logger.add(new logger.transports.Console({
  level: 'none'
}));

// module.exports = class extends SK103 {
module.exports = class extends EventEmitter {
  constructor () {
    super();

    this._initialized = false;

    this._messageId = 1;

    // Capabilities
    this.capabilities = {};

    // Status
    this.status = {};
  }

  _updateStatus (properties) {
    const self = this;
    const updates = {};

    logger.debug(`AC._updateStatus: Entering with ${JSON.stringify(properties)}`);

    for (const property in properties) {
      if (self.status[property] !== properties[property]) {
        logger.debug(`AC._updateStatus: Update ${property} from ${self.status[property]} to ${properties[property]}`);

        self.status[property] = properties[property];
        updates[property] = properties[property];
      }
    }

    return updates;
  }

  getCapabilities (retry = 0) {
    const self = this;

    logger.silly('AC.getCapabilities: Entering');

    let cmd = Buffer.from([
      0xB5, 0x01, 0x11
    ]);

    cmd = createCommand(cmd, 0x03);

    return new Promise((resolve, reject) => {
      self._request(cmd, 'getCapabilities', retry)
        .then(async response => {
          // Check this is the correct response type
          if (response[10] !== 0xB5) {
            return reject(new Error('Invalid response'));
          }

          let parsedData = parse(response);

          self._capabilities = parsedData.capabilities;

          while (parsedData.more) {
            logger.debug(`AC.getCapabilities: There are more capabilities to be retrieved (${parsedData.more})`);

            response = await this._getMoreCapabilities(parsedData.more)
              .catch(error => {
                logger.error(`AC.getCapabilities: Failed to retrieve additional capabilities (${error.message})`);
                return reject(error);
              });

            parsedData = parse(response);

            self._capabilities = parsedData.capabilities;
          }

          resolve(self._capabilities);
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  _getMoreCapabilities (num, retry = 0) {
    const self = this;

    logger.silly('AC._getMoreCapabilities: Entering');

    let cmd = Buffer.from([
      0xB5, 0x01, 0x01, 0x00
    ]);

    cmd[cmd.length - 1] = num || 1;

    cmd = createCommand(cmd, 0x03);

    return self._request(cmd, 'getMoreCapabilities', retry);
  }

  getPowerUsage (retry = 0) {
    const self = this;

    logger.silly('AC.getPowerUsage}: Entering');

    // let cmd = Buffer.from([
    //   0x41, 0x21, 0x01, 0x44, 0x00, 0x00,
    //   0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    //   0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    //   0x00, 0x00, 0x00, 0x04
    // ]);
    let cmd = Buffer.from([
      0x41, 0x21, 0x01, 0x44, 0x00, 0x01
    ]);
    // 0x41, 0x21, 0x01, 0x40 + p1, 0x00, 0x01 check status
    // 0x41, 0x21, 0x01, 0x80 + p1, 0x02, p2, p3, p4, p5 check elec
    // 0x41, 0x21, 0x01, 0x44, 0x00, 0x01

    cmd = createCommand(cmd, 0x03);

    return new Promise((resolve, reject) => {
      // Send the command
      self._request(cmd, 'getPowerUsage', retry)
        .then(response => {
          // Check this is the correct response type
          if (response[10] !== 0xC1) {
            return reject(new Error('Invalid response'));
          }

          const parsedData = parse(response);

          // Update in-memory state
          const updates = self._updateStatus(parsedData);

          if (Object.keys(updates).length) {
            self.emit('status-update', reporter(updates));
          }

          resolve(reporter(parsedData));
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  getStatus (retry = 0) {
    const self = this;

    logger.silly('AC.getStatus: Entering');

    let cmd = Buffer.from([
      0x41, 0x81, 0x00, 0xFF, 0x03, 0xFF,
      0x00, 0x02, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x03
    ]);

    // The Midea Air app uses no protocol id for this command
    cmd = createCommand(cmd, 0x03, 0x00);

    return new Promise((resolve, reject) => {
      // Send the command
      self._request(cmd, 'getStatus', retry)
        .then(response => {
          // Check this is the correct response type
          if (response[10] !== 0xC0) {
            logger.error(`AC.getStatus: Invalid response (${response.toString('hex')})`);
            return reject(new Error('Invalid response'));
          }

          const parsedData = parse(response);

          // Update in-memory state
          const updates = self._updateStatus(parsedData);

          if (Object.keys(updates).length) {
            self.emit('status-update', reporter(updates));
          }

          resolve(reporter(parsedData));
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  setStatus (properties = {}, retry = 0) {
    const self = this;

    logger.silly(`AC.setStatus: Entering with ${JSON.stringify(properties)}`);

    let cmd = Buffer.alloc(25);

    // Copy the current status
    const status = { ...self.status };

    // Enabe beep by default
    status.beep = true;

    return new Promise((resolve, reject) => {
      const mode = {
        auto: 1,
        cool: 2,
        dry: 3,
        heat: 4,
        fanonly: 5,
        customdry: 6
      };

      const fanSpeed = {
        auto: 102,
        silent: 20,
        low: 40,
        medium: 60,
        high: 80
      };

      for (const property in properties) {
        switch (property) {
          case 'beep':
            logger.debug('AC.setStatus: Enable beep');

            status.beep = properties[property] === true;
            break;

          case 'ecoMode':
            // TODO: Doesnt work need to fix, eco is only allowed in cool mode
            // if (status.mode !== 'cool' && properties.mode !== 'cool') {
            //   return reject(new errors.OutOfRangeError('ecoMode capability is only available in cool mode'));
            // }
            
            logger.debug('AC.setStatus: Enable ecoMode');

            status.ecoMode = properties[property] === true;
            break;

          case 'fanSpeed':
            if (typeof properties[property] === 'number') {
              if (properties[property] < 0 || properties[property] > 100) {
                return reject(new errors.OutOfRangeError('fanSpeed must be between 0 - 100%'));
              }
            }
            if (typeof properties[property] === 'string' && !fanSpeed[properties[property]]) {
              return reject(new errors.OutOfRangeError('fanSpeed must be one of: auto, silent, low, medium or high'));
            }

            logger.debug(`AC.setStatus: Set fan speed to ${typeof properties[property] === 'number' ? properties[property] : fanSpeed[properties[property]]}`);

            status.fanSpeed = typeof properties[property] === 'number' ? properties[property] : fanSpeed[properties[property]];
            break;

          case 'frostProtectionMode': // Requires capability frostProtectionMode and only available when mode is heat
            if (status.mode !== 'heat' && properties.mode !== 'heat') {
              return reject(new errors.OutOfRangeError('frostProtection capability is only available in heat mode'));
            }

            logger.debug(`AC.setStatus: Set frost protection mode to ${properties[property] === true}`);

            status.frostProtectionMode = properties[property] === true;
            break;

          case 'humiditySetpoint':
            if (properties[property] < 35 || properties[property] > 85) {
              return reject(new errors.OutOfRangeError('The humiditySetpoint must be between 35 - 85%'));
            }

            logger.debug(`AC.setStatus: Set humiditySetpoint to ${properties[property]}`);

            status.humiditySetpoint = properties[property];
            break;

          case 'leftrightFan':
            logger.debug(`AC.setStatus: Set left right fan to ${properties[property] === true}`);

            status.leftrightFan = properties[property] === true;
            break;

          case 'mode':
            // FIXME: Only allow modes that are available according to the capabilities
            if (!mode[properties[property]]) {
              return reject(new errors.OutOfRangeError('Mode must be one of: auto, cool, dry, heat, fanonly or customdry'));
            }

            logger.debug(`AC.setStatus: Set mode to ${mode[properties[property]]}`);

            status.mode = mode[properties[property]];
            break;

          case 'powerOn':
            logger.debug(`AC.setStatus: Set power to ${properties[property] === true}`);

            status.powerOn = properties[property] === true;
            break;

          case 'temperatureSetpoint':
            if ((status.temperatureUnit === 0 || properties.temperatureUnit === 'celsius') &&
              (properties[property] < 16 || properties[property] > 31)) {
              return reject(new errors.OutOfRangeError('The temperatureSetpoint must be between 16 - 31°C'));
            }

            if (status.temperatureUnit === 1 || properties.temperatureUnit === 'fahrenheit') {
              if (properties[property] < 60 || properties[property] > 87) {
                return reject(new errors.OutOfRangeError('The temperatureSetpoint must be between 60 - 87°F'));
              }
            }

            logger.debug(`AC.setStatus: Set temperatureSetpoint to ${properties[property]}`);

            status.temperatureSetpoint = properties[property];
            break;

          case 'sleepMode':
            logger.debug(`AC.setStatus: Set sleep mode to ${properties[property] === true}`);

            status.sleepMode = properties[property] === true;
            break;

          case 'temperatureUnit':
            if (properties[property] !== 'fahrenheit' && properties[property] !== 'celsius') {
              return reject(new errors.OutOfRangeError('The temperatureUnit must either be fahrenheit or celsius'));
            }

            logger.debug(`AC.setStatus: Set temperature unit to ${properties[property]} => ${properties[property] === 'fahrenheit' ? 0x01 : 0x00}`);

            status.temperatureUnit = properties[property] === 'fahrenheit' ? 0x01 : 0x00;
            break;

          case 'turboMode': // Requires capability strongCool and/or strongHeat
            logger.debug(`AC.setStatus: Set turbo mode to ${properties[property] === true}`);

            status.turboMode = properties[property] === true;
            break;

          case 'updownFan':
            logger.debug(`AC.setStatus: Set updown fan to ${properties[property] === true}`);

            status.updownFan = properties[property] === true;
            break;

          default:
            return reject(new errors.OutOfRangeError(`Unsupported property to be set (${property})`));
        }
      }

      cmd[0] = 0x40;

      // Byte 1
      // ABCDEFGH:
      // A: 0x00
      // B: beep (sound notification when command/query is received)
      // C: fastCheck
      // D: timerMode (not used?)
      // E: childSleep (sleep patterns for children) (not used?)
      // F: resume (not used?)
      // G: remoteControlMode (0: remote control, 1: PC) (followMe active or not???)
      // H: powerOn
      status.remoteControlMode = 1;
      cmd[1] = (status.beep ? 0x40 : 0x00) | (status.fastCheck ? 0x20 : 0x00) |
        (status.timerMode ? 0x10 : 0x00) | (status.childSleep ? 0x08 : 0x00) |
          (status.resume ? 0x04 : 0x00) | 0x02 | (status.powerOn ? 0x01 : 0x00);

      // Byte 2
      // AAABCCCC
      // A: mode
      //    0: invalid
      //    1: Auto
      //    2: Cool
      //    3: Dry
      //    4: Heat
      //    5: Fanonly
      //    6: Custom dry (automatic dehumidification)
      // B: temperatureSetpoint decimal (0.5)
      // C: temperatureSetpoint
      let setpoint = status.temperatureSetpoint;
      if (setpoint > 60) {
        // Convert Fahrenheit to Celsius
        setpoint = Math.ceil((setpoint - 32) / 1.8 * 2) / 2;
      }

      cmd[2] = (status.mode << 5) | (setpoint % 1 ? 0x10 : 0x00) | Math.floor(setpoint - 16);

      // Byte 3
      // ABBBBBBB
      // A: -
      // B: fanSpeed
      //    0 - 100: Percentage
      //    101: Fixed
      //    102: Auto
      cmd[3] = status.fanSpeed;
      logger.error(`SET FANSPEED TO ${status.fanSpeed}`);

      // Byte 4
      // ABBBBBCC
      // A: onTimer
      // B: Hours
      // C: Bits 0-1 of minutes
      const totalOnMinutes = status.onTimerHours * 60 + status.onTimerMinutes;
      let onHours = totalOnMinutes / 60;
      let onMinutes = totalOnMinutes % 60;

      if (onMinutes === 0 && onHours > 0) {
        onMinutes = 60;
        onHours--;
      }

      const onMinutesH = onMinutes / 15;
      const onMinutesL = 15 - (onMinutes % 15);

      // if (onMinutes % 15 === 0) {
      //   onMinutesL = 0;
      //   onMinutesH ? onMinutesH-- : 0;
      // }

      cmd[4] = (status.onTimer ? 0x80 : 0x00) | ((onHours & 0x1F) << 2) | (onMinutesH & 0x03);

      // Byte 5
      // ABBBBBCC
      // A: offTimer
      // B: Hours
      // C: Bits 0-1 of minutes
      const totalOffMinutes = status.offTimerHours * 60 + status.offTimerMinutes;
      let offHours = totalOffMinutes / 60;
      let offMinutes = totalOffMinutes % 60;

      if (offMinutes === 0 && offHours > 0) {
        offMinutes = 60;
        offHours--;
      }

      const offMinutesH = offMinutes / 15;
      const offMinutesL = 15 - (offMinutes % 15);

      // if (offMinutes % 15 === 0) {
      //   offMinutesL = 0;
      //   offMinutesH ? offMinutesH-- : 0;
      // }
      cmd[15] = (status.offTimer ? 0x80 : 0x00) | ((offHours & 0x1F) << 2) | (offMinutesH & 0x03);

      // Byte 6
      // AAAABBBB
      // A: Bits 2-5 of minutes on timer
      // B: Bits 2-5 of minutes off timer
      cmd[16] = ((onMinutesL & 0x0F) << 4) | (offMinutesL & 0x0F);

      // ABBBBBCC
      // A: offTimerActive
      // B: offTimerHours
      // C: offTimerMinutes bits 0/1
      cmd[5] = (status.offTimerActive ? 0x80 : 0x00) | (status.offTimerHours << 2) | (status.offTimerMinutes & 0x03);

      // AAAABBBB
      // A: timerOffMinutes bits 2-6
      // B: timerOffMinutes bits 2-6
      cmd[6] = ((status.timerOnMinutes & 0x2C) << 2) | (status.timerOffMinutes & 0x2C >> 2);

      // Byte 7
      // AAAABBCC
      // A: 3
      // B: updownFan
      // C: leftrightFan
      // From T0xAC:
      // ? 0x11 - wide angle
      // ? 0x12 - left wide angle
      // ? 0x13 - right wide angle
      // ? 0x14 - left fixed point
      // ? 0x15 - right fixed point
      // ? 0x16 - Front fixed point
      // ? 0x17 - surround stereo style
      // ? 0x18 - follow-windward
      // ? 0x19 - avoid-avoid wind
      // ? 0x20 - up and down swing
      // ? 0x21 - Swing left and right when the wind is blowing
      // ? 0x22 - side wind swing left and right
      // ???? comfort wind (0x3-left and right wind) 0x38
      // ???? comfort wind (0x3-up and down wind on the right side) 0x34
      // ???? comfort wind (0x3-left and right wind) 0x32
      // ???? comfort wind (0x3-right and left wind) 0x31
      // LEFTRIGHT: 51=0x33, 63=0x3F
      cmd[7] = 0x30 | (status.updownFan ? 0x0C : 0x00) | (status.leftrightFan ? 0x03 : 0x00);

      // Byte 8
      // ABCDEFGG
      // A: feelOwn/PersonalFeeling (not used?)
      // B: powerSaver/EnergySaving (not used?)
      // C: turboMode
      // D: lowFrequencyFan/RuiFeng (not used?)
      // E: save/PowerSaving (not used?)
      // F: alarmSleep (not used?)
      // G: cosySleep/SleepMode (00=No comfortable sleep, 01=Sleep well 1, 02=Sleep well 2, 03=Sleep 3) (not used?)
      cmd[8] = (status.feelOwn ? 0x80 : 0x00) | (status.powerSaver ? 0x40 : 0x00) |
               (status.turboMode ? 0x20 : 0x00) | (status.lowFrequencyFan ? 0x10 : 0x00) |
               (status.save ? 0x08 : 0x00) | (status.alarmSleep ? 0x04 : 0x00) |
               (status.cosySleep & 0x03);

      // Byte 9
      // ABCDEFGH
      // A: ecoMode
      // B: changeCosySleep/Toggle sleep relief curve (not used?)
      // C: cleanUp/Purification (not used?)
      // D: ptcButton/1=when the electric auxiliary heating button is pressed (not used?)
      // E: ptcHeater/Electric auxiliary heat (not used?)
      // F: dryClean (not used?)
      // G: exchangeAir/Ventilation (not used?)
      // H: wiseEye/smartEye (not used?)
      cmd[9] = (status.ecoMode ? 0x80 : 0x00) | (status.changeCosySlep ? 0x40 : 0x00) |
               (status.purify ? 0x20 : 0x00) | (status.ptcButton ? 0x10 : 0x00) |
               (status.ptcHeater ? 0x08 : 0x00) | (status.dryClean ? 0x04 : 0x00) |
               (status.ventilation ? 0x02 : 0x00) | (status.smartEye ? 0x01 : 0x00);

      // Byte 10
      // ABCDEFGH
      // A: cleanFanTime (Will be set when the filter warning is acknowledged. What will the appliance do?)
      // B: dustFull (only when nestCheck capability, a clean the filter warning will be displayed)
      // C: peakValleyElectricitySaving (not used?)
      // D: nightLight (not used?)
      // E: catchCold/Prevent Cold (not used?)
      // F: temperatureUnit (1: fahrenheit / 0: celsius)
      // G: turboMode
      // H: sleepMode
      cmd[10] = (status.cleanFanTime ? 0x80 : 0x00) | (status.dustFull ? 0x40 : 0x00) |
                (status.peakValleyElectricitySaving ? 0x20 : 0x00) | (status.nightLight ? 0x10 : 0x00) |
                (status.catchCold ? 0x08 : 0x00) | (status.temperatureUnit ? 0x04 : 0x00) |
                (status.turboMode ? 0x02 : 0x00) | (status.sleepMode ? 0x01 : 0x00);

      // Byte 11
      // AAAABBBB
      // A: setpointSecondHour (Temperature for the 2nd hour of sleep mode)
      // B: setpointFirstHour (Start temperature for the 1st hour of sleep mode)

      // Byte 12
      // AAAABBBB
      // A: setpointFourthHour (Temperature for the 4th hour of sleep mode)
      // B: setpointThirdHour (Start temperature for the 3rd hour of sleep mode)

      // Byte 13
      // AAAABBBB
      // A: setpointSixthHour (Temperature for the 6th hour of sleep mode)
      // B: setpointFifthHour (Start temperature for the 5th hour of sleep mode)

      // Byte 14
      // AAAABBBB
      // A: setpointEighthHour (Temperature for the 8th hour of sleep mode)
      // B: setpointSeventhHour (Start temperature for the 7th hour of sleep mode)

      // Byte 15
      // AAAABBBB
      // A: setpointTenthHour (Temperature for the 10th hour of sleep mode)
      // B: setpointNinthHour (Start temperature for the 9th hour of sleep mode)

      // Byte 16
      // ABCDEFGH
      // A: setpointEigthHour .5 degree
      // B: setpointSeventHour .5 degree
      // C: setpointSixthHour .5 degree
      // D: setpointFifthHour .5 degree
      // E: setpointFourthHour .5 degree
      // F: setpointThirdHour .5 degree
      // G: setpointSecondHour .5 degree
      // H: setpointFirstHour .5 degree

      // Byte 17
      // ABCDEEEE
      // A: bit 3 of PMV (0000=off, 0001=-3, 0010=-2.5, 0011=-2, 0100=-1.5, 0101=-1, 0110=-0.5, 0111=0, 1000=0.5, 1001=1, 1010=1.5, 1011=2, 1100=2.5, 1101=3)
      // B: naturalWind
      // C: setpointTenthHour .5 degree
      // D: setpointNinthHour .5 degree
      // E: sleepingHours (0-10)

      // Byte 18
      // AAABBBBB
      // A: bit 0-2 of PMV
      // B: setNewTemperature (not used?) (0=invalid, 1=13deg, 2=14deg, ...., 22=34deg)
      cmd[18] = (status.setNewTemperature - 12) & 0x1F;

      // Byte 19
      // ABBBBBBB
      // A: ??left/right fan (0=controlled by rocking left and right, 1=independent control)
      // B: humiditySetpoint (35%-85%)
      // TODO: The 19th byte bit7 is used to control the left and right swing wind. Fill in 0 by default
      cmd[19] = status.humiditySetpoint;

      // Byte 20
      // ABBBBBBB
      // TODO The 20th byte bit7 is used to control the left and right swing bit0-bit6 to set the wind speed of the purifier. Fill in 0 by default

      // Byte 21
      // ABCCCCCD
      // A: frostProtectionMode
      // B: dualControl/double_temp (not used?)
      // C: temp (not used?)
      // D: Decimal (not used?)
      cmd[21] = (status.frostProtectionMode ? 0x80 : 0x00) | (status.dualControl ? 0x40 : 0x00) |
                ((status.temp & 0x1F) << 1) | status.tempDot;

      // Byte 22
      // AAABCDEF
      // A: - (default 0b100)
      // B: windBlowing
      // C: smartWind
      // D: braceletControl (home mode status???)
      // E: braceletSleep (Link state between bracelet and sleep comfort???)
      // F: keepWarm
      cmd[22] = 0x80 | (status.windBlowing ? 0x10 : 0x00) | (status.smartWind ? 0x08 : 0x00) | (status.braceletControl ? 0x04 : 0x00) |
                (status.braceletSleep ? 0x02 : 0x00) | (status.keepWarm ? 0x01 : 0x00);

      // Byte 23

      if (++self._messageId === 256) {
        self._messageId = 1;
      }
      cmd[cmd.length - 1] = self._messageId;

      cmd = createCommand(cmd, 0x02);

      // Send the command
      self._request(cmd, 'setStatus', retry)
        .then(response => {
          const parsedData = parse(response);

          // Update in-memory state
          const updates = self._updateStatus(parsedData);

          if (Object.keys(updates).length) {
            self.emit('status-update', reporter(updates));
          }

          resolve(reporter(parsedData));
        })
        .catch(error => {
          reject(error);
        });
    });
  }
};
