/* eslint-disable mocha/no-hooks-for-single-case */

const assert = require('chai').assert
const appliances = require('../lib')

var axios = require('axios')
const MockAdapter = require('axios-mock-adapter')

// Encrypted response
const c0Response = '5e35139afd9171ee4eff428d09d7fafd84d235caf2c7ea362163204e521064a53a529db3fc9e58ebb7736da8625e7bbdaab0e99e84cb27554b916fe8b916cd5d924bca2c4187441cde1ca19e56b56a66fae3d6919dd3904aabfc19aa2acf42d02e4ab71a694bbd6898702b8065401582e92a0c3b92add1e19ce9497a7acc15bcc950c2074f3e088cadbad649d60e742294cae31309076cbdab7c0dc69cf00e89c2c5a22151bd945807177507a990d2ed20354ec1e5db30c0928dd6e944852cff7f6fb5e41c9e24b9eed1797d29ee448604e2e8dea201fe8c5b32d5e6bf6ab973'

// Encrypted response
const b5Response = 'd6da8a9acfaa8616c6f46ee94cdcd2c884d235caf2c7ea362163204e521064a53a529db3fc9e58ebb7736da8625e7bbdaab0e99e84cb27554b916fe8b916cd5d924bca2c4187441cde1ca19e56b56a662ce3444af7d54753f914deceffb5a292d4e058b53a39a5279ba90d01e86f38af16c58b320502c99b7d9bde861d1cdac88d48b8b9c8ad601d45f6722168749d7c2b64833822067697368eae2e212d2462be898536b65f5f3c2886d3c03c29b522699138e726bba889c89b124850490510924bca2c4187441cde1ca19e56b56a66924bca2c4187441cde1ca19e56b56a668bceb2fa05d048bda9992dcf5e214693'

var ac
var eventInitialized

describe('Connection tests midea cloud', function () {
  it('using the mideacloud method without specifying a uid should throw an error', function () {
    assert.throws(() => {
      ac = appliances.createAppliance({
        communicationMethod: 'mideacloud',
        password: 'secret',
        deviceId: 'id'
      })
    }, 'Cannot instantiate Midea cloud client, no user has been specified', 'should have thrown an error')
  })

  it('using the mideacloud method without specifying a password should throw an error', function () {
    assert.throws(() => {
      ac = appliances.createAppliance({
        communicationMethod: 'mideacloud',
        uid: 'me@midea.com',
        deviceId: 'id'
      })
    }, 'Cannot instantiate Midea cloud client because no password has been specified', 'should have thrown an error')
  })

  it('using the mideacloud method without specifying a deviceId should throw an error', function () {
    assert.throws(() => {
      ac = appliances.createAppliance({
        communicationMethod: 'mideacloud',
        uid: 'me@midea.com',
        password: 'secret'
      })
    }, 'Cannot instantiate Midea cloud client, no deviceId specified', 'should have thrown an error')
  })

  it('creating an appliance object successfully', function () {
    assert.doesNotThrow(() => {
      ac = appliances.createAppliance({
        communicationMethod: 'mideacloud',
        uid: 'me@midea.com',
        password: 'secret',
        deviceId: 'id'
      })
    })
  })
})

describe('Integration tests midea cloud:', function () {
  let mock

  before(async function () {
    // This sets the mock adapter on the default instance
    mock = new MockAdapter(axios)
  })

  after(function () {
    // This restores the original adapter that was there before installing the mock adapter and thus removes the mocking behavior
    mock.restore()
  })

  describe('initialize the appliance', function () {
    var init

    before(async function () {
      mock.onPost('/v1/appliance/transparent/send').replyOnce(200, {
        result: {
          reply: c0Response
        },
        errorCode: '0'
      })
      mock.onPost('/v1/appliance/transparent/send').replyOnce(200, {
        result: {
          reply: b5Response
        },
        errorCode: '0'
      })

      ac._connection._accessToken = '394edb4eb7c40310f5cb58526f519b54b920ebb829d567559397ded751813801'
      ac._connection._sessionId = 'aa34dde79f63459291d81667193da16020200826202844325'
      ac._connection._userId = 2913096

      // Reset flags
      eventInitialized = false

      ac.on('initialized', () => {
        eventInitialized = true
      })

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
})
