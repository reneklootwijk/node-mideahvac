const udp = require('dgram')
const crypto = require('crypto')

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
])

const signKey = 'xhdiwjnchekd4d512chdjx5d8e4c394D2D7S'
const appliances = []
const applianceTypes = {
  161: 'Dehumidifier',
  172: 'Air Conditioner',
  250: 'Fan',
  252: 'Air Purifier',
  253: 'Humidifier'
}

function decrypt (data) {
  const key = crypto.createHash('md5').update(signKey).digest()

  const decipher = crypto.createDecipheriv('aes-128-ecb', key, '')

  decipher.setAutoPadding(false)

  return Buffer.from(decipher.update(data, 'hex', 'hex') + decipher.final('hex'), 'hex')
}

// creating a client socket
var client = udp.createSocket('udp4')

setTimeout(() => {
  console.log(JSON.stringify(appliances))
  process.exit(0)
}, 2000)

client.bind({}, () => {
  client.setBroadcast(true)

  client.send(broadcast, 0, broadcast.length, 6445, '255.255.255.255', error => {
    if (error) {
      console.log(error)
      client.close()
    }
  })
})

client.on('message', (msg, info) => {
  // console.log('Data received ' + msg.toString('hex'))
  // console.log('Received %d bytes from %s:%d\n', msg.length, info.address, info.port)

  if (msg[0] === 0x83 && msg[1] === 0x70) {
    msg = msg.subarray(8, msg.length - 16)
    // console.log('New encryption method')
  }

  if (msg[0] === 0x5A && msg[0] === 0x5A && msg.length > 104) {
    // Get the bytes specifying the Id and reverse them
    const id = parseInt(msg.subarray(20, 26).toString('hex').match(/../g).reverse().join(''), 16)
    const data = decrypt(msg.subarray(40, msg.length - 16))

    appliances.push({
      id,
      sn: data.subarray(8, 40).toString(),
      ssid: data.subarray(41, 41 + data[40]).toString(),
      port: parseInt(data.subarray(4, 8).toString('hex').match(/../g).reverse().join(''), 16),
      macAddress: `${data[63 + data[40]].toString(16)}:${data[64 + data[40]].toString(16)}:${data[65 + data[40]].toString(16)}:${data[66 + data[40]].toString(16)}:${data[67 + data[40]].toString(16)}:${data[68 + data[40]].toString(16)}`,
      applianceType: applianceTypes[data[55 + data[40]]],
      applianceSubType: parseInt(data.subarray(57 + data[40], 59 + data[40]).toString('hex').match(/../g).reverse().join(''), 16),
      firmwareVersion: `${data[72 + data[40]]}.${data[73 + data[40]]}.${data[74 + data[40]]}`
    })
  }
})
