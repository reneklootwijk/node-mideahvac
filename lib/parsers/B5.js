'use strict';

const logger = require('winston');

// Add a transport as fall back when no parent logger has been initialized
// to prevent the error: "Attempt to write logs with no transports"
logger.add(new logger.transports.Console({
  level: 'none'
}));

const capabilities = {
  activeClean: false,
  autoMode: false,
  autoSetHumidity: false,
  breezeControl: false,
  buzzer: false,
  coolMode: false,
  decimals: false,
  downNoWindFeel: false,
  dryMode: false,
  ecoMode: false,
  electricAuxHeating: false,
  fanSpeedControl: true,
  frostProtectionMode: false,
  heatMode: false,
  indoorHumidity: false,
  leftrightFan: false,
  lightControl: false,
  manualSetHumidity: false,
  maxTempAuto: 30,
  maxTempCool: 30,
  maxTempHeat: 30,
  minTempAuto: 17,
  minTempCool: 17,
  minTempHeat: 17,
  nestCheck: false,
  nestNeedChange: false,
  oneKeyNoWindOnMe: false,
  powerCal: false,
  powerCalSetting: false,
  silkyCool: false,
  smartEye: false,
  specialEco: false,
  turboCool: false,
  turboHeat: false,
  unitChangeable: false,
  updownFan: false,
  upNoWindFeel: false,
  windOffMe: false,
  windOnMe: false
};

exports.parser = (data) => {
  logger.debug(`B5.parser: Entering with ${data.toString('hex')}`);

  let i = 2;
  let caps2process = data[1];
  while (i < data.length - 2 && caps2process) {
    if (data[i + 1] === 0x00 && data[i + 2] > 0) {
      switch (data[i]) {
        case 0x15: // hasIndoorHumidity
          capabilities.indoorHumidity = data[i + 3] !== 0;
          break;

        case 0x18: // hasNoWindFeel
          capabilities.silkyCool = data[i + 3] !== 0;
          // From T0xAC:
          // if(data[i + 3] = 1) { noWindFeel = upNoWindFeel = downNoWindFeel = true; }
          // if(data[i + 3] = 2) { upNoWindFeel = true; noWindFeel = downNoWindFeel = false; }
          // if(data[i + 3] = 3) { upNoWindFeel = noWindFeel = false;  downNoWindFeel = true; }
          // else { noWindFeel = upNoWindFeel = downNoWindFeel = false; }
          break;

        case 0x30: // hasSmartEye
          capabilities.smartEye = data[i + 3] === 1;
          break;

        case 0x32: // hasBlowingPeople
          capabilities.windOnMe = data[i + 3] === 1;
          break;

        case 0x33: // hasAvoidPeople
          capabilities.windOffMe = data[i + 3] === 0;
          break;

        case 0x39: // hasSelfClean
          capabilities.activeClean = data[i + 3] === 1;
          break;

        case 0x3D:
          capabilities.upNoWindFeel = data[i + 3] > 1;
          break;

        case 0x3E:
          capabilities.downNoWindFeel = data[i + 3] > 1;
          break;

        case 0x40: // Found in a log
          break;

        case 0x42: // hasOneKeyNoWindOnMe
          capabilities.oneKeyNoWindOnMe = data[i + 3] === 1;
          // From T0xAC
          // if(data[i + 3] = 2) {
          //    hasWindowBlowing = true;
          //    windBlowing = true;
          //    windBlowingStatus true;
          //    upDownProduceWindStatus = false;
          //    upSwipeWindStatus = false;
          //    downSwipeWindStatus = false;
          //    upNoWindFeel = false;
          //    downNoWindFeel = false;
          //    natureWindStatus = false;
          // } else {
          //    windBlowing = false;
          //    windBlowingStatus = false;
          // }
          // }
          break;

        case 0x43: // hasBreeze
          capabilities.breezeControl = data[i + 3] === 0;
          break;
      }
    }

    if (data[i + 1] === 0x02 && data[i + 2] > 0) {
      switch (data[i]) {
        case 0x10: // hasNoWindSpeed (the app states this property is true when === 1)
          capabilities.fanSpeedControl = data[i + 3] !== 1;
          break;

        case 0x12:
          capabilities.ecoMode = data[i + 3] === 1;
          capabilities.specialEco = data[i + 3] === 2;
          break;

        case 0x13:
          capabilities.frostProtectionMode = data[i + 3] === 1;
          break;

        case 0x14: // hotcold
          switch (data[i + 3]) {
            case 0:
              capabilities.heatMode = false;
              capabilities.coolMode = true;
              capabilities.dryMode = true;
              capabilities.autoMode = true;
              break;

            case 1:
              capabilities.coolMode = true;
              capabilities.heatMode = true;
              capabilities.dryMode = true;
              capabilities.autoMode = true;
              break;

            case 2:
              capabilities.coolMode = false;
              capabilities.dryMode = false;
              capabilities.heatMode = true;
              capabilities.autoMode = true;
              break;

            case 3:
              capabilities.coolMode = true;
              capabilities.dryMode = false;
              capabilities.heatMode = false;
              capabilities.autoMode = false;
              break;
          }
          break;

        case 0x15:
          switch (data[i + 3]) {
            case 0:
              capabilities.leftrightFan = false;
              capabilities.updownFan = true;
              break;

            case 1:
              capabilities.leftrightFan = true;
              capabilities.updownFan = true;
              break;

            case 2:
              capabilities.leftrightFan = false;
              capabilities.updownFan = false;
              break;

            case 3:
              capabilities.leftrightFan = true;
              capabilities.updownFan = false;
              break;
          }
          break;

        case 0x16:
          switch (data[i + 3]) {
            case 0:
            case 1:
              capabilities.powerCal = false;
              capabilities.powerCalSetting = false;
              break;

            case 2:
              capabilities.powerCal = true;
              capabilities.powerCalSetting = false;
              break;

            case 3:
              capabilities.powerCal = true;
              capabilities.powerCalSetting = true;
              break;
          }
          break;

        case 0x17:
          switch (data[i + 3]) {
            case 0:
              capabilities.nestCheck = false;
              capabilities.nestNeedChange = false;
              break;

            case 1:
            case 2:
              capabilities.nestCheck = true;
              capabilities.nestNeedChange = false;
              break;

            case 3:
              capabilities.nestCheck = false;
              capabilities.nestNeedChange = true;
              break;

            case 4:
              capabilities.nestCheck = true;
              capabilities.nestNeedChange = true;
              break;
          }
          break;

        case 0x19: // dianfure
          capabilities.electricAuxHeating = data[i + 3] === 1;
          break;

        case 0x1A:
          switch (data[i + 3]) {
            case 0:
              capabilities.turboHeat = false; // strongHot
              capabilities.turboCool = true; // strongCool
              break;

            case 1:
              capabilities.turboHeat = true;
              capabilities.turboCool = true;
              break;

            case 2:
              capabilities.turboHeat = false;
              capabilities.turboCool = false;
              break;

            case 3:
              capabilities.turboHeat = true;
              capabilities.turboCool = false;
              break;
          }
          break;

        case 0x1F:
          switch (data[i + 3]) {
            case 0:
              capabilities.autoSetHumidity = false; // hasAutoClearHumidity
              capabilities.manualSetHumidity = false; // hasHandClearHumidity
              break;

            case 1:
              capabilities.autoSetHumidity = true;
              capabilities.manualSetHumidity = false;
              break;

            case 2:
              capabilities.autoSetHumidity = true;
              capabilities.manualSetHumidity = true;
              break;

            case 3:
              capabilities.autoSetHumidity = false;
              capabilities.manualSetHumidity = true;
              break;
          }
          break;

        case 0x22: // unitChangeable
          capabilities.unitChangeable = data[i + 3] === 0;
          break;

        case 0x24: // lightType
          capabilities.lightControl = data[i + 3];
          break;

        case 0x25:
          if (data[i + 2] >= 6) {
            logger.silly(`B5.parser: Parsing adjust temp capability ${data[i + 3]}`);
            capabilities.minTempCool = data[i + 3] / 2; // cool_adjust_down_temp
            capabilities.maxTempCool = data[i + 4] / 2; // cool_adjust_up_temp
            capabilities.minTempAuto = data[i + 5] / 2; // auto_adjust_down_temp
            capabilities.maxTempAuto = data[i + 6] / 2; // auto_adjust_up_temp
            capabilities.minTempHeat = data[i + 7] / 2; // hot_adjust_down_temp
            capabilities.maxTempHeat = data[i + 8] / 2; // hot_adjust_up_temp

            // isHavePoint
            if (data[i + 2] > 6) {
              capabilities.decimals = data[i + 9] !== 0;
            } else {
              capabilities.decimals = data[i + 5] !== 0;
            }
          }
          break;

        case 0x2C: // hasBuzzer
          capabilities.buzzer = data[i + 3] !== 0;
          break;
      }
    }

    // Increment cursor and decrement capabilities to process
    i += (3 + data[i + 2]);
    caps2process--;
  }

  return {
    more: data.length - i >= 2 ? data[data.length - 2] : 0,
    capabilities
  };
};
