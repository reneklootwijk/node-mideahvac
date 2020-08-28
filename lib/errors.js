exports.AuthenticationError = class extends Error {
  constructor (message) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

exports.OutOfRangeError = class extends Error {
  constructor (message) {
    super(message)
    this.name = 'OutOfRangeError'
  }
}

exports.TimeoutError = class extends Error {
  constructor (message) {
    super(message)
    this.name = 'TimeoutError'
  }
}

exports.UnsupportedMethodError = class extends Error {
  constructor (message) {
    super(message)
    this.name = 'UnsupportedMethodError'
  }
}
