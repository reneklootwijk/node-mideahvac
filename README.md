<!-- markdownlint-disable MD033 -->

# Monitoring and controlling Midea-like air conditioners

[![Build](https://github.com/reneklootwijk/node-mideahvac/workflows/build/badge.svg)](https://github.com/reneklootwijk/node-mideahvac/actions)
[![Coverage Status](https://coveralls.io/repos/github/reneklootwijk/node-mideahvac/badge.svg?branch=master)](https://coveralls.io/github/reneklootwijk/node-mideahvac?branch=master)
[![npm](https://img.shields.io/npm/v/node-mideahvac)](https://www.npmjs.com/package/node-mideahvac)

*Note: Version 0.2.0 is a complete rewrite and not backwards compatible. The midea cloud is no longer supported, instead direct communication (over the LAN) to the airconditioner using the original SmartKey dongle is supported.*

This module enables the monitoring and controlling of 'Midea'-like airconditioners. The remote control functionality via WiFi provided by various vendors of air conditioners, either as default or optional feature, is using the same type of interface and the Midea cloud. Examples of vendors using this interface are:

* Midea
* Qlima
* Artel
* Carrier

The WiFi interface is provided by a dongle, called WiFi SmartKey (sk103), either connected to an USB type-A connector or a JST-HX type of connector. This dongle wraps the UART protocol used to communicate with the AC unit with a layer for authentication and encryption for communication with a mobile app via the Midea cloud or directly via a local LAN connection. However, it turned out the dongle is just connected to a serial interface (TTL level) of the AC unit. This means an alternative is to hook up directly to this serial interface and bypass the cloud, authentication and encryption stuff. More information on creating a custom dongle can be found the [prerequisites](#prerequisites) section.

This module supports direct communication using the WiFi SmartKey and direct communication via a TCP-serial bridge connected to the UART port of the appliance (e.g a custom dongle running [esp-link firmware](https://github.com/jeelabs/esp-link)).

## References and sources

The knowledge to create the logic to monitor and control the Midea-'like' AC units was gathered by reverse engineering Android applications from various vendors, analyzing the UART protocol between an Artel unit and an SK103 SmartKey, documents found on the Internet, primarily in Chinese and the work from:

* Mac Zhou: <https://github.com/mac-zhou/midea-msmart>
* NeoAcheron: <https://github.com/NeoAcheron/midea-ac-py>
* Nenad Bogojevic: <https://github.com/nbogojevic/midea-beautiful-air/tree/main/midea_beautiful>

Mac Zhou and Nenad Bogojevic deserve all the credits for reverse engineering the direct communication with the SmartKey. Where I had given up on ever figuring out how to obtain the key and token required, Mac persisted and eventually was successful, while Nenad was able to discover what changed in this process for users who migrated their accounts from the Midea Air app to the SmartHome app.

## Status

All common functions of Airconditioners are supported, but support for specific features only available on some airconditioners might be incomplete or missing because it is unknown how they work and the inability to test. Any help is welcome. Also support for (de)humidifiers is missing.

The direct communication with the original dongle, the SmartKey, has been tested with a SK103 running firmware 3.0.8. The discover command required to obtain the token and key required for direct communication only supports accounts that have been migrated to the SmartHome app.

:warning: The SK103 module, when using the SK103 communication method and poll the status frequently, might disconnect from your WiFi network and a powercycle is required to reconnect. Lowering the frequency of polling might prevent this.

## Prerequisites

For the direct communication method using an SK103 original SmartKey dongle is required running firmware version 3.0.8 and a SmartHome account (Midea Air or NetHome Plus accounts do not work anymore because Midea removed the ability to retrieve the required key and token for these type of accounts).

For the serialbridge a custom dongle is required running the [esp-link firmware](https://github.com/jeelabs/esp-link)). Examples of designs of custom dongles are:

* [Universal IoT dongle](https://www.hackster.io/news/sergey-dudanov-s-universal-iot-dongle-packs-an-esp8266-for-easy-appliance-remote-control-d372caa94ac7)
* [Mine](https://github.com/reneklootwijk/mideahvac-dongle)
* [Using standard Aliexpress components](./custom-dongle.md)

## Installation

```bash
npm install node-mideahvac
```

## Usage

First create an appliance instance by specifying the following parameters:

| parameter | use | method |
| --- | --- | --- |
| `communicationMethod` | this must be either 'sk103' or 'serialbridge' | sk103 / serialbridge |
| `host` | this is the address of the dongle, either the SmartKey (sk103) or the custom dongle running TCP-serial bridge firmware | sk103 / serialbridge |
| `port` | this is the port the TCP-serial bridge firmware is listening on (default 23) | serialbridge |
| `id` | the id of the appliance (as can be determined using the [discovery](#discovery) tool) | sk103 |
| `key` | The key can be obtained using the [discover](#discovery) tool) | sk103 |
| `token` | The token can be obtained using the [discover](#discovery) tool) | sk103 |

For each AC unit to be monitored and controlled an appliance must be instantiated.

An example of creating an appliance using the sk103 direct communication method:

```javascript
const appliances = require('node-mideahvac')

var options = {
    communicationMethod: 'sk103',
    id: <the id of the device to control>,
    key: <the key for the device to control>,
    token: <the token for the device to control>
}

var ac = appliances.createAppliance(options)
```

An example of creating an appliance using a TCP serial bridge:

```javascript
const appliances = require('node-mideahvac')

var options = {
    communicationMethod: 'serialbridge',
    host: '192.168.10.34',
    port: 23
}

var ac = appliances.createAppliance(options)
```

### Methods

All methods return a promise and the retry parameter indicates how many times the command must be retried when a retryable error occurs (default = 0).

The following methods are provided:

* `getCapabilities(retry)`, this method requests the AC unit for its supported capabilities (0xB5 query). This command is not supported by all AC units and the reported values are not always correct (e.g. my Artel units report the left/right fan can be controlled while it can only be manually controlled and Fahrenheit as unit is not supported while it is).

  The default values specify which value is reported by this module when the AC unit does not report this capability at all.

  The promise resolves to a JSON object containing the following capabilities:

| Capability | Type | Default | Description |
| --- | --- | --- | --- |
| activeClean | boolean | false | active cleaning mode |
| autoMode | boolean | false | auto mode (cooling or heating is automatically selected) |
| autoSetHumidity | boolean | false | humidity setpoint automatically determined |
| breezeControl | boolean | false | breeze mode can be controlled |
| buzzer | boolean | false | buzzer can be disabled |
| coolMode | boolean | false | cooling mode |
| decimals | boolean | false | setpoint in decimals |
| downNoWindFeel | boolean | false | |
| dryMode | boolean | false |dry mode |
| ecoMode | boolean | false | eco mode |
| electricAuxHeating | boolean | false | |
| fanSpeedControl | boolean | true | fan speed can be controlled |
| frostProtectionMode | boolean | false | temperature is maintained at 8C to protect against frost |
| heatMode | boolean | false | heat mode |
| indoorHumidity | boolean | false | indoor humidity is reported|
| leftrightFan | boolean | false | left/right fan can be controlled |
| lightControl | boolean | false | display can be dimmed |
| manualSetHumidity | boolean | false | humidity setpoint can be specified |
| maxTempAuto | number | 30 | maximum setpoint in auto mode |
| maxTempCool | number | 30 | maximum setpoint in cool mode |
| maxTempHeat | number | 30 | maximum setpoint in heat mode |
| minTempAuto | number | 17 | minimum setpoint in auto mode |
| minTempCool | number | 17 | minimum setpoint in cool mode |
| minTempHeat | number | 17 | minimum setpoint in heat mode |
| nestCheck   | boolean | false | |
| nestNeedChange | boolean | false | |
| oneKeyNoWindOnMe | boolean | false | |
| oneKeyNoWindOnMe | boolean | false | |
| powerCal | boolean | false | power usage can be reported |
| powerCalSetting | boolean | false | |
| silkyCool | boolean | false | |
| smartEye | boolean | false | |
| specialEco | boolean | false | |
| turboCool | boolean | false | cool mode supports turbo mode |
| turboHeat | boolean | false | heat mode supports turbo mode |
| unitChangeable | boolean | false | the temperature unit can be changed from Celsius to Fahrenheit |
| updownFan | boolean | false | up/down fan can be controlled |
| upNoWindFeel | boolean | false | |
| windOffMe | boolean | false | |
| windOnMe | boolean | false | |

* `getPowerUsage(retry)`, this method requests the current power usage of the unit (specific 0x41 command). The promise resolves to a JSON object containing the property values when successful. The following properties are reported:

| Property | Type | Description |
| --- | --- | --- |
| powerUsage | number | Power usage in kWh |

* `getStatus(retry)`, this method requests the current status of the unit (0x41 command). The promise resolves to a JSON object containing the property values when successful. The following properties are reported:

| Property | Values | Description |
| --- | --- | --- |
| braceletControl |  true/false |
| braceletSleep |  true/false |
| catchCold | true/false |
| childSleep | true/false |
| coolFan | true/false |
| cosySleep  | 0: no sleep<br/>1: sleep 1<br/>2: sleep 2<br/>3: sleep 3 | sleep mode, reported as the following JSON object:<br/>{ value: *n*, description: *text* } |
| downWindControl | true/false |
| downWindControlLR | true/false |
| dryClean | true/false |
| dualControl | true/false | probably to the follow me mode is active where the remote control acts as the temperature sensor |
| dustFull | true/false |
| ecoMode | true/false | eco mode is enabled |
| ecoSleepRunningHours | 0-15 |
| ecoSleepRunningMinutes | 0-59 |
| ecoSleepRunningSeconds | 0-59 |
| fanSpeed | 0-20: silent</br>21-59: low<br/>60-79: medium<br/>80-100: high<br/>101: fixed<br/>102: auto | reported as the following JSON object:<br/>{ value: *n*, description: *text* } |
| fastCheck | true/false |
| feelOwn | true/false |
| frostProtection | true/false | frost protection is active |
| humiditySetpoint | 0-100% | humidity setpoint |
| indoorTemperature | -25-102&deg;C<br/>-13-215&deg;F | indoor temprature |
| inError | true/false | the unit is in error |
| keepWarm |  true/false |
| leftrightFan | true/false | left/right fan is active |
| light | 0-7 | brightness level of display light |
| lowFrequencyFan | true/false |
| mode | 1: auto<br/>2: cool<br/>3: dry<br/>4: heat<br/>5: fanonly<br/>6: customdry | reported as the following JSON object:<br/>{ value: *n*, description: *text* } |
| naturalFan | true/false |
| nightLight | true/false |
| offTimer | true/false | scheduled to turn on |
| offTimerHours | 0 - 24 | number of hours until the unit will be turned off |
| offTimerMinutes | 0 - 59 | number of minutes until the unit will be turned off |
| onTimer | true/false | scheduled to turn on |
| onTimerHours | 0 - 24 | number of hours until the unit will be turned on |
| onTimerMinutes | 0 - 59 | number of minutes until the unit will be turned on |
| outdoorTemperature | -25-102&deg;C<br/>-13-215&deg;F | outdoor temperature |
| peakValleyElectricitySaving | true/false |
| pmv | 99: off<br/>-3: cold<br/>-2.5: chill<br/>-2: chill<br/>-1.5: cool<br/>-1: cool<br/>-0.5: comfortable<br/>0: comfortable<br/>0.5: comfortable<br/>1: slightly warm<br/>1.5: slightly warm<br/>2: warm<br/> 2.5: warm | predicted mean vote (the experienced temperature), reported as the following JSON object:<br/>{ value: *n*, description: *text* } |
| powerOn | true/false | power status |
| ptcHeater | true/false |
| purify | true/false |
| resume | true/false | automatically resume after recovery from power failure |
| save | true/false |
| selfCosySleep | true/false |
| selfFeelOwn | true/false |
| sleepMode | true/false | sleep mode is activated |
| smartEye | true/false |
| smartWind |  true/false |
| statusCode | see Status codes | reported as the following JSON object:<br/>{ value: *n*, description: *text* } |
| temp | 0-32 | probably the temperature reported by the remote control sensor in follow me mode |
| tempDecimal | true/false | probably indicates decimals are supported for the temperature reported by the remote control |
| temperatureSetpoint | 17 - 30&deg;C<br/>62-86&deg;F | temperature setpoint |
| temperatureUnit | 0: Celsius<br/>1: Fahrenheit | unit used to report temperatures |
| timerMode | 0: relative<br/>1: absolute | how to specify the time for the timer (only relative mode is supported) |
| turboMode | true/false | turbo mode enabled |
| updownFan | true/false | up/down fan is active |
| ventilation | true/false |
| windBlowing | true/false |

Properties with a name like byte*n*bit*m* can also be reported. These are properties where I do not have a clue whether they are used. For instance byte3bit3 means the value of bit 3 in byte 3, or byte3bit34 means the value of bit3-4 in byte 3. You would help me to determine the meaning of these bits when you report them in the issues section with their values and possibly what happened.

Status codes:
| Code | Description |
| --- | --- |
| 0 | ok |
| 1 | interior board and display board communication failure |
| 2 | indoor main control board failure |
| 3 | indoor board and outdoor board communication failure |
| 4 | zero crossing detection failure |
| 5 | indoor board fan stall failure |
| 6 | outdoor condenser sensor failure |
| 7 | outdoor ambient temperature sensor failure |
| 8 | outdoor compression engine exhaust temperature sensor failure |
| 9 | outdoor failure |
| 10 | indoor temperature sensor failure |
| 11 | indoor evaporator temperature sensor failure |
| 12 | outdoor wind speed stall failure |
| 13 | ipm module protection |
| 14 | voltage protection |
| 15 | outdoor compressor top temperature protection |
| 16 | outdoor temperature too low protection |
| 17 | compressor position protection |
| 18 | display panel fault |
| 21 | outer pipe temperature protection |
| 23 | exhaust high temperature protection |
| 25 | heating and cold wind protection |
| 26 | current protection |
| 29 | evaporator high and low temperature protection |
| 30 | condenser high and low temperature protection frequency limit |
| 31 | exhaust high and low temperature protection |
| 32 | indoor and outdoor communication mismatch protocol |
| 33 | refrigerant leakage protection |
| 38 | water tank full or missing |

* `initialize()`, this method can be used to perform some initializion:
  * The getCapabilities command is issued to determine the supported capabilities
  * The setStatus command is issued to determine the current values of all properties
  * The sendNetworkStatusNotification command (only when the serialbridge method is used) is scheduled to be issued every 2 minutes to make sure the WiFi connected symbol is show on the AC display.
The response is a JSON object merging the responses from the getCapabilities and getStatus mthods.

* `sendNetworkStatusNotification()`, this method is only available for the serialbridge communication method must be called at least once every 2 minutes in order to display the WiFi connected symbol in the display of the AC.

* `setStatus(properties, retry)`, this method must be used to change the status of the unit. The properties parameter is an object containing all the properties and their values that need to be changed. To prevent changing properties unintentionaly, before calling the setStatus command a getStatus command must be send to retrieve the current values of all properties. The response is a JSON object containing all the properties with their values, just like returned by the getStatus method.

The following properties can be set:

 Property | Type | Possible values | Description |
| --- | --- | --- | --- |
| beep | boolean | true, false | en/disable a beep as feedback |
| fanSpeed | string | number | silent, low, medium, high, auto or 0 - 100% | set the fan speed |
| frostProtectionMode | boolean | true, false | turn frost protection mode (min. temperature is 8°C) on/off. This is only supported in heat mode |
| humiditySetpoint | number | 35 - 85 | set the desired humidity in % |
| leftrightFan | boolean | true, false | turn the left/right (vertical) fan on/off |
| mode | string | cool, heat, fanonly, dry, auto, customdry | set the operational mode |
| powerOn | boolean | true, false | power the unit on/off |
| temperatureSetpoint | number | 16 - 31 / 60 - 87| set the desired temperature in °C or °F|
| sleepMode | boolean | true, false | turn the sleep mode on/off |
| temperatureUnit | string | fahrenheit, celsius | set the temperature unit to fahrenheit/celsius |
| turboMode | boolean | true, false | turn turbo mode on/off |
| updownFan | boolean | true, false | turn the up/down (horizontal) fan on/off |

Example:
Turn the unit on, set the temperature setpoint to 24°C and retry max. 3 times.

```javascript
ac.setStatus({ powerOn: true, setpoint: 24 }, 3)
.catch(error => {
    console.log(error.message)
})
```

### Events

The following events are emitted:

* `connected`, this event is emitted when using the serialbridge communication method and the connection to the bridge has been established.

* `disconnected`,this event is emitted when using the serialbridge communication method and the connection is disconnected.

* `status-update`, this event is emitted when the value of one or more properties is updated. The data is a JSON object containing all updated properties with their values.

## Logging

The Winston module is used for logging. You can configure the logging by creating your own logger, e.g.:

```javascript
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
  level: 'silly'
}))
```

By specifying the level you can control the amount of logging generated.

More information on Winston can be found here: <https://www.npmjs.com/package/winston>

## Discovery

The module installs the midea-discover command line tool in the node_modules/.bin directory. This tool tries to find any appliances on the local network with a SmartKey and displays all relevant information required for configuring this module. When the userId and password of a SmartHome account are specified on the command line, the discovery tool will also retrieve the values for the token and key required. These values are retrieved from the Midea cloud so an Internet connection is required, but these values only need to be retrieved once.

```bash
# node_modules/.bin/midea-discover [--user=<SmartHome user>, --password=<SmartHome password>]
```

or

```bash
# npx midea-discover [--user=<SmartHome user>, --password=<SmartHome password>]
```

By default the discover command uses the 255.255.255.255 broadcast address which means only appliances on the same subnet network as the computer running the discover command will be discovered. If the appliances are on another network either specify the broadcast IP address of that network, e.g. 192.168.3.255, or use the IP address of the appliance itself using the -T or --target parameter:

```bash
# npx midea-discover --target=[target IP address]
```

Example response:

```bash
Found 2 appliances:

Appliance 1:
- Id: 20330721052279
- Host: 192.168.5.124
- Port: 6444
- MAC Address: c4:dc:9a:4a:1d:26
- Serial No.: 000000P0000000Q1833C9B4A14360000
- Appliance Type: Air Conditioner
- Firmware Version: 3.0.8
- New Encryption Version: true
- UDP Id: fbf0c1b2c39223c07cd284590aed9003
- Authentication Key: 022BA2C782A41BFFBED33B769AA0889E6EC858D43DB74306A207EFD74C1066B5
- Authentication Token: 9C06A28C7223C0268765BADE044DA029E933CF12C6280241C18BAF992D47B3227A15DE88FEAA0829FAA33AD684311495F43DF7D2E740E52D68220C183045D557

Appliance 2:
- Id: 12691694762294
- Host: 192.168.5.121
- Port: 6444
- MAC Address: c4:7c:2b:26:59:29
- Serial No.: 000000P0000000Q1833C9B265A190000
- Appliance Type: Air Conditioner
- Firmware Version: 3.0.8
- New Encryption Version: true
- UDP Id: 8b8c0c88c8276edde9a8acd139022118
- Authentication Key: B848C224F28E4C2AAF112C1C557707FBAF76593F95EE45DC8F693AE682BCDD0F
- Authentication Token: CF24662D8309FA055460B4E67A00EDE09117455DCBDEA7A90C97CE3B9EEDC1DF0305C36B1399C2F07FFA0935336991C856A0E13705FD7D5C79AF80D70C8322C7C
```
