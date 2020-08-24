'use strict'

const logger = require("winston")

// Add a transport as fall back when no parent logger has been initialized
// to prevent the error: "Attempt to write logs with no transports"
logger.add(new logger.transports.Console({
  level: 'none'
}))

exports.parser = (data) => {
  logger.debug(`C0.parser: Entering with ${data.toString('hex')}`)

  // Extract the response part from the data (remove header, crc8 and checksum)
  // data = data.subarray(10, data.length - 2)
  data = data.subarray(10)

  const status = {}

  // Byte 1
  // ABCDEFGH
  // A: inError
  // B: fastCheckActive??
  // C: 0x00
  // D: timerMode (0: relative, 1: absolute)
  // E: resumeActive (resume previous status after power failure????)
  // F: 0x00
  // G: 0x00
  // H: powerStatus
  status.inError = ((data[1] & 0x80) >> 7) > 0
	status.fastCheckActive = ((data[1] & 0x20) >> 5) > 0
  status.timerMode = (data[1] & 0x10) >> 4
  status.resumeActive = ((data[1] & 0x04) >> 2) > 0
  status.powerOn = (data[1] & 0x01) > 0

  // Byte 2
  // AAABCCCC
  // A: mode
  // B: decimal (0.5) of setpoint
  // C: degrees of setpoint - 16
  status.setpoint = (data[2] & 0x0F) + 16 + ((data[2] & 0x10) >> 4) * 0.5
  status.mode = (data[2] & 0xE0) >> 5

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

  // Byte 7
  // AAAABBCC
  // A: ?
  // B: horizontalSwingActive
  // C: verticalSwingActive
  status.verticalSwingActive = (data[7] & 0x03) > 0
  status.horizontalSwingActive = (data[7] & 0x0C) > 0
  
  //  Byte 8
  status.personalFeeling = ((data[8] & 0x80) >> 7) > 0 // bodySense Is this using the RC as remote temperature sensor???
  status.wiseEye = ((data[8] & 0x40) >> 6) > 0 // energySave
  status.strong = ((data[8] & 0x20) >> 5) > 0 // superFan / tubro
  status.lowFrequencyFan = ((data[8] & 0x10) >> 4) > 0 // farceWind
  status.powerSave = ((data[8] & 0x08) >> 3) > 0
  status.alarmSleep = ((data[8] & 0x04) > 2) > 0
  status.cosySleepMode = data[8] & 0x03
  
  // Byte 9 
  status.selfPersonalFeeling = ((data[9] & 0x80) >> 7) > 0 // selfFeelOwn
  status.sleepModeActive = ((data[9] & 0x40) >> 6) > 0 // selfCosySleep, this is a duplicate with data[10] & 0x01
  status.purifyingModeActive = ((data[9] & 0x20) >> 5) > 0 // cleanUp
  status.ecoModeActive = ((data[9] & 0x10) >> 4) > 0 // eco
  status.ptcHeaterActive = ((data[9] & 0x08) >> 3) > 0 // capability: electricAuxHeating
  status.dryClean = ((data[9] & 0x04) >> 2) > 0 // diyFunc
  status.naturalWindModeActive = ((data[9] & 0x02) >> 1) > 0 // exchange air / naturalFan
  status.childSleepMode = (data[9] & 0x01) > 0 // Intelligent eye

  // Byte 10
  status.coolWindMode = ((data[10] & 0x80) >> 7) > 0
  status.peakValleyMode = ((data[10] & 0x40) >> 6) > 0 // naturalWind
  status.catchCold = ((data[10] & 0x20) >> 5) > 0 // peakValleyMode
  status.nightLight = ((data[10] & 0x10) >> 4) > 0
  status.ventilation = ((data[10] & 0x08) >> 3) > 0
  status.temperatureUnit = ((data[10] & 0x04) >> 2) > 0
  status.turboModeActive = ((data[10] & 0x02) >> 1) > 0 // capability: strongCool/strongHeat
  // FIXME: Is this a duplicate with byte 9 bit 6?
  status.sleepModeActive = (data[10] & 0x01) > 0
  
  // Byte 11
  status.indoorTemperature = (data[11] - 50) / 2 
  
  // Byte 12
  status.outdoorTemperature = (data[12] - 50) / 2 
  
  // Byte 13
  status.dustFull = ((data[13] & 0x20) >> 1) > 0
  status.settingTemperature2 = data[13] & 0x1F // {0:"invalid",1:"13℃",2:"14℃",3:"15℃",17:"30℃", 18:"31℃",19:"32℃",20:"33℃",21:"34℃",22:"35℃"}
  
  // Byte 14
  // Predicted Mean Vote Model 
  // FIXME: DOES NOT MATCH POSSIBLE VALUES
  status.pmvMode = data[14] & 0x0F // {0:"PMV off",1:"PMV=-3",2:"PMV=-2.5",3:"PMV=-2",4: "PMV function-1.5",5:"PMV function-1",6:"PMV function-0.5",7:"PMV function 0",8:"PMV function 0.5",9:"PMV function 1",10 :"PMV function 1.5",11:"PMV function 2",12:"PMV function 2.5"}
  status.lightClass = (data[14] & 0x70) >> 4 // Brightness of the LED display???

  // Byte 15 
  // status.indoorTemperatureDot = data[15] & 0x0F 
  // status.outdoorTemperatureDot = (data[15] & 0xF0) >> 4

  // Byte 16
  // AAAAAAAA
  // A: errorCode
  status.errorCode = data[16]

  // Byte 17
  status.ecoSleepRunningMinutes = (data[17] & 0xF4) >> 3 // 0-59
  
  // Byte 18
  status.ecoSleepRunningSeconds = (data[18] & 0xF0) >> 2 | data[17] & 0x02 // 0 - 59
  status.ecoSleepRunningHours = data[18] & 0x0F // 0 - 10

  // Byte 19
  status.humiditySetpoint = data[19] & 0x7F  
  status.downWindControl = ((data[19] & 0x80) >> 7) > 0

  // Byte 20
  status.downWindControlLR = ((data[20] & 0x80) >> 7) > 0

  // Byte 21
  // ABCCCCCD
  // A: frostProtectionModeActive
  // B: twoControl
  // C: temp
  // D: tempDot
  status.frostProtectionModeActive = ((data[21] & 0x80) >> 7) > 0

  if (data.length > 24) {
    // Byte 22
    status.windBlowing = ((data[22] & 0x10) >> 4) > 0
    // status.smartWind = ((data[22] & 0x04) >> 3) > 0
    status.braceletHomeAwayMode = ((data[22] & 0x04) >> 2) > 0
    status.braceletSleepMode = ((data[22] & 0x02) >> 1) > 0
    status.keepWarm = (data[22] & 0x01) > 0
  }

  // status.order = data[data.length - 2]

  // Correct temperature when unit is set to Fahrenheit
  // if (status.temperatureUnit) {
  //   status.setpoint = status.setpoint * 1.8 + 32
  //   // FIXME: IS THIS REQUIRED?
  //   // status.indoorTemperature = status.indoorTemperature * 1.8 + 32
  //   // status.outdoorTemperature = status.outdoorTemperature * 1.8 + 32
  // }

  return status
}
