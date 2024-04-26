'use strict';

const crypto = require('crypto');
const dns = require('dns');
const https = require('https');
const logger = require('winston');
const strftime = require('strftime');

const errors = require('./errors');

// Add a transport as fall back when no parent logger has been initialized
// to prevent the error: "Attempt to write logs with no transports"
logger.add(new logger.transports.Console({
  level: 'none'
}));

const dnsLookup = () => (hostname, _, cb) => {
  dns.resolve4(hostname, (error, ips) => {
    logger.debug(`dnsLookup: Returning ${ips[0]} for ${hostname}`);

    if (process.versions.node.split('.')[0] >= 20) {
      cb(error, [{ address: ips[0], family: 4 }]);
    } else {
      cb(error, ips[0], 4);
    }
  });
};

function encryptIAMPassword (appKey, loginId, password) {
  const passwordHash = crypto.createHash('md5').update(password).digest('hex');
  const password2ndHash = crypto.createHash('md5').update(passwordHash).digest('hex');

  return crypto.createHash('sha256').update(loginId + password2ndHash + appKey).digest('hex');
}

function encryptPassword (appKey, loginId, password) {
  const passwordHash = crypto.createHash('sha256').update(password).digest('hex');

  return crypto.createHash('sha256').update(loginId + passwordHash + appKey).digest('hex');
}

function sign (payload, random) {
  const msg = `meicloud${payload}${random}`;

  return crypto.createHmac('sha256', 'PROD_VnoClJI9aikS8dyy').update(msg).digest('hex');
}

module.exports = class {
  constructor (options = {}) {
    if (!options.uid) {
      throw new Error('Cannot instantiate Midea cloud client because no user has been specified');
    }

    if (!options.password) {
      throw new Error('Cannot instantiate Midea cloud client because no password has been specified');
    }

    this._appKey = options.appKey || 'ac21b9f9cbfe4ca5a88562ef25e2b768';
    this.host = options.host || 'mp-prod.appsmb.com';
    this.password = options.password;
    this.port = options.port || 443;
    this.uid = options.uid;

    this._appId = '1010';
    this._clientType = 1; // 0: PC, 1: Android, 2: IOS
    this._connected = false;
    this._format = 2; // JSON
    this._language = 'en_US';
    this._loginId = null;
    this._sessionId = null;
    this._src = '1010';

    this._accessToken = '';
    this._authenticatePromise = null;
  }

  // Note: The hostname of the Midea cloud returns multiple IP addresses round
  // robin. However, often 1 or more addresses are unreachable and for this reason
  // the connection must be retried when the connection cannot be established but make
  // sure the round robin mechanism is honoured, which the default dns.lookup does not do.
  _apiRequest (options, payload = {}, random = true) {
    const self = this;

    logger.silly('MideaCloudClient._apiRequest: Entering');

    return new Promise((resolve, reject) => {
      options.method = options.method || 'GET';
      options.hostname = self.host;
      options.path = `/mas/v5/app/proxy?alias=${options.path || '/'}`;
      options.agent = new https.Agent({ lookup: dnsLookup() });
      // options.timeout = 5000;

      options.body = JSON.stringify(payload);

      const randomString = random ? Math.floor(new Date().getTime() / 1000).toString() : '';
      const signature = sign(options.body, randomString);

      options.headers = {
        sign: signature,
        secretVersion: '1',
        random: randomString,
        'Content-Type': 'application/json',
        accessToken: self._accessToken
      };

      logger.debug(`MideaCloudClient._apiRequest: Options = ${JSON.stringify(options)}`);

      let maxRetryAttempts = 5;
      const retry = () => {
        const req = https.request(options, res => {
          res.on('data', data => {
            if (res.statusCode === 200) {
              try {
                data = JSON.parse(data);

                switch (parseInt(data.code, 10)) {
                  case 0:
                    return resolve(data);

                  case 1:
                    return reject(new errors.UnknownError('Unknown error'));

                  case 30005:
                    return reject(new errors.BadRequestError('Invalid argument'));

                  case 40001:
                    return reject(new errors.AuthorizationError('No access token supplied'));

                  case 40404:
                    return reject(new errors.BadRequestError('No route matched with those values'));

                  case 44003:
                    return reject(new errors.SigningError('Bad signature'));

                  default:
                    return reject(new errors.UnknownError(`${data.msg} (${data.code})`));
                }
              } catch (error) {
                return reject(error);
              }
            } else {
              return reject(new Error());
            }
          });
        });

        req.on('error', error => {
          return reject(error);
        });

        req.on('timeout', () => {
          if (--maxRetryAttempts) {
            logger.debug('MideaCloudClient._apiRequest: Timeout, retrying...');
            retry();
          } else {
            return reject(new errors.TimeoutError('Failed to get login id'));
          }
        });

        if (options.body) {
          req.write(options.body);
        }

        req.end();
      };

      return retry();
    });
  }

  async _authenticate (deviceId = crypto.randomBytes(8).toString('hex')) {
    const self = this;

    logger.silly('MideaCloudClient._authenticate: Entering');

    if (!self._authenticatePromise) {
      // First get the login Id
      self._loginId = await self._getLoginId(deviceId, self.uid)
        .catch(error => {
          throw (error);
        });
      logger.debug(`MideaCloudClient._authenticate: Obtained loginId = ${self._loginId}`);

      // Get user id, access token and session id
      this._authenticatePromise = new Promise((resolve, reject) => {
        self._apiRequest({ method: 'POST', path: '/mj/user/login' }, {
          appId: '1010',
          format: 2,
          clientType: 1,
          language: 'en_US',
          src: '1010',
          stamp: strftime('%Y%m%d%H%M%S'),
          reqId: crypto.randomBytes(16).toString('hex'),
          data: {
            appKey: self._appKey,
            deviceId,
            platform: 2
          },
          iotData: {
            appId: '1010',
            clientType: 1,
            iampwd: encryptIAMPassword(self._appKey, self._loginId, self.password),
            loginAccount: self.uid,
            password: encryptPassword(self._appKey, self._loginId, self.password),
            pushToken: crypto.randomBytes(120).toString('base64'),
            reqId: crypto.randomBytes(16).toString('hex'),
            src: '1010',
            stamp: strftime('%Y%m%d%H%M%S')
          }
        })
          .then(response => {
            // // Persist data
            self._accessToken = response.data.mdata.accessToken;

            self._authenticatePromise = null;

            logger.debug(`MideaCloudClient._authenticate: Obtained accessToken = ${self._accessToken}`);

            return resolve({
              accessToken: self._accessToken
            });
          })
          .catch(error => {
            self._authenticatePromise = null;
            return reject(error);
          });
      });
    }

    return self._authenticatePromise;
  }

  _getLoginId (deviceId) {
    const self = this;

    logger.silly(`MideaCloudClient._getLoginId: Entering with deviceId=${deviceId} and uid = ${self.uid}`);

    return new Promise((resolve, reject) => {
      // Obtain login id
      self._apiRequest({ method: 'POST', path: '/v1/user/login/id/get' }, {
        appId: '1010',
        format: 2,
        clientType: 1,
        language: 'en_US',
        src: '1010',
        stamp: strftime('%Y%m%d%H%M%S'),
        deviceId,
        reqId: crypto.randomBytes(16).toString('hex'),
        loginAccount: self.uid
      })
        .then(response => {
          // Persist login id
          self._loginId = response.data.loginId;

          resolve(self._loginId);
        })
        .catch(error => {
          logger.error(`MideaCloudClient._getLoginId: Failed to obtain login Id - ${error.message} (${error.name})`);

          return reject(new Error('An unknown error occurred'));
        });
    });
  }

  async getToken (deviceId, udpId) {
    const self = this;

    logger.silly(`MideaCloudClient._getToken: Entering with deviceId = ${deviceId} and udpId = ${udpId}`);

    if (!self._accessToken) {
      await self._authenticate(deviceId)
        .catch(error => {
          throw (error);
        });
    }

    return new Promise((resolve, reject) => {
      // Obtain token
      self._apiRequest({ method: 'POST', path: '/v1/iot/secure/getToken' }, {
        appId: '1010',
        format: 2,
        clientType: 1,
        language: 'en_US',
        src: '1010',
        stamp: strftime('%Y%m%d%H%M%S'),
        reqId: crypto.randomBytes(16).toString('hex'),
        udpid: udpId
      })
        .then(response => {
          response.data.tokenlist.forEach(pair => {
            if (udpId === pair.udpId) {
              return resolve({
                key: pair.key,
                token: pair.token
              });
            }
          });

          reject(new Error('No token and key pair received'));
        })
        .catch(error => {
          logger.error(`MideaCloudClient._getToken: ${error.message} (${error.name})`);

          reject(new Error('An unknown error occurred'));
        });
    });
  }
};
