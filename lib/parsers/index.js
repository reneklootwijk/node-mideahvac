'use strict'

const logger = require('winston')
const B5 = require('./B5.js')
const C0 = require('./C0')

// Add a transport as fall back when no parent logger has been initialized
// to prevent the error: "Attempt to write logs with no transports"
logger.add(new logger.transports.Console({
  level: 'none'
}))

exports.parse = (data) => {
  switch (data[10]) {
    case 0xB5:
      return B5.parser(data)
  
    case 0xC0:
      return C0.parser(data)

    default:
      logger.error(`Parsers: Unsupported response type: ${data[10].toString(16)}`)
      logger.error(`Parsers: Unsupported response type: ${data.toString('hex')}`)
      return {}
  }
}