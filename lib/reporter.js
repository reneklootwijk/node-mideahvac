module.exports = (properties) => {
  const modes = ['no sleep', 'sleep 1', 'sleep 2', 'sleep 3']
  const report = {}

  for (const property in properties) {
    switch (property) {
      case 'cosySleepMode':
        report.cosySleepMode = { value: properties[property], description: modes[properties[property]] }
        break

      case 'fanSpeed':
        switch (properties[property]) {
          case 20:
            report.fanSpeed = { value: 20, description: 'silent' }
            break

          case 40:
            report.fanSpeed = { value: 40, description: 'low' }
            break

          case 60:
            report.fanSpeed = { value: 60, description: 'medium' }
            break

          case 80:
            report.fanSpeed = { value: 80, description: 'high' }
            break

          case 101:
            report.fanSpeed = { value: 101, description: 'fixed' }
            break

          case 102:
            report.fanSpeed = { value: 102, description: 'auto' }
            break

          default:
            report.fanSpeed = { value: properties[property], description: 'unknown' }
        }
        break

      case 'errorCode':
        switch (properties[property]) {
          case 0:
            report.errorCode = { value: 0, description: '' }
            break

          case 1:
            report.errorCode = { value: 1, description: 'interior board and display board communication failure' }
            break

          case 2:
            report.errorCode = { value: 2, description: 'indoor main control board failure' }
            break

          case 3:
            report.errorCode = { value: 3, description: 'indoor board and outdoor board communication failure' }
            break

          case 4:
            report.errorCode = { value: 4, description: 'zero crossing detection failure' }
            break

          case 5:
            report.errorCode = { value: 5, description: 'indoor board fan stall failure' }
            break

          case 6:
            report.errorCode = { value: 6, description: 'outdoor condenser sensor failure' }
            break

          case 7:
            report.errorCode = { value: 7, description: 'outdoor ambient temperature sensor failure' }
            break

          case 8:
            report.errorCode = { value: 8, description: 'outdoor compression engine exhaust temperature sensor failure' }
            break

          case 9:
            report.errorCode = { value: 9, description: 'outdoor failure' }
            break

          case 10:
            report.errorCode = { value: 10, description: 'indoor temperature sensor failure' }
            break

          case 11:
            report.errorCode = { value: 11, description: 'indoor evaporator temperature sensor failure' }
            break

          case 12:
            report.errorCode = { value: 12, description: 'outdoor wind speed stall failure' }
            break

          case 13:
            report.errorCode = { value: 13, description: 'ipm module protection' }
            break

          case 14:
            report.errorCode = { value: 14, description: 'Voltage protection' }
            break

          case 15:
            report.errorCode = { value: 15, description: 'outdoor compressor top temperature protection' }
            break

          case 16:
            report.errorCode = { value: 16, description: 'outdoor temperature too low protection' }
            break

          case 17:
            report.errorCode = { value: 17, description: 'compressor position protection' }
            break

          case 18:
            report.errorCode = { value: 18, description: 'display panel fault' }
            break

          case 21:
            report.errorCode = { value: 21, description: 'outer pipe temperature protection' }
            break

          case 23:
            report.errorCode = { value: 23, description: 'exhaust high temperature protection' }
            break

          case 25:
            report.errorCode = { value: 25, description: 'heating and cold wind protection' }
            break

          case 26:
            report.errorCode = { value: 26, description: 'current protection' }
            break

          case 29:
            report.errorCode = { value: 29, description: 'evaporator high and low temperature protection' }
            break

          case 30:
            report.errorCode = { value: 30, description: 'condenser high and low temperature protection frequency limit' }
            break

          case 31:
            report.errorCode = { value: 31, description: 'exhaust high and low temperature protection' }
            break

          case 32:
            report.errorCode = { value: 32, description: 'indoor and outdoor communication mismatch protocol' }
            break

          case 33:
            report.errorCode = { value: 33, description: 'refrigerant leakage protection' }
            break

          default:
            report.errorCode = { value: properties[property], description: 'unknown error' }
        }
        break

      case 'mode':
        switch (properties[property]) {
          case 1:
            report.mode = { value: 1, description: 'auto' }
            break

          case 2:
            report.mode = { value: 2, description: 'cool' }
            break

          case 3:
            report.mode = { value: 3, description: 'dry' }
            break

          case 4:
            report.mode = { value: 4, description: 'heat' }
            break

          case 5:
            report.mode = { value: 5, description: 'fanonly' }
            break

          default:
            report.mode = { value: properties[property], description: 'invalid mode' }
        }
        break

      case 'temperatureUnit':
        report.temperatureUnit = { value: properties[property], description: properties[property] ? 'fahrenheit' : 'celcius' }
        break

      case 'timerMode':
        report[property] = properties[property] ? { value: 1, description: 'absolute' } : { value: 0, description: 'relative' }
        break

      default:
        report[property] = properties[property]
    }
  }

  return report
}
