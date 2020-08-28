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

  mockDisconnect () {
    this.emit('close')
  }

  write (data, cb = {}) {
    setTimeout((self) => {
      self.emit('data', self.mockResponses.shift())
    }, 100, this)

    cb()
  }
}

exports.createConnection = () => {
  return new Connection()
}
