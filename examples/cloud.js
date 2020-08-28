const appliances = require('./lib')

// Specify you specific information
const ac = appliances.createAppliance({
  deviceId: '<replace by a device Id>',
  communicationMethod: 'mideacloud',
  uid: '<replace by your user Id for the Midea Cloud>',
  password: '<replace by your password for the Midea Cloud>'
})

ac.on('status-update', data => {
  console.log(`Received updates: ${JSON.stringify(data)}`)
})

ac.initialize()
  .then(response => {
    console.log(`Initialized: ${JSON.stringify(response)}`)

    setInterval(() => {
      ac.getStatus()
        .catch(error => {
          console.log(`Error: ${error.message}`)
        })
    }, 30000)
  })
  .catch(error => {
    console.log(`Error: Failed to initialize (${error.message})`)
  })
