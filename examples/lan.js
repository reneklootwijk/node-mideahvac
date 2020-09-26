const appliances = require('../lib')
const logger = require('winston')

logger.remove(logger.transports.Console)
logger.add(new logger.transports.Console({
  format: logger.format.combine(
    logger.format.timestamp(),
    logger.format.colorize(),
    logger.format.printf(event => {
      return `${event.timestamp} ${event.level}: ${event.message}`
    })
  ),
  level: 'debug'
}))

// Specify your specific information
const ac = appliances.createAppliance({
  deviceId: <deviceId>,
  communicationMethod: 'lan',
  host: <IP address>,
  password: <password>
})

ac._authenticate()
