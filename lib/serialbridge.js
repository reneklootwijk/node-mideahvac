/* eslint-disable no-async-promise-executor */
'use strict'

const logger = require('winston')
const net = require('net')

const AC = require('./ac')
const { createCommand } = require('./ac_common')
const errors = require('./errors')

// Add a transport as fall back when no parent logger has been initialized
// to prevent the error: "Attempt to write logs with no transports"
logger.add(new logger.transports.Console({
  level: 'none'
}))

module.exports = class extends AC {
  constructor (options = {}) {
    // Call constructor of the AC class
    super(options)

    if (!options.host || !options.port) {
      throw new Error('Cannot create serialbridge connection, no host and/or port specified')
    }

    this.host = options.host
    this.port = options.port || 23

    this._deviceId = `${options.host}:${options.port}`
    this._connected = false

    this._connection = null

    this._rcvBuf = []
    this._nextIsLength = false
    this._stillToReceive = 0

    this._cmdTimer = null
    this._cmdInProgress = false
    this._cmdQueue = []
  }

  _connect () {
    var self = this

    logger.debug('SerialBridge: Connecting')

    return new Promise((resolve, reject) => {
      self._connection = net.createConnection(self.port, self.host)

      self._connection.on('connect', () => {
        // Set connection flag
        self._connected = true

        // Emit connected event
        self.emit('connected')

        resolve()
      })

      // Process received data
      self._connection.on('data', function (data) {
        logger.debug(`SerialBridge.connect: Received data: ${data.toString('hex')}`)

        if (data[0] === 0xAA) {
          // TODO: Add check for length, CRC8 and checksum

          // When command is in progress, call the response handler for this command
          if (self._cmdInProgress) {
            logger.silly(`SerialBridge.connect: Calling handler for the command '${self._cmdQueue[0].label}' in progress`)

            self._cmdQueue[0].handler(null, data)

            // Disable timeout timer
            clearTimeout(self._cmdTimer)

            self._cmdInProgress = false

            // Remove previous command from queue
            self._cmdQueue.shift()

            self._processQueue()
          } else {
            logger.error('SerialBridge.connect: Received data while no command was in progress')
          }
        }
      })

      // Handler for connection end
      self._connection.on('close', function () {
        // Reset connection flag
        self._connected = false

        // Emit disconnected event
        self.emit('disconnected')

        logger.error('SerialBridge: Closed')

        // Reconnect logic
        setTimeout(function () {
          logger.debug('SerialBridge: Reconnecting')

          self._connect()
        }, 1000)
      })

      // Handler for errors
      self._connection.on('error', function (err) {
        logger.error(`SerialBridge._connect: ${err.message}`)
      })
    })
  }

  _processQueue () {
    const self = this

    logger.silly('SerialBridge._processQueue: Entering')

    if (self._cmdInProgress) {
      return logger.silly('SerialBridge._processQueue: Command in progress')
    }

    if (!self._cmdQueue.length) {
      return logger.silly('SerialBridge._processQueue: No queued commands')
    }

    self._cmdInProgress = true

    logger.debug(`SerialBridge._processQueue: Sending '${self._cmdQueue[0].label}' command`)

    self._write(self._cmdQueue[0].cmd)
      .then(result => {
        if (self._cmdQueue[0]) {
          // Start timer to prevent hanging waiting for a response to a command
          self._cmdTimer = setTimeout((activeCmd) => {
            logger.error(`SerialBridge._processQueue: No response received in time for '${activeCmd.label}' command`)

            // Remove previous command from queue
            self._cmdQueue.shift()

            self._cmdInProgress = false

            activeCmd.handler(new errors.TimeoutError('No response received'))
          }, 1000, self._cmdQueue[0])
        } else {
          logger.error('SerialBridge._processQueue: Expected a command in progress')
        }
      })
      .catch(error => {
        logger.error(`SerialBridge._processQueue: Error writing command '${self._cmdQueue[0].label}' (${error.message})`)

        return self._cmdQueue[0].handler(error)
      })
  }

  _queueCommand (cmd, label = '', handler = () => { }) {
    var self = this

    self._cmdQueue.push({
      cmd,
      label,
      handler
    })

    self._processQueue()
  }

  _write (data) {
    var self = this

    return new Promise((resolve, reject) => {
      logger.debug(`SerialBridge._write: Write ${data.toString('hex')}`)

      self._connection.write(data, (err) => {
        if (err) {
          return reject(err)
        }
        resolve()
      })
    })
  }

  _request (cmd, label = 'unknown') {
    var self = this

    return new Promise(async (resolve, reject) => {
      if (!self._connected) {
        await self._connect()
      }

      self._queueCommand(cmd, label, (err, data) => {
        if (err) {
          return reject(err)
        }

        resolve(data)
      })
    })
  }

  // This command is only supported in serialbridge mode, the SmartKey will not
  // forward it
  getElectronicId () {
    var self = this

    let cmd = Buffer.from([0x00])

    cmd = createCommand(cmd, 0x07)

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

  async initialize () {
    var self = this
    let status = {}
    let capabilities = {}

    logger.debug('SerialBridge.initialize: Entering')

    return new Promise(async (resolve, reject) => {
      if (!self._connected) {
        try {
          await self._connect()
        } catch (error) {
          return logger.error(`SerialBridge.initialize: Failed to connect to serial bridge for ${self._deviceId} - ${error.message}`)
        }
      }

      // Send network status notification in order to have the WiFi symbol shown in the display
      try {
        await self.sendNetworkStatusNotification()
      } catch (error) {
        logger.error(`SerialBridge.initialize: Failed to send network status notification for ${self._deviceId} - ${error.message}`)
      }

      try {
        capabilities = await self.getCapabilities(true)
        logger.silly(`SerialBridge.initialize: Capabilities of ${self._deviceId} - ${JSON.stringify(capabilities)}`)
      } catch (error) {
        logger.error(`SerialBridge.initialize: Failed to get capabilities of ${self._deviceId} - ${error.message}`)
      }

      try {
        status = await self.getStatus(true, false)
        logger.silly(`SerialBridge.initialize: Current status of ${self._deviceId} - ${JSON.stringify(status)}`)
      } catch (error) {
        return logger.error(`SerialBridge.initialize: Failed to get current status of ${self._deviceId} - ${error.message}`)
      }

      // Send the network notification message each 2 minutes (use unref to prevent this is keeping the process alive and stalls the unit test)
      setInterval(self => {
        self.sendNetworkStatusNotification()
          .catch(error => {
            logger.error(`SerialBridge.initialize: Failed to send network status notification for ${self._deviceId} - ${error.message}`)
          })
      }, 120000, self).unref()

      self.emit('initialized', {
        status,
        capabilities
      })

      resolve({
        status,
        capabilities
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

    cmd = createCommand(cmd, 0x0D)

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
}
