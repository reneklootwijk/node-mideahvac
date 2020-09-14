/* eslint-disable mocha/no-hooks-for-single-case */

const assert = require('chai').assert
const rewireMock = require('rewiremock/node')
const appliances = require('../lib')

rewireMock.enable()

rewireMock('net').by('./mocks/net')

const networkNotification = Buffer.from([
  0xAA, 0x1F, 0xAC, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x0D,
  0x01, 0x01, 0x04, 0x04, 0x05, 0xA8, 0xC0, 0xFF, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x7B, 0x31
])

const c0Response = Buffer.from([
  0xAA, 0x22, 0xAC, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x03,
  0xC0, 0x00, 0x48, 0x66, 0x7F, 0x7F, 0x00, 0x30, 0x00, 0x00,
  0x00, 0x67, 0x53, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x40, 0xA5
])

const b5Response = Buffer.from([
  0xAA, 0x3D, 0xAC, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x03,
  0xB5, 0x0A, 0x12, 0x02, 0x01, 0x01, 0x18, 0x00, 0x01, 0x00,
  0x14, 0x02, 0x01, 0x01, 0x15, 0x02, 0x01, 0x01, 0x16, 0x02,
  0x01, 0x03, 0x1A, 0x02, 0x01, 0x01, 0x10, 0x02, 0x01, 0x01,
  0x1F, 0x02, 0x01, 0x00, 0x25, 0x02, 0x07, 0x20, 0x3C, 0x20,
  0x3C, 0x20, 0x3C, 0x05, 0x40, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x79, 0x80
])

var ac
var eventInitialized

describe('Connection tests serial bridge:', function () {
  it('creating an appliance without specifying a communication type should throw an error', function () {
    assert.throws(() => {
      ac = appliances.createAppliance()
    }, 'No communication method specified', 'should have thrown an error')
  })

  it('creating any appliance by specifying an unsupported communication type should throw an error', function () {
    assert.throws(() => {
      ac = appliances.createAppliance({ communicationMethod: 'unsupported' })
    }, 'Unknown communication method specified', 'should have thrown an error')
  })

  it('using the serialbridge method without specifying a host should throw an error', function () {
    assert.throws(() => {
      ac = appliances.createAppliance({
        communicationMethod: 'serialbridge',
        port: 23
      })
    }, 'Cannot create serialbridge connection, no host and/or port specified', 'should have thrown an error')
  })

  it('using the serialbridge method without specifying a port should throw an error', function () {
    assert.throws(() => {
      ac = appliances.createAppliance({
        communicationMethod: 'serialbridge',
        host: 'midea.serialbridge.com'
      })
    }, 'Cannot create serialbridge connection, no host and/or port specified', 'should have thrown an error')
  })

  it('creating an appliance object successfully', function () {
    assert.doesNotThrow(() => {
      ac = appliances.createAppliance({
        communicationMethod: 'serialbridge',
        host: 'midea.serialbridge.com',
        port: 23
      })
    })
  })
})

describe('Integration tests serial bridge:', function () {
  describe('initialize the appliance', function () {
    var init

    before(async function () {
      // Reset flags
      eventInitialized = false

      ac.on('initialized', () => {
        eventInitialized = true
      })

      await ac._connect()
      ac._connection.mockResponses.push(networkNotification)
      ac._connection.mockResponses.push(b5Response)
      ac._connection.mockResponses.push(c0Response)
      init = await ac.initialize()
    })

    it('the initialized event should have been received', function () {
      assert.strictEqual(eventInitialized, true, 'initialized event has not been received')
    })

    it('the correct number of properties and capabilities must be returned', function () {
      assert.strictEqual(Object.keys(init.status).length, 52, 'wrong number of properties returned')
      assert.strictEqual(Object.keys(init.capabilities).length, 38, 'wrong number of capabilities returned')
    })
  })

  describe('initialize the appliance without support for network notification', function () {
    var init

    before(async function () {
      // Reset flags
      eventInitialized = false

      ac.on('initialized', () => {
        eventInitialized = true
      })

      await ac._connect()
      ac._connection.mockResponses.push(Buffer.from([0x99]))
      ac._connection.mockResponses.push(b5Response)
      ac._connection.mockResponses.push(c0Response)
      init = await ac.initialize()
    })

    it('the initialized event should have been received', function () {
      assert.strictEqual(eventInitialized, true, 'initialized event has not been received')
    })

    it('the correct number of properties and capabilities must be returned', function () {
      assert.strictEqual(Object.keys(init.status).length, 52, 'wrong number of properties returned')
      assert.strictEqual(Object.keys(init.capabilities).length, 38, 'wrong number of capabilities returned')
    })
  })

  describe('initialize the appliance without support for getCapabilities', function () {
    var init

    before(async function () {
      // Reset flags
      eventInitialized = false

      ac.on('initialized', () => {
        eventInitialized = true
      })

      await ac._connect()
      ac._connection.mockResponses.push(networkNotification)
      ac._connection.mockResponses.push(Buffer.from([0x99]))
      ac._connection.mockResponses.push(c0Response)
      init = await ac.initialize()
    })

    it('the initialized event should have been received', function () {
      assert.strictEqual(eventInitialized, true, 'initialized event has not been received')
    })

    it('the correct number of properties and capabilities must be returned', function () {
      assert.strictEqual(Object.keys(init.status).length, 52, 'wrong number of properties returned')
      assert.strictEqual(Object.keys(init.capabilities).length, 0, 'wrong number of capabilities returned')
    })
  })
})
