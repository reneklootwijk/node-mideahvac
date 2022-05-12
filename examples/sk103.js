// This example required the following modules to be installed:
// npm install node-mideahvac

const appliances = require('node-mideahvac');

// Specify your specific information
const ac = appliances.createAppliance({
  communicationMethod: 'sk103',
  key: '<replace by the key for your appliance>',
  token: '<replace by the token for your appliance>'
});

ac.on('status-update', data => {
  console.log(`Received updates: ${JSON.stringify(data)}`);
});

ac.initialize()
  .then(response => {
    console.log(`Initialized: ${JSON.stringify(response)}`);

    setInterval(() => {
      ac.getStatus()
        .catch(error => {
          console.log(`Error: ${error.message}`);
        });
    }, 30000);
  })
  .catch(error => {
    console.log(`Error: Failed to initialize (${error.message})`);
  });
