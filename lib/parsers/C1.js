'use strict'

const logger = require('winston')

// Add a transport as fall back when no parent logger has been initialized
// to prevent the error: "Attempt to write logs with no transports"
logger.add(new logger.transports.Console({
  level: 'none'
}))

exports.parser = (data) => {
  logger.debug(`C1.parser: Entering with ${data.toString('hex')}`)

  // Extract the response part from the data (remove header, crc8 and checksum)
  // data = data.subarray(10, data.length - 2)
  data = data.subarray(10)

  // Byte 16, 17, and 18 contain the binary coded decimal representation of
  // the current power usage
  var n = 0
  var m = 1
  for (let i = 0; i < 3; i++) {
    n += (data[18 - i] & 0x0F) * m
    n += ((data[18 - i] >> 4) & 0x0F) * m * 10
    m *= 100
  }

  return { powerUsage: n / 10000 }
}
