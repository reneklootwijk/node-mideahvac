const AC = require('../../lib/ac')

module.exports = class extends AC {
  constructor (options = {}) {
    // Call constructor of the AC class
    super(options)
  }

  _request (cmd, label = 'unknown') {
    return new Promise((resolve, reject) => {
      reject(new Error(cmd.toString('hex')))
    })
  }
}
