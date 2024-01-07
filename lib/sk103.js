/* eslint-disable no-async-promise-executor */
'use strict';

const crypto = require('crypto');
const logger = require('winston');
const net = require('net');

const AC = require('./ac');
const errors = require('./errors');

const MSGTYPE_HANDSHAKE_REQUEST = 0x00;
const MSGTYPE_ENCRYPTED_RESPONSE = 0x03;
const MSGTYPE_ENCRYPTED_REQUEST = 0x06;

// Add a transport as fall back when no parent logger has been initialized
// to prevent the error: "Attempt to write logs with no transports"
logger.add(new logger.transports.Console({
  level: 'none'
}));

function addHeader0x5A5A (data, messageId, deviceId) {
  // Format of the cloud header:
  // Byte 0-1:    0x5a5a
  // Byte 2:      0x01
  // Byte 3:      0x11
  // Byte 4-5:    Length of packet (reversed, lb first)
  // Byte 6:      0x20
  // Byte 7:      0x00
  // Byte 8-11:   messageId (rollover at 32767)
  // Byte 12-19:  date
  // Byte 20-25:  deviceId (reversed, lb first)
  // Byte 26:     0x0A
  // Byte 27:     0x00
  // Byte 28-33:  0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  // Byte 34:     0x00
  // Byte 35:     0x00
  // Byte 36:     sequence number
  // Byte 37-39:  0x00, 0x00, 0x00
  const header = Buffer.from([
    0x5A, 0x5A, 0x01, 0x11, 0x00, 0x00, 0x20, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);

  const packet = Buffer.concat([header, data]);

  // Insert packet length (reversed)
  packet[4] = (packet.length + 16) & 0x00FF;
  packet[5] = ((packet.length + 16) & 0xFF00) >> 8;

  // Insert message Id (reversed), this seem to result in an error
  packet[8] = messageId & 0x000000FF;
  packet[9] = (messageId & 0x0000FF00) >> 8;
  packet[10] = (messageId & 0x00FF0000) >> 16;
  packet[11] = (messageId & 0xFF000000) >> 24;

  // Insert the date (reversed)
  const now = new Date();
  packet[12] = now.getMilliseconds() & 0xFF;
  packet[13] = now.getSeconds();
  packet[14] = now.getMinutes();
  packet[15] = now.getHours();
  packet[16] = now.getDate();
  packet[17] = now.getMonth();
  packet[18] = now.getFullYear() % 100;
  packet[19] = Math.floor(now.getFullYear() / 100);

  // Insert device Id (reversed)
  deviceId = Buffer.from(deviceId.toString(16), 'hex');
  packet[20] = deviceId[5];
  packet[21] = deviceId[4];
  packet[22] = deviceId[3];
  packet[23] = deviceId[2];
  packet[24] = deviceId[1];
  packet[25] = deviceId[0];

  return packet;
}

// module.exports = class extends EventEmitter {
module.exports = class extends AC {
  constructor (options = {}) {
    super();

    if (!options.host) {
      throw new Error('Cannot create SK103 connection, no host specified');
    }

    if (!options.id) {
      throw new Error('Cannot create SK103 connection, no device Id specified');
    }

    if (!options.key || !options.token) {
      throw new Error('Cannot create SK103 connection, no key and/or token specified');
    }

    this.host = options.host;
    this.id = options.id;
    this.key = options.key;
    this.token = options.token;

    this._signKey = 'xhdiwjnchekd4d512chdjx5d8e4c394D2D7S';
    this._signKeyMD5 = Buffer.from(crypto.createHash('md5').update(this._signKey).digest('hex'), 'hex');
    this._requestCount = 0;
    this._tcpKey = null;

    this._rcvBuf = [];
    this._nextIsLength = false;
    this._stillToReceive = 0;

    this._cmdTimer = null;
    this._cmdInProgress = false;
    this._authInProgress = false;
    this._cmdQueue = [];
    this._maxQueueDepth = 5;

    this.logger = logger.child({ label: `deviceId=${this.id}` });

    this._connection = null;
  }

  _authenticate () {
    const self = this;

    self.logger.silly('SK103._authenticate: Entering');

    return new Promise(async (resolve, reject) => {
      if (self._tcpKey) {
        self.logger.debug('SK103._authenticate: Already authenticated');
        return resolve(self._tcpKey);
      }

      self._authInProgress = true;

      await self._connect()
        .catch(async error => {
          self.logger.error(`SK103._authenticate: Failed to connect (${error.message})`);
        });

      if (!self._connected) return reject(new Error('Failed to connect'));

      const packet = self._encode0x8370(Buffer.from(self.token, 'hex'), MSGTYPE_HANDSHAKE_REQUEST);

      const options = {
        packet,
        label: 'authenticate',
        noDecode: true,
        priority: true
      };

      self._queueCommand(options, (error, response) => {
        self.logger.debug('SK103._authenticate: Entering callback');

        self._authInProgress = false;

        if (error) {
          return reject(error);
        }

        self.logger.debug(`SK103._authenticate: Received ${response.toString('hex')}`);

        response = response.subarray(8);

        if (response.length === 5 && response.toString() === 'ERROR') {
          return reject(new Error(response.toString()));
        }

        if (response.length !== 64) {
          self.logger.error(`SK103._authenticate: Unexpected response length (${response.length})`);
          return reject(new errors.AuthenticationError());
        }

        const payload = response.subarray(0, 32);
        const sign = response.subarray(32);
        const key = Buffer.from(self.key, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.alloc(16));
        decipher.setAutoPadding(false);
        const decrypted = Buffer.from(decipher.update(payload, 'hex', 'hex') + decipher.final('hex'), 'hex');

        const calculatedSign = crypto.createHash('sha256').update(decrypted).digest('hex');

        if (calculatedSign !== sign.toString('hex')) {
          self.logger.error('SK103._authenticate: Message signature does not validate');
          return reject(new Error('Invalid signature'));
        }
        logger.debug('HIER ZIJN WE DAN2');

        const tcpKey = [];
        for (let i = 0; i < decrypted.length; i++) {
          tcpKey.push(decrypted[i] ^ key[i]);
        }
        self._tcpKey = Buffer.from(tcpKey).toString('hex');

        self.logger.debug(`SK103._authenticate: Got tcpKey (${self._tcpKey.toString('hex')})`);

        // Delay before sending the queue command that required authentication
        setTimeout(() => {
          resolve(self._tcpKey);
        }, 500);
      });
    });
  }

  _connect () {
    const self = this;

    self.logger.silly('SK103._connect: Entering');

    return new Promise((resolve, reject) => {
      let connecting = true;
      let cachedError;

      const timer = setTimeout(() => {
        if (self._connection) self._connection.destroy();

        reject(new errors.TimeoutError('Failed to connect (timeout)'));
      }, 5000);

      self._connection = net.createConnection(6444, self.host, () => {
        self.logger.info('SK103._connect: Connected');

        self._connected = true;

        connecting = false;

        clearTimeout(timer);

        return resolve();
      });

      self._connection.on('close', () => {
        self.logger.info('SK103._connect: Connection closed');

        self._connected = false;
        self._tcpKey = null;

        if (connecting) {
          clearTimeout(timer);

          reject(cachedError || new Error('Unknown'));
        }
      });

      self._connection.on('data', self._dataHandler.bind(self));

      self._connection.on('end', () => {
        self.logger.info('SK103._connect: Disconnect received from appliance');
      });

      self._connection.on('error', error => {
        self.logger.error(`SK103._connect: ${error.message} - Code: ${error.code}`);

        cachedError = error;
      });
    });
  }

  _dataHandler (data) {
    const self = this;
    let error;

    self.logger.debug(`SK103._dataHandler: Entering with ${data.toString('hex')}`);

    if (data.length < 6) {
      self.logger.error(`SK103._dataHandler: Invalid message received (length=${data.length})`);
      return;
    }

    // When command is in progress, call the response handler for this command
    if (self._cmdInProgress) {
      self.logger.debug(`SK103._dataHandler: Calling handler for the command '${self._cmdQueue[0].label}' in progress`);

      if (!self._cmdQueue[0].noDecode) {
        data = self._decode(data);

        if (data.length === 5 && data.toString() === 'ERROR') {
          error = data.toString();
        } else {
          const decipher = crypto.createDecipheriv('aes-128-ecb', self._signKeyMD5, '');
          data = Buffer.from(decipher.update(data.subarray(40, -16), 'hex', 'hex') + decipher.final('hex'), 'hex');
        }
      }

      self._cmdQueue[0].handler(error, data);

      // Disable timeout timer
      clearTimeout(self._cmdTimer);

      // If the finished command was authenticate, a command is still in progress
      let skipProcessingQueue = false;
      if (self._cmdQueue[0].label !== 'authenticate') {
        skipProcessingQueue = true;
      }

      self._cmdInProgress = false;

      // Remove previous command from queue
      self._cmdQueue.shift();

      if (!skipProcessingQueue) {
        // Delay before sending the command to prevent flooding
        setTimeout(() => {
          self._processQueue();
        }, 500);
      }
    } else {
      self.logger.error('SK103._dataHandler: Received data while no command was in progress');
    }
  }

  _decode (data) {
    const self = this;

    self.logger.debug(`SK103._decode: Entering with ${data.toString('hex')}`);

    const header = data.subarray(0, 6);

    if (header[0] !== 0x83 || header[1] !== 0x70) {
      self.logger.error(`SK103._decode: Invalid header '${header.subarray(0, 2).toString('hex')}}`);
      return;
    }

    const size = header.readInt16BE(2) + 8;
    if (size < data.length) {
      self.logger.error(`SK103._decode: Length does not match '${size} vs ${data.length}}`);
      return;
    }

    if (header[4] !== 0x20) {
      self.logger.error(`SK103._decode: Invalid message (byte 4 of header is not 0x20 (${header[4]}))`);
      return;
    }

    const padding = header[5] >> 4;
    const msgType = header[5] & 0x0F;

    data = data.subarray(6);

    if (msgType === MSGTYPE_ENCRYPTED_RESPONSE) {
      const sign = data.subarray(-32);
      data = data.subarray(0, -32);

      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(self._tcpKey, 'hex'), Buffer.alloc(16));
      decipher.setAutoPadding(false);

      data = Buffer.from(decipher.update(data, 'hex', 'hex') + decipher.final('hex'), 'hex');

      const calculatedSign = crypto.createHash('sha256').update(Buffer.concat([header, data])).digest('hex');

      if (calculatedSign !== sign.toString('hex')) {
        self.logger.error('SK103._decode: Message signature does not validate');
        return;
      }

      if (padding) {
        data = data.subarray(0, -padding);
      }
    }

    self.responseCount = data.readInt16BE(0, 2);

    data = data.subarray(2);

    return data;
  }

  _encode0x8370 (data, msgType) {
    const self = this;

    self.logger.silly(`SK103._encode0x8370: Entering with ${data.toString('hex')} and msgType=${msgType}`);

    let padding = 0;
    let size = data.length;

    if (msgType === MSGTYPE_ENCRYPTED_REQUEST) {
      if ((size + 2) % 16) {
        padding = 16 - ((size + 2) & 0x0F);
        size += padding + 32;
        data = Buffer.concat([data, Buffer.alloc(padding)]);
      }
    }

    const header = [
      0x83, 0x70,
      (size & 0xFF00) >> 8, size & 0x00FF,
      0x20,
      (padding << 4) | msgType
    ];

    data = Buffer.concat([Buffer.from([(self._requestCount & 0xFF00) >> 8, self._requestCount & 0x00FF]), data]);

    if (++self._requestCount === 0xFFFF) {
      self._requestCount = 0;
    }

    let sign;
    if (msgType === MSGTYPE_ENCRYPTED_REQUEST) {
      sign = crypto.createHash('sha256').update(Buffer.concat([Buffer.from(header), data])).digest('hex');
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(self._tcpKey, 'hex'), Buffer.alloc(16));
      cipher.setAutoPadding(false);
      data = Buffer.from(cipher.update(data, 'hex', 'hex') + cipher.final('hex'), 'hex');
      data = Buffer.concat([data, Buffer.from(sign, 'hex')]);
    }
    return Buffer.concat([Buffer.from(header), data]);
  }

  async _processQueue () {
    const self = this;

    self.logger.debug('SK103._processQueue: Entering');

    if (self._cmdInProgress) {
      return self.logger.debug('SK103._processQueue: Command in progress');
    }

    if (!self._cmdQueue.length) {
      self._connection.destroy();
      return self.logger.silly('SK103._processQueue: No queued commands');
    }

    if (self._cmdQueue[0].label !== 'authenticate' && !self._tcpKey) {
      await self._authenticate()
        .catch(error => {
          self.logger.error(`SK103._processQueue: Failed to authenticate ${error.message}`);
        });

      if (!self._connected || !self._tcpKey) {
        self._cmdQueue[0].handler(!self._tcpKey ? 'Failed to authenticate' : 'Failed to connect');

        // Remove previous command from queue
        self._cmdQueue.shift();
        self._cmdInProgress = false;

        return;
      }
    }

    self._cmdInProgress = true;

    if (self._cmdQueue[0].label !== 'authenticate') {
      let packet;

      // Encrypt cmd packet using the MD5 hash of the static signing key
      const cipher = crypto.createCipheriv('aes-128-ecb', self._signKeyMD5, '');
      packet = Buffer.from(cipher.update(self._cmdQueue[0].cmd, 'hex', 'hex') + cipher.final('hex'), 'hex');

      if (++self._messageId === 0x8000) {
        self._messageId = 1;
      }

      // Prefix the 0x5A5A header
      packet = addHeader0x5A5A(packet, self._messageId, self.id);

      // Append checksum, MD5 hash based on the packet and the static signing key
      packet = Buffer.concat([packet, Buffer.from(crypto.createHash('md5').update(Buffer.concat([packet, Buffer.from(self._signKey)])).digest('hex'), 'hex')]);

      // Encode the packet according to the 8370 packet format
      packet = self._encode0x8370(packet, MSGTYPE_ENCRYPTED_REQUEST);

      self._cmdQueue[0].packet = packet;
    }

    self.logger.debug(`SK103._processQueue: Sending '${self._cmdQueue[0].label}' command`);

    self._connection.write(self._cmdQueue[0].packet, error => {
      if (error) {
        self.logger.error(`SK103._processQueue: Error writing command '${self._cmdQueue[0].label}' (${error.message})`);

        self._cmdInProgress = false;

        if (self._cmdQueue[0].retry) {
          self._cmdQueue[0].retry--;

          self.logger.info(`SK103._write: Retry ${self._cmdQueue[0].label}, ${self._cmdQueue[0].retry} retries left`);

          // Delay before sending the command to prevent flooding
        } else {
          self._cmdQueue[0].handler(error);

          // Remove previous command from queue
          self._cmdQueue.shift();
        }

        setTimeout(() => {
          self._processQueue();
        }, 500);

        return;
      }

      // Start timer to prevent hanging waiting for a response to a command
      self._cmdTimer = setTimeout(self => {
        self.logger.error(`SK103._processQueue: No response received in time for '${self._cmdQueue[0].label}' command`);

        self._cmdInProgress = false;

        if (self._cmdQueue[0].retry) {
          self._cmdQueue[0].retry--;

          self.logger.info(`SK103._processQueue: Retry ${self._cmdQueue[0].label}, ${self._cmdQueue[0].retry} retries left`);

          // Delay before sending the command to prevent flooding
        } else {
          self._cmdQueue[0].handler(new errors.TimeoutError('No response received'));

          // Remove previous command from queue
          self._cmdQueue.shift();
        }

        setTimeout(() => {
          self._processQueue();
        }, 500);
      }, 2000, self);
    });
  }

  _queueCommand (options, handler = () => { }) {
    const self = this;

    self.logger.silly('SK103._queueCommand: Entering');

    // When the priorty property has been set, put this command on the top of the queue
    // This feature is used for authentication
    if (options.priority) {
      self._cmdQueue.unshift({
        cmd: options.cmd,
        packet: options.packet,
        label: options.label,
        noDecode: options.noDecode,
        retry: options.retry,
        handler
      });
    } else {
      self._cmdQueue.push({
        cmd: options.cmd,
        packet: options.packet,
        label: options.label,
        noDecode: options.noDecode,
        retry: options.retry,
        handler
      });
    }

    self._processQueue();
  }

  _request (cmd, label = 'unknown', retry = 0) {
    const self = this;

    self.logger.info(`SK103._request: Entering with ${label}=${cmd.toString('hex')}`);

    return new Promise(async (resolve, reject) => {
      const options = {
        cmd,
        label,
        retry
      };

      if (self._cmdQueue.length === self._maxQueueDepth) {
        self.logger.debug('SK103._request: Maximum queue depth reached');

        return reject(new Error('Maximum queue depth reached'));
      }

      self._queueCommand(options, (error, data) => {
        self.logger.debug('SK103._request: Entering callback');

        if (error) {
          return reject(new Error(error));
        }

        resolve(data);
      });
    });
  }

  async initialize () {
    const self = this;
    let status = {};
    let capabilities = {};

    logger.debug('SK103.initialize: Entering');

    capabilities = await self.getCapabilities(true)
      .catch(error => {
        logger.error(`SK103.initialize: Failed to get capabilities of ${self.id} - ${error.message}`);
      });

    if (capabilities) {
      logger.silly(`SK103.initialize: Capabilities of ${self.id} - ${JSON.stringify(capabilities)}`);
    }

    status = await self.getStatus(true, false)
      .catch(error => {
        throw logger.error(`SK103.initialize: Failed to get current status of ${self.id} - ${error.message}`);
      });

    logger.silly(`SK103.initialize: Current status of ${self.id} - ${JSON.stringify(status)}`);

    self.emit('initialized', {
      status,
      capabilities
    });

    return {
      status,
      capabilities
    };
  }
};
