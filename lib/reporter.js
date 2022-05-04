module.exports = (properties) => {
  const modes = ['no sleep', 'sleep 1', 'sleep 2', 'sleep 3'];
  const report = {};
  let description;

  for (const property in properties) {
    switch (property) {
      case 'cosySleep':
        report.cosySleep = { value: properties[property], description: modes[properties[property]] };
        break;

      case 'fanSpeed':
        switch (properties[property]) {
          case 101:
            report.fanSpeed = { value: 101, description: 'fixed' };
            break;

          case 102:
            report.fanSpeed = { value: 102, description: 'auto' };
            break;

          default:
            description = 'unvalid';

            if (properties[property] <= 20) {
              description = 'silent';
            }

            if (properties[property] > 20 && properties[property] < 60) {
              description = 'low';
            }

            if (properties[property] >= 60 && properties[property] < 80) {
              description = 'medium';
            }

            if (properties[property] >= 80 && properties[property] <= 100) {
              description = 'high';
            }

            report.fanSpeed = { value: properties[property], description };
        }
        break;

      case 'pmv':
        switch (properties[property]) {
          case 0:
            report.pmv = { value: 99, description: 'off' };
            break;

          case 1:
            report.pmv = { value: -3, description: 'cold' };
            break;

          case 2:
            report.pmv = { value: -2.5, description: 'chill' };
            break;

          case 3:
            report.pmv = { value: -2, description: 'chill' };
            break;

          case 4:
            report.pmv = { value: -1.5, description: 'cool' };
            break;

          case 5:
            report.pmv = { value: -1, description: 'cool' };
            break;

          case 6:
            report.pmv = { value: -0.5, description: 'comfortable' };
            break;

          case 7:
            report.pmv = { value: 0, description: 'comfortable' };
            break;

          case 8:
            report.pmv = { value: 0.5, description: 'comfortable' };
            break;

          case 9:
            report.pmv = { value: 1, description: 'slightly warm' };
            break;

          case 10:
            report.pmv = { value: 1.5, description: 'slightly warm' };
            break;

          case 11:
            report.pmv = { value: 2, description: 'warm' };
            break;

          case 12:
            report.pmv = { value: 2.5, description: 'warm' };
            break;
        }
        break;

      case 'statusCode':
        switch (properties[property]) {
          case 0:
            report.statusCode = { value: 0, description: 'ok' };
            break;

          case 1:
            report.statusCode = { value: 1, description: 'interior board and display board communication failure' };
            break;

          case 2:
            report.statusCode = { value: 2, description: 'indoor main control board failure' };
            break;

          case 3:
            report.statusCode = { value: 3, description: 'indoor board and outdoor board communication failure' };
            break;

          case 4:
            report.statusCode = { value: 4, description: 'zero crossing detection failure' };
            break;

          case 5:
            report.statusCode = { value: 5, description: 'indoor board fan stall failure' };
            break;

          case 6:
            report.statusCode = { value: 6, description: 'outdoor condenser sensor failure' };
            break;

          case 7:
            report.statusCode = { value: 7, description: 'outdoor ambient temperature sensor failure' };
            break;

          case 8:
            report.statusCode = { value: 8, description: 'outdoor compression engine exhaust temperature sensor failure' };
            break;

          case 9:
            report.statusCode = { value: 9, description: 'outdoor failure' };
            break;

          case 10:
            report.statusCode = { value: 10, description: 'indoor temperature sensor failure' };
            break;

          case 11:
            report.statusCode = { value: 11, description: 'indoor evaporator temperature sensor failure' };
            break;

          case 12:
            report.statusCode = { value: 12, description: 'outdoor wind speed stall failure' };
            break;

          case 13:
            report.statusCode = { value: 13, description: 'ipm module protection' };
            break;

          case 14:
            report.statusCode = { value: 14, description: 'Voltage protection' };
            break;

          case 15:
            report.statusCode = { value: 15, description: 'outdoor compressor top temperature protection' };
            break;

          case 16:
            report.statusCode = { value: 16, description: 'outdoor temperature too low protection' };
            break;

          case 17:
            report.statusCode = { value: 17, description: 'compressor position protection' };
            break;

          case 18:
            report.statusCode = { value: 18, description: 'display panel fault' };
            break;

          case 21:
            report.statusCode = { value: 21, description: 'outer pipe temperature protection' };
            break;

          case 23:
            report.statusCode = { value: 23, description: 'exhaust high temperature protection' };
            break;

          case 25:
            report.statusCode = { value: 25, description: 'heating and cold wind protection' };
            break;

          case 26:
            report.statusCode = { value: 26, description: 'current protection' };
            break;

          case 29:
            report.statusCode = { value: 29, description: 'evaporator high and low temperature protection' };
            break;

          case 30:
            report.statusCode = { value: 30, description: 'condenser high and low temperature protection frequency limit' };
            break;

          case 31:
            report.statusCode = { value: 31, description: 'exhaust high and low temperature protection' };
            break;

          case 32:
            report.statusCode = { value: 32, description: 'indoor and outdoor communication mismatch protocol' };
            break;

          case 33:
            report.statusCode = { value: 33, description: 'refrigerant leakage protection' };
            break;

          case 38:
            report.statusCode = { value: 38, description: 'water tank full or missing' };
            break;

          default:
            report.statusCode = { value: properties[property], description: 'unknown error' };
        }
        break;

      case 'mode':
        switch (properties[property]) {
          case 1:
            report.mode = { value: 1, description: 'auto' };
            break;

          case 2:
            report.mode = { value: 2, description: 'cool' };
            break;

          case 3:
            report.mode = { value: 3, description: 'dry' };
            break;

          case 4:
            report.mode = { value: 4, description: 'heat' };
            break;

          case 5:
            report.mode = { value: 5, description: 'fanonly' };
            break;

          case 6:
            report.mode = { value: 6, description: 'customdry' };
            break;

          default:
            report.mode = { value: properties[property], description: 'invalid mode' };
        }
        break;

      case 'temperatureUnit':
        report.temperatureUnit = { value: properties[property], description: properties[property] ? 'fahrenheit' : 'celsius' };
        break;

      case 'timerMode':
        report[property] = properties[property] ? { value: 1, description: 'absolute' } : { value: 0, description: 'relative' };
        break;

      default:
        report[property] = properties[property];
    }
  }

  return report;
};
