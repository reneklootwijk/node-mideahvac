/* eslint-disable no-async-promise-executor */
'use strict'

const logger = require('winston')
const net = require('net')

const errors = require('./errors')
const AC = require('./ac')

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

            self._cmdInProgress = false

            activeCmd.handler(new errors.TimeoutError('No response received'))
          }, 5000, self._cmdQueue[0])
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

  async initialize () {
    var self = this
    let status
    let capabilities

    logger.debug('SerialBridge.initialize: Entering')

    return new Promise(async (resolve, reject) => {
      if (!self._connected) {
        try {
          await self._connect()
        } catch (error) {
          return logger.error(`SerialBridge.initialize: Failed to connect to serial bridge for ${self._deviceId} - ${error.message}`)
        }
      }

      try {
        status = await self.getStatus(true, false)
        logger.silly(`SerialBridge.initialize: Current status of ${self._deviceId} - ${JSON.stringify(status)}`)
      } catch (error) {
        return logger.error(`SerialBridge.initialize: Failed to get current status of ${self._deviceId} - ${error.message}`)
      }

      try {
        capabilities = await self.getCapabilities(true)
        logger.silly(`SerialBridge.initialize: Capabilities of ${self._deviceId} - ${JSON.stringify(capabilities)}`)
      } catch (error) {
        return logger.error(`SerialBridge.initialize: Failed to get capabilities of ${self._deviceId} - ${error.message}`)
      }

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
}
