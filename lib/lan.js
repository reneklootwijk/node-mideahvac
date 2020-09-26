/* eslint-disable no-async-promise-executor */
'use strict'

const logger = require('winston')
const net = require('net')
const AC = require('./ac')
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

    if (!options.deviceId) {
      throw new Error('Cannot instantiate LAN client, no deviceId specified')
    }

    this.ssid = options._ssid
    this.password = options.password
    this.host = options.host
    this.port = options.port || 6444
    this.mac = options._mac
    this.deviceId = options.deviceId

    this._connection = null
    this._token = Buffer.from('8a750e9d3bcb7e308ca3659d9efaba718113aa87e4bf0d6a7b6addff3e81a351b7707cbea5eb7314ec8e5865da32821634ce6b963c0cc9d98b27e047e68dc88a', 'hex')
    this._key = Buffer.from('364659814cebab782ce10ddb77cda0d12a4a3853c78fde40b8acd29eda43ee96', 'hex')
    this._msgId = 0

    this._cmdQueue = []
    this._cmdInProgress = false
    this._cmdTimer = null
  }

  _authenticate () {
    var self = this

    // const header = Buffer.from([0x83, 0x70, self._token.length / 256, self._token.length % 256, 0x20, 0x00])
    const cmd = Buffer.concat([Buffer.from([0x83, 0x70, Math.floor(self._token.length / 256), self._token.length % 256, 0x20, 0x00, self._msgId / 256, self._msgId % 256]), self._token])
    self._request(cmd, 'authenticate')
      .then(response => {
        logger.debug(`RESPONSE: ${response.toString('hex')}`)
      })
      .catch(error => {
        logger.error(error.message)
      })
  }

  _connect () {
    var self = this

    logger.debug(`LAN._connect: Connecting to ${self.host}:${self.port}`)

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
      self._connection.on('data', data => {
        logger.debug(`LAN.connect: Received data: ${data.toString('hex')}`)

        if (data[0] === 0x83 && data[1] === 0x70) {

          // When command is in progress, call the response handler for this command
          if (self._cmdInProgress) {
            logger.silly(`LAN.connect: Calling handler for the command '${self._cmdQueue[0].label}' in progress`)

            self._cmdQueue[0].handler(null, data)

            // Disable timeout timer
            clearTimeout(self._cmdTimer)

            self._cmdInProgress = false

            // Remove previous command from queue
            self._cmdQueue.shift()

            self._processQueue()
          } else {
            logger.error('LAN.connect: Received data while no command was in progress')
          }
        }
      })

      // Handler for connection end
      self._connection.on('close', () => {
        // Reset connection flag
        self._connected = false

        // Emit disconnected event
        self.emit('disconnected')

        logger.error('LAN: Closed')

        // Reconnect logic
        setTimeout(() => {
          logger.debug('LAN: Reconnecting')

          self._connect()
        }, 5000)
      })

      // Handler for errors
      self._connection.on('error', function (err) {
        logger.error(`LAN._connect: ${err.message}`)
      })
    })
  }

  _processQueue () {
    const self = this

    logger.silly('LAN._processQueue: Entering')

    if (self._cmdInProgress) {
      return logger.silly('LAN._processQueue: Command in progress')
    }

    if (!self._cmdQueue.length) {
      return logger.silly('LAN._processQueue: No queued commands')
    }

    self._cmdInProgress = true

    logger.debug(`LAN._processQueue: Sending '${self._cmdQueue[0].label}' command`)

    self._write(self._cmdQueue[0].cmd)
      .then(result => {
        if (self._cmdQueue[0]) {
          // Start timer to prevent hanging waiting for a response to a command
          self._cmdTimer = setTimeout((activeCmd) => {
            logger.error(`LAN._processQueue: No response received in time for '${activeCmd.label}' command`)

            // Remove previous command from queue
            self._cmdQueue.shift()

            self._cmdInProgress = false

            activeCmd.handler(new errors.TimeoutError('No response received'))
          }, 1000, self._cmdQueue[0])
        } else {
          logger.error('LAN._processQueue: Expected a command in progress')
        }
      })
      .catch(error => {
        logger.error(`LAN._processQueue: Error writing command '${self._cmdQueue[0].label}' (${error.message})`)

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
      logger.debug(`LAN._write: Write ${data.toString('hex')}`)

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
}
