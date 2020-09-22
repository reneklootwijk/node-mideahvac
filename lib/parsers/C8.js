'use strict'

const logger = require('winston')

// Add a transport as fall back when no parent logger has been initialized
// to prevent the error: "Attempt to write logs with no transports"
logger.add(new logger.transports.Console({
  level: 'none'
}))

// Note that this parser is incomplete since it only features data available on the Comfee MDDF-20DEN7-WF

exports.parser = (data) => {
  logger.debug(`C8.parser: Entering with ${data.toString('hex')}`)

  // Extract the response part from the data (remove header, crc8 and checksum)
  // data = data.subarray(10, data.length - 2)
  data = data.subarray(10)

  const status = {}

  // Byte 1
  status.powerOn = (data[1] & 0x01) > 0

  // Byte 2
  status.dehumidifierMode = (data[2] & 0x0f)

  // Byte 3
  // ABBBBBBB
  // A: 0x00
  // B: fanSpeed
  if ((data[3] & 0x7F) < 21) {
    status.fanSpeed = 20
  } else if ((data[3] & 0x7F) < 41) {
    status.fanSpeed = 40
  } else if ((data[3] & 0x7F) < 61) {
    status.fanSpeed = 60
  } else if ((data[3] & 0x7F) < 101) {
    status.fanSpeed = 80
  } else {
    status.fanSpeed = data[3] & 0x7F
  }

  // Byte 4
  // ABBBBBCC
  // A: onTimerActive
  // B: onTimerHours
  // C: onTimer quarters
  // Byte 5
  // ABBBBBCC
  // A: offTimerActive
  // B: offTimerHours
  // C: offTimer quarters
  // Byte 6
  // AAAABBBB
  // A: onTimer minutes elapsed
  // B: offTimer minutes elapsed
  status.onTimerActive = ((data[4] & 0x80) >> 7) > 0
  status.offTimerActive = ((data[5] & 0x80) >> 7) > 0
  if (status.timerMode) {
    status.onTimerHours = status.onTimerActive ? (data[4] & 0x7C) >> 2 : 0
    status.onTimerMinutes = status.onTimerActive ? ((data[4] & 0x03) + 1) * 15 - ((data[6] & 0xF0) >> 4) : 0
    status.offTimerHours = status.offTimerActive ? (data[5] & 0x7C) >> 2 : 0
    status.offTimerMinutes = status.offTimerActive ? ((data[5] & 0x03) + 1) * 15 - (data[6] & 0x0F) : 0
  } else {
    // TODO: Not tested
    status.onTimerHours = status.onTimerActive ? ((((data[4] & 0x7F) + 1) * 0x0F) - ((data[6] >> 4) & 0x0F)) / 60 : 0
    status.onTimerMinutes = status.onTimerActive ? ((((data[4] & 0x7F) + 1) * 0x0F) - ((data[6] >> 4) & 0x0F)) % 60 : 0
    status.offTimerHours = status.offTimerActive ? ((((data[5] & 0x7F) + 1) * 0x0F) - ((data[6] >> 4) & 0x0F)) / 60 : 0
    status.offTimerMinutes = status.offTimerActive ? ((((data[5] & 0x7F) + 1) * 0x0F) - ((data[6] >> 4) & 0x0F)) % 60 : 0
  }

  status.humiditySetpoint = data[7] > 100 ? 99 : data[7]
  status.currentHumidity = data[16]
  status.errorCode = data[21]

  // Byte 19
  // status.humiditySetpoint = data[19] & 0x7F
  return status
}
