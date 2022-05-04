#! /usr/bin/env node
const udp = require('dgram');
const crypto = require('crypto');
const CloudConnection = require('./lib/cloud.js');
const logger = require('winston');

logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console({
  format: logger.format.combine(
    logger.format.timestamp(),
    logger.format.colorize(),
    logger.format.printf(event => {
      return `${event.timestamp}: ${event.message}`;
    })
  ),
  level: 'nonegit '
}));

const appliances = [];
const applianceTypes = {
  0xA1: 'Dehumidifier',
  0xAC: 'Air Conditioner',
  0xFA: 'Fan',
  0xFC: 'Air Purifier',
  0xFD: 'Humidifier'
};
const broadcast = Buffer.from([
  0x5a, 0x5a, 0x01, 0x11, 0x48, 0x00, 0x92, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x7f, 0x75, 0xbd, 0x6b, 0x3e, 0x4f, 0x8b, 0x76,
  0x2e, 0x84, 0x9c, 0x6e, 0x57, 0x8d, 0x65, 0x90,
  0x03, 0x6e, 0x9d, 0x43, 0x42, 0xa5, 0x0f, 0x1f,
  0x56, 0x9e, 0xb8, 0xec, 0x91, 0x8e, 0x92, 0xe5
]);
let newEncryptionVersion = false;
const signKey = 'xhdiwjnchekd4d512chdjx5d8e4c394D2D7S';
let cloudClient;
let password;
let user;

function decrypt (data) {
  const key = crypto.createHash('md5').update(signKey).digest();

  const decipher = crypto.createDecipheriv('aes-128-ecb', key, '');

  decipher.setAutoPadding(false);

  return Buffer.from(decipher.update(data, 'hex', 'hex') + decipher.final('hex'), 'hex');
}

// creating a client socket
const client = udp.createSocket('udp4');

// Process command line arguments
for (let i = 2; i < process.argv.length; i++) {
  let arg;
  let value;

  if (process.argv[i].match(/^--[^=]+=[^\s]+/)) {
    [, arg = '', value = ''] = /^--([^=]+)=([^\s]+)/.exec(process.argv[i]);
  }

  if (process.argv[i].match(/^-([^\s]{1}$)/)) {
    arg = process.argv[i][1];
    value = process.argv[i + 1];

    i++;
  }

  switch (arg) {
    case 'U':
    case 'user':
      user = value;
      break;

    case 'P':
    case 'password':
      password = value;
      break;

    default:
      console.log('discover [options]');
      console.log('-U, --user\tuser name to authenticate to the Midea cloud');
      console.log('-P, --password\tpassword to authenticate to the Midea cloud');
      process.exit(1);
  }
}

// Create client for Midea cloud when user and password has been specified
if (user && password) {
  cloudClient = new CloudConnection({
    uid: user,
    password: password
  });
}

setTimeout(async () => {
  console.log(`Found ${appliances.length} appliances:\n`);
  for (let i = 0; i < appliances.length; i++) {
    console.log(`Appliance ${i + 1}:`);
    console.log(`- Id: ${appliances[i].id}`);
    console.log(`- Host: ${appliances[i].host}`);
    console.log(`- Port: ${appliances[i].port}`);
    console.log(`- MAC Address: ${appliances[i].macAddress}`);
    console.log(`- Serial No.: ${appliances[i].sn}`);
    console.log(`- Appliance Type: ${appliances[i].applianceType}`);
    console.log(`- Firmware Version: ${appliances[i].firmwareVersion}`);
    console.log(`- New Encryption Version: ${appliances[i].newEncryptionVersion}`);
    console.log(`- UDP Id: ${appliances[i].udpId}`);

    if (cloudClient) {
      await cloudClient.getToken(appliances[i].udpId)
        .then(pair => {
          appliances[i].key = pair.key;
          appliances[i].token = pair.token;
        })
        .catch(error => {
          appliances[i].key = error.message;
          appliances[i].token = error.message;
        });
    } else {
      appliances[i].key = 'No midea cloud credentials specified';
      appliances[i].token = 'No midea cloud credentials specified';
    }

    console.log(`- Authentication Key: ${appliances[i].key}`);
    console.log(`- Authentication Token: ${appliances[i].token}\n`);
  }

  process.exit(0);
}, 5000);

client.bind({}, () => {
  client.setBroadcast(true);

  client.send(broadcast, 0, broadcast.length, 6445, '255.255.255.255', error => {
  // client.send(broadcast, 0, broadcast.length, 6445, '192.168.5.62', error => {
    if (error) {
      console.log(error);
      client.close();
    }
  });
});

client.on('message', async (msg, info) => {
  newEncryptionVersion = false;

  if (msg[0] === 0x83 && msg[1] === 0x70) {
    msg = msg.subarray(8, msg.length - 16);
    newEncryptionVersion = true;
  }

  if (msg[0] === 0x5A && msg.length >= 104) {
    // Get the bytes specifying the Id and reverse them
    const id = parseInt(msg.subarray(20, 26).toString('hex').match(/../g).reverse().join(''), 16);
    const data = decrypt(msg.subarray(40, msg.length - 16));

    const appliance = {
      id,
      host: info.address,
      sn: data.subarray(8, 40).toString(),
      ssid: data.subarray(41, 41 + data[40]).toString(),
      port: parseInt(data.subarray(4, 8).toString('hex').match(/../g).reverse().join(''), 16),
      macAddress: `${data[63 + data[40]].toString(16)}:${data[64 + data[40]].toString(16)}:${data[65 + data[40]].toString(16)}:${data[66 + data[40]].toString(16)}:${data[67 + data[40]].toString(16)}:${data[68 + data[40]].toString(16)}`,
      applianceType: applianceTypes[data[55 + data[40]]] || 'Unknown',
      applianceSubType: parseInt(data.subarray(57 + data[40], 59 + data[40]).toString('hex').match(/../g).reverse().join(''), 16),
      firmwareVersion: `${data[72 + data[40]]}.${data[73 + data[40]]}.${data[74 + data[40]]}`,
      newEncryptionVersion
    };

    if (newEncryptionVersion) {
      const digest = Buffer.from(crypto.createHash('sha256').update(Buffer.from(msg.subarray(20, 26).toString('hex'), 'hex')).digest('hex'), 'hex');

      const udpId = Buffer.alloc(16);
      for (let i = 0; i < 16; i++) {
        udpId[i] = digest[i] ^ digest[i + 16];
      }

      appliance.udpId = udpId.toString('hex');
    }

    appliances.push(appliance);
  }
});
