exports.authenticationError = class extends Error {
  constructor (message) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

exports.outOfRangeError = class extends Error {
  constructor (message) {
    super(message)
    this.name = 'OutOfRangeError'
  }
}

exports.timeoutError = class extends Error {
  constructor (message) {
    super(message)
    this.name = 'TimeoutError'
  }
}

exports.unsupportedMethodError = class extends Error {
  constructor (message) {
    super(message)
    this.name = 'UnsupportedMethodError'
  }
}
