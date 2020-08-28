'use strict'

const EventEmitter = require('events').EventEmitter
const logger = require('winston')

const { calculateCrc, calculateCheckSum } = require('./common')
const { parse } = require('./parsers')
const errors = require('./errors')

// Add a transport as fall back when no parent logger has been initialized
// to prevent the error: "Attempt to write logs with no transports"
logger.add(new logger.transports.Console({
  level: 'none'
}))

function addHeader (data, cmdType = 0x03) {
  const header = Buffer.from([
    0xAA, 0x00, 0xAC, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, cmdType
  ])

  const packet = Buffer.concat([header, data])

  packet[1] = packet.length

  return packet
}

function createCommand (data, cmdType) {
  let cmd
  // Append crc
  cmd = Buffer.concat([data, Buffer.from([calculateCrc(data)])])

  // Prepend header
  cmd = addHeader(cmd, cmdType)

  // Append checksum
  cmd = Buffer.concat([cmd, Buffer.from([calculateCheckSum(cmd)])])

  return cmd
}

function reportProperties (properties) {
  const modes = ['no sleep', 'sleep 1', 'sleep 2', 'sleep 3']
  const report = {}

  for (const property in properties) {
    switch (property) {
      case 'timerMode':
        report[property] = properties[property] ? { value: 1, description: 'absolute' } : { value: 0, description: 'relative' }
        break

      case 'mode':
        switch (properties[property]) {
          case 1:
            report.mode = { value: 1, description: 'auto' }
            break

          case 2:
            report.mode = { value: 2, description: 'cool' }
            break

          case 3:
            report.mode = { value: 3, description: 'dry' }
            break

          case 4:
            report.mode = { value: 4, description: 'heat' }
            break

          case 5:
            report.mode = { value: 5, description: 'fanonly' }
            break

          default:
            report.mode = { value: properties[property], description: 'invalid mode' }
        }
        break

      case 'fanSpeed':
        switch (properties[property]) {
          case 20:
            report.fanSpeed = { value: 20, description: 'silent' }
            break

          case 40:
            report.fanSpeed = { value: 40, description: 'low' }
            break

          case 60:
            report.fanSpeed = { value: 60, description: 'medium' }
            break

          case 80:
            report.fanSpeed = { value: 80, description: 'high' }
            break

          case 101:
            report.fanSpeed = { value: 101, description: 'fixed' }
            break

          case 102:
            report.fanSpeed = { value: 102, description: 'auto' }
            break

          default:
            report.fanSpeed = { value: properties[property], description: 'unknown' }
        }
        break

      case 'cosySleepMode':
        report.cosySleepMode = { value: properties[property], description: modes[properties[property]] }
        break

      case 'temperatureUnit':
        report.temperatureUnit = { value: properties[property], description: properties[property] ? 'fahrenheit' : 'celcius' }
        break

      case 'errorCode':
        switch (properties[property]) {
          case 0:
            report.errorCode = { value: 0, description: '' }
            break

          case 1:
            report.errorCode = { value: 1, description: 'interior board and display board communication failure' }
            break

          case 2:
            report.errorCode = { value: 2, description: 'indoor main control board failure' }
            break

          case 3:
            report.errorCode = { value: 3, description: 'indoor board and outdoor board communication failure' }
            break

          case 4:
            report.errorCode = { value: 4, description: 'zero crossing detection failure' }
            break

          case 5:
            report.errorCode = { value: 5, description: 'indoor board fan stall failure' }
            break

          case 6:
            report.errorCode = { value: 6, description: 'outdoor condenser sensor failure' }
            break

          case 7:
            report.errorCode = { value: 7, description: 'outdoor ambient temperature sensor failure' }
            break

          case 8:
            report.errorCode = { value: 8, description: 'outdoor compression engine exhaust temperature sensor failure' }
            break

          case 9:
            report.errorCode = { value: 9, description: 'outdoor failure' }
            break

          case 10:
            report.errorCode = { value: 10, description: 'indoor temperature sensor failure' }
            break

          case 11:
            report.errorCode = { value: 11, description: 'indoor evaporator temperature sensor failure' }
            break

          case 12:
            report.errorCode = { value: 12, description: 'outdoor wind speed stall failure' }
            break

          case 13:
            report.errorCode = { value: 13, description: 'ipm module protection' }
            break

          case 14:
            report.errorCode = { value: 14, description: 'Voltage protection' }
            break

          case 15:
            report.errorCode = { value: 15, description: 'outdoor compressor top temperature protection' }
            break

          case 16:
            report.errorCode = { value: 16, description: 'outdoor temperature too low protection' }
            break

          case 17:
            report.errorCode = { value: 17, description: 'compressor position protection' }
            break

          case 18:
            report.errorCode = { value: 18, description: 'display panel fault' }
            break

          case 21:
            report.errorCode = { value: 21, description: 'outer pipe temperature protection' }
            break

          case 23:
            report.errorCode = { value: 23, description: 'exhaust high temperature protection' }
            break

          case 25:
            report.errorCode = { value: 25, description: 'heating and cold wind protection' }
            break

          case 26:
            report.errorCode = { value: 26, description: 'current protection' }
            break

          case 29:
            report.errorCode = { value: 29, description: 'evaporator high and low temperature protection' }
            break

          case 30:
            report.errorCode = { value: 30, description: 'condenser high and low temperature protection frequency limit' }
            break

          case 31:
            report.errorCode = { value: 31, description: 'exhaust high and low temperature protection' }
            break

          case 32:
            report.errorCode = { value: 32, description: 'indoor and outdoor communication mismatch protocol' }
            break

          case 33:
            report.errorCode = { value: 33, description: 'refrigerant leakage protection' }
            break

          default:
            report.errorCode = { value: properties[property], description: 'unknown error' }
        }
        break

      default:
        report[property] = properties[property]
    }
  }

  return report
}

module.exports = class extends EventEmitter {
  constructor (options = {}) {
    super()

    this._initialized = false

    this._messageId = 1

    // Capabilities
    this.capabilities = {}

    // Status
    this.status = {}
  }

  _updateStatus (properties) {
    var self = this
    const updates = {}

    logger.silly(`AC._updateStatus: Entering with ${JSON.stringify(properties)}`)

    for (const property in properties) {
      if (self.status[property] !== properties[property]) {
        self.status[property] = properties[property]
        updates[property] = properties[property]
      }
    }

    return updates
  }

  getCapabilities (retry = false) {
    var self = this

    let cmd = Buffer.from([
      0xB5, 0x01, 0x11
    ])

    cmd = createCommand(cmd, 0x03)

    return new Promise((resolve, reject) => {
      self._request(cmd, 'getCapabilities', retry)
        .then(response => {
          // Check this is the correct response type
          if (response[10] !== 0xB5) {
            return reject(new Error('Invalid response'))
          }

          const parsedData = parse(response)

          // Persist capability list in-memory
          self._capabilities = parsedData

          resolve(parsedData)
        })
        .catch(error => {
          reject(error)
        })
    })
  }

  getStatus (retry = false, emitUpdates = true) {
    var self = this
    // Traced between adapter and module but it does not work when send via the cloud
    // let cmd = Buffer.from([
    //   0x41, 0x81, 0x00, 0xFF, 0x03, 0xFF,
    //   0x00, 0x02, 0x00, 0x00, 0x00, 0x00,
    //   0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    //   0x00, 0x00, 0x03
    // ])

    // Seems the frame byte (20) is not supported
    let cmd = Buffer.from([
      0x41, 0x21, 0x00, 0xFF, 0x00, 0xFF,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00
    ])

    // `This results in a C1 response (caused by the 0x44)
    // let cmd = Buffer.from([
    //   0x41, 0x21, 0x01, 0x44, 0x00, 0x00,
    //   0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    //   0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    //   0x00, 0x00, 0x01
    // ])

    cmd = createCommand(cmd, 0x03)

    return new Promise((resolve, reject) => {
      // Send the command
      self._request(cmd, 'getStatus', retry)
        .then(response => {
          // Check this is the correct response type
          if (response[10] !== 0xC0) {
            return reject(new Error('Invalid response'))
          }

          const parsedData = parse(response)

          // Update in-memory state
          const updates = self._updateStatus(parsedData)

          if (emitUpdates && Object.keys(updates).length) {
            self.emit('status-update', reportProperties(updates))
          }

          resolve(reportProperties(parsedData))
        })
        .catch(error => {
          reject(error)
        })
    })
  }

  setStatus (properties = {}, retry = false, emitUpdates = true) {
    var self = this
    let cmd = Buffer.alloc(25)

    // Copy the current status
    const status = { ...self.status }

    // Enabe beep by default
    status.beep = true

    return new Promise((resolve, reject) => {
      const mode = {
        auto: 1,
        cool: 2,
        dry: 3,
        heat: 4,
        fanonly: 5
      }

      const fanSpeed = {
        auto: 102,
        silent: 20,
        low: 40,
        medium: 60,
        high: 80
      }

      for (const property in properties) {
        switch (property) {
          case 'beep':
            status.beep = properties[property] === true
            break

          case 'fanSpeed':

            if (!fanSpeed[properties[property]]) {
              return reject(new errors.OutOfRangeError('fanSpeed must be one of: auto, silent, low, medium or high'))
            }

            status.fanSpeed = fanSpeed[properties[property]]
            break

          case 'frostProtectionModeActive': // Requires capability frostProtectionMode and only available when mode is heat
            if (status.mode !== 'heat' && properties.mode !== 'heat') {
              return reject(new errors.OutOfRangeError('frostProtection capability is only available in heat mode'))
            }

            status.frostProtectionModeActive = properties[property] === true
            break

          case 'horizontalSwingActive':
            status.horizontalSwingActive = properties[property] === true
            break

          case 'mode':
            // FIXME: Only allow modes that are available according to the capabilities
            if (!mode[properties[property]]) {
              return reject(new errors.OutOfRangeError('Mode must be one of: auto, cool, dry, heat or fanonly'))
            }

            status.mode = mode[properties[property]]
            break

          case 'powerOn':
            status.powerOn = properties[property] === true
            break

          case 'setpoint':
            if (properties[property] < 16 || properties[property] > 31) {
              return reject(new errors.OutOfRangeError('The setpoint must be between 16 - 31°C'))
            }

            status.setpoint = properties[property]
            break

          case 'sleepModeActive':
            status.sleepModeActive = properties[property] === true
            break

          case 'turboModeActive': // Requires capability strongCool and/or strongHeat
            status.turboModeActive = properties[property] === true
            break

          case 'verticalSwingActive':
            status.verticalSwingActive = properties[property] === true
            break

          default:
            return reject(new errors.OutOfRangeError(`Unsupported property to be set (${property})`))
        }
      }

      cmd[0] = 0x40

      // ABCDEFGH:
      // A: 0x00
      // B: beep
      // C: fastCheckActive
      // D: timerMode
      // E: childSleepMode
      // F: resumeActive
      // G: remoteControlMode (0: remote control, 1: PC)
      // H: powerOn
      status.remoteControlMode = 1
      cmd[1] = (status.beep ? 0x40 : 0x00) | (status.fastCheckActive ? 0x20 : 0x00) |
        (status.timerMode ? 0x10 : 0x00) | (status.childSleepMode ? 0x08 : 0x00) |
          (status.resume ? 0x04 : 0x00) | (status.remoteControlMode ? 0x02 : 0x00) |
            (status.powerOn ? 0x01 : 0x00)

      // AAABCCCC
      // A: mode
      // B: setpoint decimal (0.5)
      // C: setpoint - 16
      cmd[2] = (status.mode << 5) | (status.setpoint % 1 ? 0x10 : 0x00) | Math.floor(status.setpoint - 16)

      //  fanSpeed
      cmd[3] = status.fanSpeed

      // ABBBBBCC
      // A: onTimerActive
      // B: onTimerHours / 15???
      // C: onTimerMinutes bits 0/1
      cmd[4] = (status.onTimerActive ? 0x80 : 0x00) | ((status.onTimerHours / 15) << 2) | (status.onTimerMinutes & 0x03)

      // ABBBBBCC
      // A: offTimerActive
      // B: offTimerHours / 15???
      // C: offTimerMinutes bits 0/1
      cmd[5] = (status.offTimerActive ? 0x80 : 0x00) | ((status.offTimerHours / 15) << 2) |
        (status.offTimerMinutes & 0x03)

      // AAAABBBB
      // A: timerOffMinutes bits 2-6
      // B: timerOffMinutes bits 2-6
      cmd[6] = ((status.timerOnMinutes & 0x2C) << 2) | (status.timerOffMinutes & 0x2C >> 2)

      // AAAABBCC
      // A: 0x03
      // B: horizontalSwingActive ? 3 : 0
      // C: verticalSwingActive ? 3 : 0
      cmd[7] = 0x30 | (status.horizontalSwingActive ? 0xC0 : 0x00) | (status.verticalSwingActive ? 0x03 : 0x00)

      // ABCDEFGG
      // A: personalFeeling
      // B: powerSave
      // C: strong
      // D: lowFrequencyFan
      // E: save
      // F: alarmSleep
      // G: cosySleepMode
      cmd[8] = (status.personalFeeling ? 0x80 : 0x00) | (status.powerSave ? 0x40 : 0x00) |
        (status.strong ? 0x20 : 0x00) | (status.lowFrequencyFan ? 0x10 : 0x00) |
          (status.save ? 0x08 : 0x00) | (status.alarmSleep ? 0x04 : 0x00) |
            (status.cosySleepMode & 0x03)

      // ABCDEFGH
      // A: ecoModeActive
      // B: 0x00
      // C: purifyingModeActive
      // D: pctButton
      // E: ptcHeaterActive
      // F: dryClean
      // G: naturalWindModeActive
      // H: wiseEye
      cmd[9] = (status.ecoModeActive ? 0x80 : 0x00) | (status.purifyingModeActive ? 0x40 : 0x00) |
        (status.ptcHeaterActive ? 0x08 : 0x00) | (status.dryClean ? 0x04 : 0x00) |
          (status.naturalWindActive ? 0x02 : 0x00) | (status.wiseEye ? 0x01 : 0x00)

      // ABCDEFGH
      // A: cleanFanTime
      // B: dustFull
      // C: peakValleyMode
      // D: nightLight
      // E: catchCold
      // F: temperatureUnit (fahrenheit / celcius)
      // G: turboModeActive
      // H: sleepModeActive
      cmd[10] = (status.dustFull ? 0x40 : 0x00) | (status.peakValleyMode ? 0x20 : 0x00) |
        (status.nightLight ? 0x10 : 0x00) | (status.catchCold ? 0x08 : 0x00) |
        (status.temperatureUnit ? 0x04 : 0x00) | (status.turboModeActive ? 0x02 : 0x00) |
        (status.sleepModeActive ? 0x01 : 0x00)

      // AAAABBBB
      // A: sleepCurveTempPhase2
      // B: sleepCurveTempPhase1
      cmd[11] = 0x00

      // AAAABBBB
      // A: sleepCurveTempPhase4
      // B: sleepCurveTempPhase3
      cmd[12] = 0x00

      // AAAABBBB
      // A: sleepCurveTempPhase6
      // B: sleepCurveTempPhase5
      cmd[13] = 0x00

      // AAAABBBB
      // A: sleepCurveTempPhase8
      // B: sleepCurveTempPhase7
      cmd[14] = 0x00

      // AAAABBBB
      // A: sleepCurveTempPhase10
      // B: sleepCurveTempPhase9
      cmd[15] = 0x00

      // ABCDEFGH
      // A: tempUnitPhase8
      // B: tempUnitPhase7
      // C: tempUnitPhase6
      // D: tempUnitPhase5
      // E: tempUnitPhase4
      // F: tempUnitPhase3
      // G: tempUnitPhase2
      // H: tempUnitPhase1
      cmd[16] = 0x00

      // ABCDEEEE
      // A: pmv
      // B: natWind
      // C: tenHours
      // D: nightHours
      // E: sleepTime
      cmd[17] = 0x00

      // AAABBBB
      // A: pmv
      // B: temperature
      cmd[18] = 0x00

      // ABBBBBBB
      // A: humidityControlOnly
      // B: humidity
      cmd[19] = 0x00

      // ABBBBBBB
      // A: leftright
      // B: speed
      cmd[20] = 0x00

      // ABCCCCCD
      // A: frostProtectionModeActive
      // B: twoControl
      // C: temp
      // D: tempDot
      cmd[21] = status.frostProtectionModeActive ? 0x80 : 0x00

      // AAAAAAAA
      // A: 0x00
      cmd[22] = 0x00

      // TODO: Setting byte 23 results for some commands in error 9999
      if (++self._messageId === 256) {
        self._messageId = 1
      }
      // cmd[23] = self._messageId

      cmd = createCommand(cmd, 0x02)

      // Send the command
      self._request(cmd, 'setStatus', retry)
        .then(response => {
          const parsedData = parse(response)

          // Update in-memory state
          const updates = self._updateStatus(parsedData)

          if (emitUpdates && Object.keys(updates).length) {
            self.emit('status-update', updates)
          }

          resolve(reportProperties(parsedData))
        })
        .catch(error => {
          reject(error)
        })
    })
  }
}
