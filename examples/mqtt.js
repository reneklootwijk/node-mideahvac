// This example required the following modules to be installed:
// npm install node-mideahvac
// npm install mqtt
//
// You can listen to all events via the mosquitto_sub command:
//    mosquitto_sub -h test.mosquitto.org -v -t mideahvac/#
// and send commands via the mosquitto_pub command:
//    mosquitto_pub -h test.mosquitto.org -t mideahvac-set/powerOn -m "true"
//
// WARNING: The server used is a public server, your AC unit
//          will be publically exposed when running this script

const appliances = require('node-mideahvac');
const mqtt = require('mqtt');

// Specify your specific information
const options = {
  deviceId: '<replace by a device Id>',
  communicationMethod: 'sk103',
  key: '<replace by the key for your appliance>',
  token: '<replace by the token for your appliance>'
};
// or for serialbridge
// {
//   communicationMethod: 'serialbridge',
//   host: '<replace by the IP address of your serial bridge>',
//   port: '<replace by the port of your serial bridge>'
// })

function batchPublish (properties) {
  const properties2Publish = [
    'fanSpeed',
    'indoorTemperature',
    'mode',
    'outdoorTemperature',
    'powerOn',
    'temperatureSetpoint'
  ];

  for (const property in properties) {
    if (properties2Publish.indexOf(property) !== -1) {
      // When the reported value is an object, publish the description
      if (typeof properties[property] === 'object') {
        properties[property] = properties[property].description;
      }
      console.log(`Publish ${properties[property]} to mideahvac/${property}`);
      client.publish(`mideahvac/${property}`, properties[property].toString());
    }
  }
}

const ac = appliances.createAppliance(options);

const client = mqtt.connect('mqtt://test.mosquitto.org');

client.on('connect', function () {
  // Subscribe to receive commands
  client.subscribe('mideahvac-set/#');

  ac.initialize()
    .then(response => {
      batchPublish(response.status);

      // Start polling for status updates (each 5s)
      setInterval(() => {
        ac.getStatus()
          .catch(error => {
            console.log(`Error getting status (${error.message})`);
          });
      }, 5000);
    })
    .catch(error => {
      console.log(`Error: Failed to initialize (${error.message})`);
    });
});

client.on('message', function (topic, message) {
  console.log(`Received ${message.toString()} on ${topic}`);
  const [, property] = topic.match(/[^\/]+\/(.*)/);
  if (property) {
    // Convert booleans and numbers
    try {
      message = JSON.parse(message.toString());
    } catch (e) {
      message = message.toString();
    }

    ac.setStatus({ [property]: message });
  }
});

ac.on('status-update', data => {
  batchPublish(data);
});
