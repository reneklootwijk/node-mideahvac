'use strict'

const logger = require('winston')

// Add a transport as fall back when no parent logger has been initialized
// to prevent the error: "Attempt to write logs with no transports"
logger.add(new logger.transports.Console({
  level: 'none'
}))

const capabilities = {
  autoMode: true,
  autoAdjustDownTemp: 17,
  autoAdjustUpTemp: 30,
  coolMode: true,
  coolAdjustDownTemp: 17,
  coolAdjustUpTemp: 30,
  dryMode: true,
  ecoMode: false,
  frostProtectionMode: false,
  electricAuxHeating: false, // dianfure
  hasAutoClearHumidity: false,
  hasAvoidPeople: false,
  hasBlowingPeople: false,
  hasBreeze: false,
  hasHandClearHumidity: false,
  hasNoWindFeel: false,
  hasNoWindSpeed: false,
  hasSelfClean: false,
  heatMode: true,
  heatAdjustDownTemp: 17,
  heatAdjustUpTemp: 30,
  horizontalSwingMode: false,
  isHavePoint: false,
  leftNum: 0,
  lightType: 0,
  mutilTemp: true,
  nestCheck: true,
  nestNeedChange: true,
  powerCal: false,
  powerCalSetting: false,
  selfcheck: true,
  specialEco: false,
  strongCoolMode: true,
  strongHeatMode: false,
  unitChangeable: true,
  verticalSwingMode: true
}

exports.parser = (data) => {
  logger.silly(`B5.parser: Entering with ${data.toString('hex')}`)

  // Extract the response part from the data (remove header, crc8 and checksum)
  // data = data.subarray(10, data.length - 2)

  let i = 12
  let caps2process = data[11]
  while (i < data.length - 2 && caps2process) {
    if (data[i + 1] === 0x00) {
      switch (data[i]) {
        case 0x18:
          logger.silly(`B5.parser: Parsing hasNoWindFeel capability ${data[i + 3]}`)
          capabilities.hasNoWindFeel = data[i + 3] > 0
          break

        case 0x32:
          logger.silly(`B5.parser: Parsing hasBlowingPeople capability ${data[i + 3]}`)
          capabilities.hasBlowingPeople = data[i + 3] > 0
          break

        case 0x33:
          logger.silly(`B5.parser: Parsing hasAvoidPeople capability ${data[i + 3]}`)
          capabilities.hasAvoidPeople = data[i + 3] > 0
          break

        case 0x39:
          logger.silly(`B5.parser: Parsing hasSelfClean capability ${data[i + 3]}`)
          capabilities.hasSelfClean = data[i + 3] > 0
          break

        case 0x43:
          logger.silly(`B5.parser: Parsing hasBreeze capability ${data[i + 3]}`)
          capabilities.hasBreeze = data[i + 3] > 0
          break
      }
    }

    if (data[i + 1] === 0x02) {
      switch (data[i]) {
        case 0x10:
          logger.silly(`B5.parser: Parsing hasNoWindSpeed capability ${data[i + 3]}`)
          capabilities.hasNoWindSpeed = data[i + 3] > 0
          break

        case 0x12:
          logger.silly(`B5.parser: Parsing eco/specialEco capability ${data[i + 3]}`)
          capabilities.ecoMode = data[i + 3] === 1
          capabilities.specialEco = data[i + 3] === 2
          break

        case 0x13:
          logger.silly(`B5.parser: Parsing frostProtectionMode capability ${data[i + 3]}`)
          capabilities.frostProtectionMode = data[i + 3] === 1
          break

        case 0x14:
          logger.silly(`B5.parser: Parsing heat/cool/dry/auto capability ${data[i + 3]}`)
          switch (data[i + 3]) {
            case 0:
              capabilities.heatMode = false
              capabilities.coolMode = true
              capabilities.dryMode = true
              capabilities.autoMode = true
              break

            case 1:
              capabilities.coolMode = true
              capabilities.heatMode = true
              capabilities.dryMode = true
              capabilities.autoMode = true
              break

            case 2:
              capabilities.coolMode = false
              capabilities.dryMode = false
              capabilities.heatMode = true
              capabilities.autoMode = true
              break

            case 3:
              capabilities.coolMode = true
              capabilities.dryMode = false
              capabilities.heatMode = false
              capabilities.autoMode = false
              break
          }
          break

        case 0x15:
          logger.silly(`B5.parser: Parsing verticalSwing/horizontalSwing capability ${data[i + 3]}`)
          switch (data[i + 3]) {
            case 0:
              capabilities.verticalSwingMode = false
              capabilities.horizontalSwingMode = true
              break

            case 1:
              capabilities.verticalSwingMode = true
              capabilities.horizontalSwingMode = true
              break

            case 2:
              capabilities.verticalSwingMode = false
              capabilities.horizontalSwingMode = false
              break

            case 3:
              capabilities.verticalSwingMode = true
              capabilities.horizontalSwingMode = false
              break
          }
          break

        case 0x16:
          logger.silly(`B5.parser: Parsing powerCal/powerCalSetting capability ${data[i + 3]}`)
          switch (data[i + 3]) {
            case 0:
            case 1:
              capabilities.powerCal = false
              capabilities.powerCalSetting = false
              break

            case 2:
              capabilities.powerCal = true
              capabilities.powerCalSetting = false
              break

            case 3:
              capabilities.powerCal = true
              capabilities.powerCalSetting = true
              break
          }
          break

        case 0x17:
          logger.silly(`B5.parser: Parsing nestCheck/nestNeedChange capability ${data[i + 3]}`)
          switch (data[i + 3]) {
            case 0:
              capabilities.nestCheck = false
              capabilities.nestNeedChange = false
              break

            case 1:
            case 2:
              capabilities.nestCheck = true
              capabilities.nestNeedChange = false
              break

            case 3:
              capabilities.nestCheck = false
              capabilities.nestNeedChange = true
              break

            case 4:
              capabilities.nestCheck = true
              capabilities.nestNeedChange = true
              break
          }
          break

        case 0x19:
          logger.silly(`B5.parser: Parsing electricAuxHeating capability ${data[i + 3]}`)
          capabilities.electricAuxHeating = data[i + 3] === 1
          break

        case 0x1A:
          logger.silly(`B5.parser: Parsing strongHeat/strongCool capability ${data[i + 3]}`)
          switch (data[i + 3]) {
            case 0:
              capabilities.strongHeat = false
              capabilities.strongCool = true
              break

            case 1:
              capabilities.strongHeat = true
              capabilities.strongCool = true
              break

            case 2:
              capabilities.strongHeat = false
              capabilities.strongCool = false
              break

            case 3:
              capabilities.strongHeat = true
              capabilities.strongCool = false
              break
          }
          break

        case 0x1F:
          logger.silly(`B5.parser: Parsing hasAutoClearHumidity/hasHandClearHumidity capability ${data[i + 3]}`)
          switch (data[i + 3]) {
            case 0:
              capabilities.hasAutoClearHumidity = false
              capabilities.hasHandClearHumidity = false
              break

            case 1:
              capabilities.hasAutoClearHumidity = true
              capabilities.hasHandClearHumidity = false
              break

            case 2:
              capabilities.hasAutoClearHumidity = true
              capabilities.hasHandClearHumidity = true
              break

            case 3:
              capabilities.hasAutoClearHumidity = false
              capabilities.hasHandClearHumidity = true
              break
          }
          break

        case 0x22:
          logger.silly(`B5.parser: Parsing unitChangeable capability ${data[i + 3]}`)
          capabilities.unitChangeable = data[i + 3] === 0
          break

        case 0x24:
          logger.silly(`B5.parser: Parsing lightType capability ${data[i + 3]}`)
          capabilities.lightType = data[i + 3]
          break

        case 0x25:
          logger.silly(`B5.parser: Parsing adjust temp capability ${data[i + 3]}`)
          capabilities.coolAdjustDownTemp = data[i + 3] / 2
          capabilities.coolAdjustUpTemp = data[i + 4] / 2
          capabilities.autoAdjustDownTemp = data[i + 5] / 2
          capabilities.autoAdjustUpTemp = data[i + 6] / 2
          capabilities.heatAdjustDownTemp = data[i + 7] / 2
          capabilities.heatAdjustUpTemp = data[i + 8] / 2

          // isHavePoint is relevant temperature in Fahrenheit
          if (data[i + 2] > 6) {
            capabilities.isHavePoint = data[i + 9] !== 0
          } else {
            capabilities.isHavePoint = data[i + 2] !== 0
          }
          break
      }
    }

    // Increment cursor and decrement capabilities to process
    i += (3 + data[i + 2])
    caps2process--
  }

  return capabilities
}
