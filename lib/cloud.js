'use strict'

const axios = require('axios')
const crypto = require('crypto')
const EventEmitter = require('events').EventEmitter
const logger = require('winston')

const errors = require('./errors')

// Cloud error codes
// 9999 system error
// 3176 The asyn reply does not exist -> The unit does not respond within time
// 3127 The appliance does not exist.
// 3144 login failed, loginId is empty, please login again.
// 7610 your account login too many times in one hour,please login later
// 3301 Sign illegal.
// 3106 invalidSession
// 3123 the appliance is off line

// Add a transport as fall back when no parent logger has been initialized
// to prevent the error: "Attempt to write logs with no transports"
logger.add(new logger.transports.Console({
  level: 'none'
}))

function addHeader(data, messageId, deviceId) {
  // Format of the cloud header:
  // Byte 0-1:    0x5a5a
  // Byte 2:		  0x01
  // Byte 3:		  0x11
  // Byte 4-5:		Length of packet (reversed, lb first)
  // Byte 6:		  0x20
  // Byte 7:		  0x00
  // Byte 8-11:	  messageId (rollover at 32767)
  // Byte 12-19:	date
  // Byte 20-25:  deviceId (reversed, lb first)
  // Byte 26:		  0x0A
  // Byte 27:		  0x00
  // Byte 28-33:	0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  // Byte 34:		  0x00
  // Byte 35:		  0x00
  // Byte 36:     sequence number
  // Byte 37-39:	0x00, 0x00, 0x00
  const header = Buffer.from([
    0x5A, 0x5A, 0x01, 0x11, 0x00, 0x00, 0x20, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x0A, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ])

  let packet = Buffer.concat([header, data])

  // Insert packet length (reversed)
  packet[4] = packet.length & 0x00FF
  packet[5] = (packet.length & 0xFF00) >> 8

  // Insert message Id (reversed), this seem to result in an error
  // packet[8] = messageId & 0x000000FF
  // packet[9] = (messageId & 0x0000FF00) >> 8
  // packet[10] = (messageId & 0x00FF0000) >> 16
  // packet[11] = (messageId & 0xFF000000) >> 24

  // Insert the date (reversed)
  let now = new Date()
  packet[12] = now.getMilliseconds() & 0xFF
  packet[13] = now.getSeconds()
  packet[14] = now.getMinutes()
  packet[15] = now.getHours()
  packet[16] = now.getDate()
  packet[17] = now.getMonth()
  packet[18] = now.getFullYear() % 100
  packet[19] = Math.floor(now.getFullYear() / 100)

  // Insert device Id (reversed)
  deviceId = Buffer.from(deviceId.toString(16), 'hex')
  packet[20] = deviceId[5]
  packet[21] = deviceId[4]
  packet[22] = deviceId[3]
  packet[23] = deviceId[2]
  packet[24] = deviceId[1]
  packet[25] = deviceId[0]
  
  return packet
}

function createPacket(data, messageId, deviceId) {
  var packet

  packet = Buffer.alloc(data.length + 16)

  // Copy data into packet buffer
  data.copy(packet)

  // Add cloud specific 
  packet = addHeader(packet, messageId, deviceId)

  logger.silly(`Cloud.createPacket: Packet to be encoded: ${packet.toString('hex')}`)

  // Return encoded packet
  return encode(packet)
}

function encode(data) {
  let encoded = []

  data.forEach(b => {
    if (b >= 128) {
      b -= 256
    }
    encoded.push(b.toString())
  })
  
  return Buffer.from(encoded.join(','), 'ascii')
}

function encryptPassword(appKey, loginId, password) {
  let passwordHash = crypto.createHash('sha256').update(password).digest('hex')

  return crypto.createHash('sha256').update(loginId + passwordHash + appKey).digest('hex')
}

function sign(appKey, path, payload) {
  // Sort payload attributes
  let query = sortOnKey(payload)

  // Create query string
  query = Object.keys(query).map(key => key + '=' + query[key]).join('&')

  // Return the signature
  return crypto.createHash('sha256').update(path + query + appKey).digest('hex')
}

function sortOnKey(obj = {}) {
  return Object.keys(obj).sort().reduce((result, key) => {
    result[key] = obj[key]

    return result
  }, {})
}

module.exports = class extends EventEmitter {
  constructor(options = {}) {
    // Call constructor of the EventEmitter class
    super()

    if (!options.uid) {
      throw new Error('Cannot instantiate Midea cloud client because no user has been specified')
    }

    if (!options.password) {
      throw new Error('Cannot instantiate Midea cloud client because no password has been specified')
    }

    this.communicationMethod = "mideacloud"

    this.appKey = options.appKey || '3742e9e5842d4ad59c2db887e12449f9'
    this.host = options.host || 'mapp.appsmb.com'
    this.password = options.password
    this.port = options.port || 443
    this.uid = options.uid
    
    this._appId = 1017
    this._clientType = 1      // 0: PC, 1: Android, 2: IOS
    this._connected = false
    this._format = 2          // JSON
    this._language = 'en_US'
    this._loginId = null
    this._sessionId = null
    this._src = 17

    this._messageId = 1

    this._loginInProgress = null
  }

  _apiRequest(options, payload = {}) {
    const self = this

    return new Promise((resolve, reject) => {
      options.method = options.method || 'GET'
      options.baseURL = `https://${self.host}:${self.port}`
      options.url = options.path || '/'
      options.data = {
        appId: self._appId,
        format: self._format,
        clientType: self._clientType,
        language: self._language,
        src: self._src,
        stamp: new Date().toISOString().replace(/-/g, '').replace(/:/g, '').replace('T', '').replace(/\..+/, '')
      }

      for (let prop in payload) {
        options.data[prop] = payload[prop]
      }

      // Add the session id when available
      if (self._sessionId) {
        options.data.sessionId = self._sessionId
      }

      options.data.sign = sign(self.appKey, options.url, options.data)
    
      options.data = Object.keys(options.data).map(key => key + '=' + encodeURIComponent(options.data[key])).join('&')

      options.headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(options.data)
      }

      logger.silly(`MideaCloudClient._apirequest: Entering with ${JSON.stringify(options)}`)

      axios(options)
        .then(response => {
          resolve(response.data)
        })
        .catch(error => {
          reject(error)
        })
    })
  }

  _authenticate() {
    const self = this
    let loginId

    logger.silly(`MideaCloudClient._authenticate: Entering`)

    clearInterval(self._sessionRefreshTimer)

    if (self._loginInProgress === null) {
      // Get user id, access token and session id
      self._loginInProgress = new Promise(async (resolve, reject) => {
        // First get the login Id
        try {
          loginId = await self._getLoginId(self.uid)
        } catch (error) {
          return reject(error)
        }

        self._apiRequest({ method: 'POST', path: '/v1/user/login' }, { loginAccount: self.uid, password: encryptPassword(self.appKey, self._loginId, self.password) })
          .then(response => {
            if (response.errorCode !== "0") {
              switch (response.errorCode) {
                case '3101':
                  return reject(new errors.authenticationError('Failed to authenticate, wrong uid and/or password'))

                default:
                  logger.error(`MideaCloudClient._authenticate: ${response.msg} (${response.errorCode})`)

                  return reject(new Error('An internal error occurred'))
              }
            }

            // Persist data
            self._accessToken = response.result.accessToken
            self._sessionId = response.result.sessionId
            self._userId = response.result.userId
            
            logger.silly(`MideaCloudClient._authenticate: accessToken=${self._accessToken}`)
            logger.silly(`MideaCloudClient._authenticate: sessionId=${self._sessionId}`)
            logger.silly(`MideaCloudClient._authenticate: userId=${self._userId}`)

            self._loginInProgress = null

            // Start timer to refresh session
            self._sessionRefreshTimer = setInterval(self => {
                self._apiRequest({ method: 'POST', path: '/v1/user/session/update' }, { })
                  .then(response => {
                    if (response.errorCode !== "0") {
                      switch (response.errorCode) {
                        default:
                          logger.error(`MideaCloudClient._authenticate: Failed to update session ${JSON.stringify(response)}`)
                      }
                    } else {
                      logger.silly(`MideaCloudClient._authenticate: Refreshed session`)
                    }
                  })
                  .catch(error => {
                    logger.error(`MideaCloudClient._authenticate: Failed to refresh session (${error.message})`)
                  })
            }, 10000, self)

            return resolve({
              accessToken: self._accessToken,
              sessionId: self._sessionId,
              userId: self._userId
            })
          })
          .catch(error => {
            self._loginInProgress = null

            return reject(error)
          })
      })
    }

    return self._loginInProgress
  }

  _createKey() {
    var self = this

    let keyHash = crypto.createHash('md5').update(self.appKey).digest()
    keyHash = keyHash.toString('hex').substring(0, 16)
    let key = self._decrypt(self._accessToken, keyHash)

    return key
  }

  _decrypt(data, key) {
    var self = this
    let blockSize = 32
    let result = ''

    if (!key) {
      key = self._createKey()
    }

    let blocks = data.match(new RegExp('.{1,' + blockSize + '}', 'g'))

    blocks.forEach(block => {
      let decipher = crypto.createDecipheriv('aes-128-cbc', key, Buffer.alloc(16))

      decipher.setAutoPadding(false)

      let decrypted = decipher.update(block, 'hex') + decipher.final('hex')

      result += decrypted
    })

    result = result.replace(new RegExp(result[result.length - 1] + '+$', 'g'), '')

    return result
  }

  _encrypt(data, key) {
    var self = this
    let result = ''
    let blockSize = 32

    if (!key) {
      key = self._createKey()
    }

    let blocks = data.match(new RegExp('.{1,' + blockSize + '}', 'g'))

    // data.padEnd(blockSize, blockSize - (data.length % blockSize))

    blocks.forEach(block => {
      let cipher = crypto.createCipheriv('aes-128-cbc', key, Buffer.alloc(16))

      cipher.setAutoPadding(false)
      // cipher.setAutoPadding(true)

      block = block.padEnd(blockSize, ((blockSize - (block.length % blockSize)) / 2).toString().padStart(2, '0'))

      let encrypted = cipher.update(block, 'hex', 'hex') + cipher.final('hex')

      result += encrypted
    })

    return result
  }

  _getLoginId(uid) {
    var self = this

    logger.silly(`MideaCloudClient._getLoginId: Entering with uid=${uid}`)

    return new Promise(async (resolve, reject) => {
      // Obtain login id
      self._apiRequest({ method: 'POST', path: '/v1/user/login/id/get' }, { loginAccount: uid })
        .then(response => {
          if (response.errorCode !== "0") {
            switch (response.errorCode) {
              case '3102':
                return reject(new errors.authenticationError(`Account ${uid} does not exist`))
              
              default:
                logger.error(`MideaCloudClient._getLoginId: ${JSON.stringify(response)}`)

                return reject(new Error('An internal error occurred'))
            }
          }

          // Persist login id
          self._loginId = response.result.loginId

          logger.silly(`MideaCloudClient._getLoginId: loginId=${self._loginId}`)

          resolve(self._loginId)
        })
        .catch(error => {
          logger.error(`MideaCloudClient._getLoginId: ${error.message} (${error.name})`)

          return reject(new Error('An unknown error occurred'))
        })
    })
  }

  request(cmd, label = 'unknown', deviceId, retry = false) {
    var self = this

    return new Promise(async (resolve, reject) => {
      if (!self._accessToken) {
        try {
          await self._authenticate()
        } catch (error) {
          return reject(error)
        }
      }

      // Create the cloud specific request structure
      if (++self._messageId === 32768) {
        self._messageId = 1
      }
      let packet = createPacket(cmd, self._messageId, deviceId)

      // Create retryable request
      var sendRequest = () => {
        self._apiRequest({ method: 'POST', path: '/v1/appliance/transparent/send' }, {
          'order': self._encrypt(packet.toString('hex')),
          'funId': '0000',
          'applianceId': deviceId
        })
          .then(response => {
            if (response.errorCode !== '0') {
              switch (response.errorCode) {
                case '9999': // system error
                case '3123': // the appliance is off line
                case '3176': // msg: the asyn reply does not exist
                  if (!retry) {
                    logger.error(`MideaCloudClient.request: Request ${label} resulted in error: ${JSON.stringify(response)}`)

                    return reject(new Error('An internal error occurred'))
                  }

                  // if (++self._retryAttempts < self._maxRetries) {
                  //   logger.error('MideaCloudClient.request: Exceeded retry attempts')

                  //   return reject(new Error('An internal error occurred'))
                  // }

                  return setTimeout(() => {
                    logger.error('MideaCloudClient.request: Retry request')
                    sendRequest()
                  }, 5000)                    
                
                case '3106': // invalidSession
                  logger.error('MideaCloudClient.request: Session expired, reauthenticating')

                  self._authenticate()
                    .then(result => {
                      return sendRequest()
                    })
                    .catch(error => {
                      logger.error(`MideaCloudClient.request: Cannot reauthenticate (${error.message})`)
                    })
                  break
                
                default:
                  logger.error(`MideaCloudClient.request: ${JSON.stringify(response)}`)
                  return reject(new Error('An internal error occurred'))
              }
            }

            // Decrypt the response
            let decrypted = self._decrypt(response.result.reply)

            // Decode the response
            let data = Buffer.from(Buffer.from(decrypted).toString().split(','))
          
            logger.silly(`MideaCloudClient.request: Decoded packet: ${data.toString('hex')}`)

            // Return only the actual response
            resolve(data.subarray(40, 40 + data[41]))
          })
          .catch(error => {
            logger.error(`MideaCloudClient.request: ${error.name} - ${error.message}`)
          })
      }

      // First try
      sendRequest()
    })
  }
}