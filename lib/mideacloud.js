/* eslint-disable no-async-promise-executor */
'use strict'

const logger = require('winston')

const Connection = require('./cloud')
const AC = require('./ac')

const cloudClients = {}

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
      throw new Error('Cannot instantiate Midea cloud client, no deviceId specified')
    }

    if (!options.uid) {
      throw new Error('Cannot instantiate Midea cloud client, no user has been specified')
    }

    this._deviceId = options.deviceId

    // Share an existing connection based on uid
    if (!cloudClients[options.uid]) {
      cloudClients[options.uid] = new Connection(options)
    }
    this._connection = cloudClients[options.uid]
  }

  _request (cmd, label = 'unknown', retry) {
    var self = this

    return new Promise((resolve, reject) => {
      self._connection.request(cmd, label, self._deviceId, retry)
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
    let status
    let capabilities

    logger.silly('MideaCloudClient.initialize: Entering')

    return new Promise(async (resolve, reject) => {
      if (!self._connection._accessToken) {
        try {
          await self._connection._authenticate()
        } catch (error) {
          return logger.error(`MideaCloudClient.initialize: Failed to connect to midea cloud for ${self._deviceId} - ${error.message}`)
        }
      }

      try {
        status = await self.getStatus(true, false)
        logger.debug(`MideaCloudClient.initialize: Current status of ${self._deviceId} - ${JSON.stringify(status)}`)
      } catch (error) {
        return logger.error(`MideaCloudClient.initialize: Failed to get current status of ${self._deviceId} - ${error.message}`)
      }

      try {
        capabilities = await self.getCapabilities(true)
        logger.debug(`MideaCloudClient.initialize: Capabilities of ${self._deviceId} - ${JSON.stringify(capabilities)}`)
      } catch (error) {
        return logger.error(`MideaCloudClient.initialize: Failed to get capabilities of ${self._deviceId} - ${error.message}`)
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
