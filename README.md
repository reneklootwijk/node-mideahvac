![tests](https://github.com/reneklootwijk/node-mideahvac/workflows/npm-publish/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/reneklootwijk/node-mideahvac/badge.svg?branch=master)](https://coveralls.io/github/reneklootwijk/node-mideahvac?branch=master)
![npm](https://img.shields.io/npm/v/node-mideahvac)
---

# Monitoring and controlling Midea-like air conditioners
This module enables the monitoring and controlling of 'Midea'-like airconditioners. The remote control functionality via WiFi provided by various vendors of air conditioners, either as default or optional feature, is using the same type of interface and the Midea cloud. Examples of vendors using this interface are:
* Midea
* Qlima
* Artel
* Carrier

The WiFi interface is provided by a dongle, called WiFi SmartKey, either connected to an USB type-A connector or a JST-HX type of connector. This dongle wraps the UART protocol used to communicate with the AC unit with a layer for authentication and encryption for communication with a mobile app via the Midea cloud or directly via a local LAN connection. However, it turned out the dongle is just connected to a serial interface (TTL level) of the AC unit. This means an alternative is to hook up directly to this serial interface and bypass the cloud, authentication and encryption stuff, for instance using an ESP8266 (see [ADAPTER.md](./ADAPTER.md)).

In the current version of this module communication using the WiFi SmartKey and the Midea Cloud and communication via a TCP serial bridge connected to the UART port is supported.
Direct connection to the WiFi SmartKey interface via a local LAN connection will be added later.

## References and sources
The knowledge to create the logic to monitor and control the Midea-'like' AC units was gathered by reverse engineering Android applications from various vendors, analyzing the UART protocol between an Artel unit and an SK103 SmartKey, documents found on the Internet, primarily in Chinese and the work from:
* Mac Zhou: https://github.com/mac-zhou/midea-msmart
* NeoAcheron: https://github.com/NeoAcheron/midea-ac-py

## Status
There are still a lots of unknowns in the protocol, either because they are really unknown or because I was not able to test them on the AC units I have myself (Artel). Any pull requests to improve and enhance the module are welcome.

## Installation
```bash
$ npm install node-mideahvac
```

## Usage

First create an appliance instance by specifying the following parameters:
* `communicationMethod`, this must be either 'mideacloud' or 'serialbridge'
* `host`, in case of the mideacloud method this will be the address of the cloud service which defaults to mapp.appsmb.com. In case of the serialbridge method this is the address of the serialbridge.
* `port`, in case of the mideacloud method this will be the port of the cloud service which defaults to 443. In case of the serialbridge method this is the port of the serialbridge which defaults to 23.
* `appKey`, the appKey authenticates the application when using the Midea cloud. Optionally you can specify your own, but it defaults to a hardcoded appKey.
* `uid`, the user Id to logon to the Midea Cloud
* `password`, the password to login into the Midea Cloud 
* `deviceId`, the id of the device to address via the Midea Cloud

For each AC unit to be monitored and controlled an appliance must be created. When multiple appliances are configured using the same uid for the Midea Cloud, the connection to the cloud will be shared between these appliances. However, it is also possible to monitor and control appliances linked to different uid's.

An example of creating an appliance using the Midea Cloud:
```javascript
const appliances = require('node-mideahvac')

var options = {
    communicationMethod: 'mideacloud',
    uid: <your email address>,
    password: <your password>,
    deviceId: <the id of the device to control>
}

var ac = new applicances.createAppliance(options)
```

An example of creating an appliance using a TCP serial bridge:
```javascript
const appliances = require('node-mideahvac')

var options = {
    communicationMethod: 'serialbridge',
    host: '192.168.10.34',
    port: 23
}

var ac = new applicances.createAppliance(options)
```

### Methods
All methods return a promise. An application should first use the `initialize` method to obtain the current status of the unit.

The following methods are provided:

* `getCapabilities(retry)`, this method requests the AC unit for its supported capabilities (B5 query). The retry parameter indicates whether or not the command must be retried when a retryable error occurs (default = false). The promise resolves to a JSON object containing the following capabilities (how many capabilities are actually reported dependents on what your unit reports): 


| Capability | Type | Description |
|---|---|---|
| autoMode | boolean | automatically select cool or heat mode |
| autoAdjustDownTemp | number | a specified setpoint under this temperature will be set to this temperature in auto mode |
| autoAdjustUpTemp | number | a specified setpoint above this temperature will be set to this temperature in auto mode |
| coolMode | boolean | cool mode |
| coolAdjustDownTemp | number | a specified setpoint under this temperature will be set to this temperature in cool mode |
| coolAdjustUpTemp | number | a specified setpoint above this temperature will be set to this temperature in cool mode |
| dryMode | boolean | dry mode |
| ecoMode | boolean | eco mode |
| frostProtectionMode | boolean | Maintain temperature at 8C to protect against frost|
| electricAuxHeating | boolean | ? |
| hasAutoClearHumidity | boolean | Intelligent dehumification?? the desired humidity level is determined automatically|
| hasAvoidPeople | boolean | ? |
| hasBlowingPeople | boolean | ? |
| hasBreeze | boolean | ? |
| hasHandClearHumidity | boolean | Manual dehumification?? the desired humidity level can be set |
| hasNoWindFeel | boolean | ? |
| hasNoWindSpeed | boolean | ? |
| hasSelfClean | boolean | ?When the unit is turned off the fan continues to work for another 10 ~ 15 minutes by ventilating and drying the heat exchanger |
| heatMode | boolean | heat mode |
| heatAdjustDownTemp | number | a specified setpoint under this temperature will be set to this temperature in heat mode |
| heatAdjustUpTemp| number | a specified setpoint above this temperature will be set to this temperature in heat mode |
| horizontalSwingMode | boolean | swing up and down |
| isHavePoint | boolean | ? |
| leftNum | boolean | ? |
| lightType | boolean | ? |
| mutilTemp | boolean | ? |
| nestCheck | boolean | ? |
| nestNeedChange | boolean | ? |
| powerCal | boolean | ? |
| powerCalSetting | boolean | ? |
| selfcheck | boolean | ? |
| specialEco | boolean | ? |
| strongCoolMode | boolean | turbo function in cool mode |
| strongHeatMode | boolean | turbo function in heat mode |
| unitChangeable | boolean | ? |
| verticalSwingMode | boolean | swing left and right |

* `getStatus(retry, emitUpdates)`, this method requests the current status of the unit (41 command). The retry parameter indicates whether the command must be retried in case of a retryable error occurs (default = false) and the emitUpdates parameter indicates whether or not the status-update event must be emitted when updates are detected (default = true). The promise resolves to a JSON object containing the property values when successful. The following properties are reported:

| Property | Type | Description |
| --- | --- | --- |
| alarmSleep | boolean | ? |
| braceletHomeAwayMode | boolean | ? only reported by certain units |
| braceletSleepMode | boolean | ? only reported by certain units |
| catchCold | boolean | ? |
| childSleepMode | boolean | ? |
| coolWindMode | boolean | ? |
| cosySleepMode | number | ? |
| downWindControl | boolean | ? |
| downWindControlLR | boolean | ? |
| dryClean | boolean | ? |
| dustFull | boolean | ? |
| ecoModeActive | boolean | flag to indicate eco mode is active|
| ecoSleepRunningHours | number | ? |
| ecoSleepRunningMinutes | number | ? |
| ecoSleepRunningSeconds | number | ? |
| errorCode | object | error code and description when the unit is in error |
| fanSpeed | object | 20: silent, 40: low, 60: medium, 80: high, 102: auto |
| fastCheckActive | boolean | ? |
| frostProtectionModeActive | boolean | flag indicating frost protection is active (only in heat mode) |
| mode | object| 1: auto, 2: cool,3: dry, 4: heat, 5: fanonly |
| horizontalSwingActive | boolean | horizontal swinger on or off |
| humiditySetpoint | number | |
| indoorTemperature | number | temperature measured by the indoor unit |
| inError | boolean | Flag to determine if the unit is in error |
| keepWarm | boolean | ? only reported by certain units || lightClass | number | ? |
| lowFrequencyFan | boolean | ? |
| naturalWindModeActive | boolean | ? |
| nightLight | boolean | ? |
| offTimerActive | boolean | flag to indicate the timer has been set to turn the unit on |
| offTimerHours | number | the number of hours before the timer expires |
| offTimerMinutes | number | the number of minutes before the timer expires |
| onTimerActive | boolean | flag to indicate the timer has been set to turn the unit on |
| onTimerHours | number | the number of hours before the timer expires |
| onTimerMinutes | number | the number of minutes before the timer expires |
| outdoorTemperature | number | temperature measured by the outdoor unit |
| peakValleyMode | boolean | ? |
| personalFeeling | boolean | ? |
| pmvMode | number | redicted Mean Vote Model? |
| powerOn | boolean | Is the unit turned on |
| powerSave | boolean | ? |
| ptcHeaterActive | boolean | ? |
| purifyingModeActive | boolean | ? |
| resumeActive | boolean | After a power failure the unit resumes the previous state |
| selfPersonalFeeling | boolean | ? |
| setpoint | number | The setpoint temperature |
| settingTemperature2 | boolean | ? |
| sleepModeActive |  boolean | flag indicating sleep mode is active or not | strong | boolean | |
| temperatureUnit | object | unit in which the temperature is reported, 0: celcius, 1: fahrenheit |
| timerMode | object | 0: absolute time, 1: relative time |
| turboModeActive | boolean | flag indicating turbo mode is active or not |
| ventilation | boolean | ? |
| verticalSwingActive | boolean | vertical swinger on or off |
| windBlowing | boolean | ? only reported by certain units |
| wiseEye | boolean | ? |

* `initialize()`, the initialize command will connect to the unit and use the `getCapability` and `getStatus` initialize the unit.  The promise will resolve to a nested JSON object containing a status object with all properties and their values and a capabilities object containing all capabilities reported by the unit.

* `setStatus(properties, retry, emitUpdates)`, this method must be used to change the status of the unit. The properties parameter is an object containing all the properties and their values that need to be changed. The retry parameter indicates whether the command must be retried in case of a retryable error occurs (default = false) and the emitUpdates parameter indicates whether or not the status-update event must be emitted when updates are detected (default = true). The response is a JSON object containing all the properties with their values.
In this version the following properties can be set:

 Property | Type | Possible values | Description |
| --- | --- | --- |
| beep | boolean | true, false | en/disable a beep as feedback |
| powerOn | boolean | true, false | power the unit on/off |
| setpoint | number | 16 - 31 | set the desired temperature |
| mode | string | cool, heat, fanonly, dry, auto | set the operational mode |
| fanSpeed | string | low, medium, high, auto | set the fan speed |
| horizontalSwingActive | boolean | true, false | turn the horizontal swinger on/off |
| sleepModeActive | boolean | true, false | turn the sleep mode on/off |
| verticalSwingMode | boolean | true, false | turn the vertical swinger on/off |
| turboModeActive | boolean | true, false | turn turbo mode on/off |
| frostProtectionModeActive | boolean | true, false | turn frost protection mode (min. temperature is 8°C) on/off. This is only supported in heat mode |

Example: 
Turn the unit on, set the setpoint to 24°C, retry until successful and emit the `status-update` event to report the new property values. 

```javascript
ac.setStatus({ powerOn: true, setpoint: 24 }, true, true)
.catch(error => {
    console.log(error.message)
})
```

### Events
The following events are emitted:

* `connected`, this event is emitted when using the serialbridge communication method and the connection to the bridge has been established.

* `disconnected`,this event is emitted when using the serialbridge communication method and the connection is disconnected.

* `initialized`, this event is emitted when the `initialize` method has completed. The data contains the same nested JSON object as described with the `initialize` method.

* `status-update`, this event is emitted when the value of one or more properties is updated. The data is a JSON object containing all updated properties with their values.

# Logging
The Winston module 
is used for logging. You can configure the logging by creating your own logger, e.g.:

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

More information on Winston can be found here: https://www.npmjs.com/package/winston

# Observations
As a test I monitored my 4 identical AC units (Artel) for a couple of days 24hr/day. 1 unit was monitored via a serialbridge connection the others via the Midea Cloud. The units monitored via the Midea Cloud reported sometimes wrong values for various properties (e.g. powerOn, hortizontalSwingActive, setpoint) while the unit monitored via the serialbridge did not show this behaviour. Also the Midea Cloud regularly returned an error (timeout or system error) or was unavailable completely for hours. This makes me conclude the Midea Cloud is unreliable.

# To do
* Support Fahrenheit
* Include automatic tests
* Add support for the direct LAN communication via the WiFi SmartKey