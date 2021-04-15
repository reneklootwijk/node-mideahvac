'use strict'

const EventEmitter = require('events').EventEmitter
const logger = require('winston')

const { createCommand } = require('./ac_common')
const errors = require('./errors')
const { parse } = require('./parsers')
const reporter = require('./reporter')

// Add a transport as fall back when no parent logger has been initialized
// to prevent the error: "Attempt to write logs with no transports"
logger.add(new logger.transports.Console({
  level: 'none'
}))

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
        logger.debug(`AC._updateStatus: Update ${property} from ${self.status[property]} to ${properties[property]}`)

        self.status[property] = properties[property]
        updates[property] = properties[property]
      }
    }

    return updates
  }

  getCapabilities (retry = false) {
    var self = this

    let cmd = Buffer.from([
      0xB5, 0x01, 0x01, 0x01
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

  // This command is only supported in serialbridge mode, the SmartKey will not
  // forward it
  getElectronicId () {
    var self = this

    let cmd = Buffer.from([0x00])

    cmd = createCommand(cmd, 0x07, 0xFF, false)

    return new Promise((resolve, reject) => {
      self._request(cmd, 'getElectronicId')
        .then(response => {
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  }

  getPowerUsage (retry = false, emitUpdates = true) {
    var self = this
    let cmd = Buffer.from([
      0x41, 0x21, 0x01, 0x44, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x04
    ])

    cmd = createCommand(cmd, 0x03)

    return new Promise((resolve, reject) => {
      // Send the command
      self._request(cmd, 'getPowerUsage', retry)
        .then(response => {
          // Check this is the correct response type
          if (response[10] !== 0xC1) {
            return reject(new Error('Invalid response'))
          }

          const parsedData = parse(response)

          // Update in-memory state
          const updates = self._updateStatus(parsedData)

          if (emitUpdates && Object.keys(updates).length) {
            self.emit('status-update', reporter(updates))
          }

          resolve(reporter(parsedData))
        })
        .catch(error => {
          reject(error)
        })
    })
  }

  getStatus (retry = false, emitUpdates = true) {
    var self = this

    let cmd = Buffer.from([
      0x41, 0x81, 0x00, 0xFF, 0x03, 0xFF,
      0x00, 0x02, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x03
    ])

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
            self.emit('status-update', reporter(updates))
          }

          resolve(reporter(parsedData))
        })
        .catch(error => {
          reject(error)
        })
    })
  }

  // This command is only supported in serialbridge mode, the SmartKey will not
  // forward it
  // This message is send when the status of the network connection changes
  // or on response on a request of the AC unit (message type 0x63)
  // Sending this update show the WiFi symbol on the display of the unit
  sendNetworkStatusNotification () {
    var self = this
    let cmd = Buffer.alloc(20)

    // Byte 0: Module type:
    // - 0x00 RF module
    // - 0x01 WiFi module
    cmd[0] = 0x01

    // Byte 1: WiFi module working mode:
    // - 0x01 Client mode
    // - 0x02 Configuration mode
    // - 0x03 AP mode
    cmd[1] = 0x01

    // Byte 2: WiFi signal strength
    // - 0x00 No signal
    // - 0x01 Weak
    // - 0x02 Low
    // - 0x03 Medium
    // - 0x04 Strong
    // - 0xFF WiFi is not supported
    cmd[2] = 0x04

    // Byte 3-6: IP address of client in reverse order
    let digits = {}
    if (self._connection && self._connection.address) {
      digits = self._connection.address().address.split('.')
    }
    if (digits.length === 4) {
      cmd[3] = digits[3]
      cmd[4] = digits[2]
      cmd[5] = digits[1]
      cmd[6] = digits[0]
    } else {
      cmd[3] = 1
      cmd[4] = 0
      cmd[5] = 0
      cmd[6] = 127
    }

    // Byte 7: RF Signal strength
    // - 0x00, no signal
    // - 0x01, weak
    // - 0x02, low
    // - 0x03, medium
    // - 0x04, strong
    // - 0xFF, RF is not supported
    cmd[7] = 0xFF

    // Byte 8: Router status
    // - 0x00, wireless router is connected
    // - 0x01, wireless router not connected
    // - 0x02, connecting to a wireless router
    // - 0x03, password verification error
    // - 0x04, no wireless router found
    // - 0x05, IP cannot be obtained
    // - 0x06, wireless unstable
    //  - 0xFF, WI-FI failure
    cmd[8] = 0x00

    // Byte 9: Cloud service connection status:
    // - 0x00, connected to the cloud service center
    // - 0x01, not connected to the cloud service center
    // - 0x02, unstable internet connection
    // - 0x03, domain name resolution error
    // - 0x04, cloud service connection refused
    // - 0x05, cloud service maintenance
    // - 0xFF, cloud service failure
    cmd[9] = 0x01

    // Byte 10: Direct LAN connection status
    // - 0x00: No connection/connection has been disconnected
    // - 0x01: connected/connected with mobile terminal
    cmd[10] = 0x01

    // Byte 11 Number of TCP connections between the module and the mobile terminal
    cmd[11] = 0x01

    // Byte 12 - 19 Reserved
    cmd[12] = 0x00
    cmd[13] = 0x00
    cmd[14] = 0x00
    cmd[15] = 0x00
    cmd[16] = 0x00
    cmd[17] = 0x00
    cmd[18] = 0x00
    cmd[19] = 0x00

    cmd = createCommand(cmd, 0x0D, 0xAC, false)

    return new Promise((resolve, reject) => {
      self._request(cmd, 'sendNetworkStatusNotification')
        .then(response => {
          resolve(response)
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
            if ((status.temperatureUnit === 0 || properties.temperatureUnit === 'celsius') &&
              (properties[property] < 16 || properties[property] > 31)) {
              return reject(new errors.OutOfRangeError('The setpoint must be between 16 - 31°C'))
            }

            if (status.temperatureUnit === 1 || properties.temperatureUnit === 'fahrenheit') {
              if (properties[property] < 60 || properties[property] > 87) {
                return reject(new errors.OutOfRangeError('The setpoint must be between 60 - 87°F'))
              }
            }

            status.setpoint = properties[property]
            break

          case 'sleepModeActive':
            status.sleepModeActive = properties[property] === true
            break

          case 'temperatureUnit':
            if (properties[property] !== 'fahrenheit' && properties[property] !== 'celsius') {
              return reject(new errors.OutOfRangeError('The temperatureUnit must either be fahrenheit or celsius'))
            }

            status.temperatureUnit = properties[property] === 'fahrenheit' ? 0x01 : 0x00
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
      // C: setpoint
      let setpoint = status.setpoint
      if (setpoint > 60) {
        // Convert Fahrenheit to celsius
        setpoint = Math.ceil((setpoint - 32) / 1.8 * 2) / 2
      }

      cmd[2] = (status.mode << 5) | (setpoint % 1 ? 0x10 : 0x00) | Math.floor(setpoint - 16)

      // ABBBBBBB
      // A: timerEffe?
      // B: fanSpeed
      cmd[3] = status.fanSpeed

      // ABBBBBCC
      // A: onTimerActive
      // B: onTimerHours
      // C: onTimerMinutes bits 0/1
      cmd[4] = (status.onTimerActive ? 0x80 : 0x00) | (status.onTimerHours << 2) | (status.onTimerMinutes & 0x03)

      // ABBBBBCC
      // A: offTimerActive
      // B: offTimerHours
      // C: offTimerMinutes bits 0/1
      cmd[5] = (status.offTimerActive ? 0x80 : 0x00) | (status.offTimerHours << 2) | (status.offTimerMinutes & 0x03)

      // AAAABBBB
      // A: timerOffMinutes bits 2-6
      // B: timerOffMinutes bits 2-6
      cmd[6] = ((status.timerOnMinutes & 0x2C) << 2) | (status.timerOffMinutes & 0x2C >> 2)

      // Nethome Plus: When timers are off, byte 4 & 5 are 0x7F and byte 6 is 0xFF

      // AAAABBCC
      // A: 0x03
      // B: horizontalSwingActive ? 0x0C : 0
      // C: verticalSwingActive ? 0x03 : 0
      cmd[7] = 0x30 | (status.horizontalSwingActive ? 0x0C : 0x00) | (status.verticalSwingActive ? 0x03 : 0x00)

      // ABCDEFGG
      // A: personalFeeling
      // B: powerSave
      // C: strong (=turboModeActive)
      // D: lowFrequencyFan
      // E: save
      // F: alarmSleep
      // G: cosySleepMode
      cmd[8] = (status.personalFeeling ? 0x80 : 0x00) | (status.powerSave ? 0x40 : 0x00) |
        (status.turboModeActive ? 0x20 : 0x00) | (status.lowFrequencyFan ? 0x10 : 0x00) |
          (status.save ? 0x08 : 0x00) | (status.alarmSleep ? 0x04 : 0x00) |
            (status.cosySleepMode & 0x03)

      // ABCDEFGH
      // A: ecoModeActive
      // B: changeCosySleepMode
      // C: purifyingModeActive (cleanUp)
      // D: ptcButton
      // E: ptcHeaterActive
      // F: dryClean
      // G: naturalWindModeActive (exchangeAir)
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
      // F: temperatureUnit (fahrenheit / celsius)
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

      // ???this.naturalWindModeActive ? 0x40 : 0x00 (naturalFan)
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
      // B: twoControl (double_temp)
      // C: temp (setExpand)
      // D: tempDot (setExpand_dot)
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
            self.emit('status-update', reporter(updates))
          }

          resolve(reporter(parsedData))
        })
        .catch(error => {
          reject(error)
        })
    })
  }
}
