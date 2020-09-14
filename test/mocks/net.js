const EventEmitter = require('events').EventEmitter

class Connection extends EventEmitter {
  constructor (options = {}) {
    // Call constructor of the EventEmitter class
    super()

    this.mockResponses = []

    setTimeout((self) => {
      self.emit('connect')
    }, 100, this)
  }

  address () {
    return {
      address: '10.1.1.1'
    }
  }

  mockDisconnect () {
    this.emit('close')
  }

  write (data, cb = {}) {
    // Emit response when a mocked resonse has been defined
    if (this.mockResponses.length) {
      setTimeout((self) => {
        // When first byte of mocked response is 0x99, fake timeout
        if (self.mockResponses[0][0] === 0x99) {
          self.mockResponses.shift()
        } else {
          self.emit('data', self.mockResponses.shift())
        }
      }, 100, this)
    }

    cb()
  }
}

exports.createConnection = () => {
  return new Connection()
}
