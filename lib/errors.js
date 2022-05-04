exports.AuthenticationError = class extends Error {
  constructor (message) {
    super(message);
    this.name = 'AuthenticationError';
  }
};

exports.AuthorizationError = class extends Error {
  constructor (message) {
    super(message);
    this.name = 'AuthorizationError';
  }
};

exports.BadRequestError = class extends Error {
  constructor (message) {
    super(message);
    this.name = 'BadRequestError';
  }
};

exports.OutOfRangeError = class extends Error {
  constructor (message) {
    super(message);
    this.name = 'OutOfRangeError';
  }
};

exports.SigningError = class extends Error {
  constructor (message) {
    super(message);
    this.name = 'SigningError';
  }
};

exports.TimeoutError = class extends Error {
  constructor (message) {
    super(message);
    this.name = 'TimeoutError';
  }
};

exports.UnknownError = class extends Error {
  constructor (message) {
    super(message);
    this.name = 'UnknownError';
  }
};

exports.UnsupportedMethodError = class extends Error {
  constructor (message) {
    super(message);
    this.name = 'UnsupportedMethodError';
  }
};
