import { Module } from '../module.js'
import { Api } from '../api.js'
import { GooglePay } from '../google/pay.js'
import { ApplePay } from '../apple/pay.js'
import { Deferred } from '../deferred.js'
import { getPaymentRequest, isArray, isFunction, isPlainObject } from '../utils.js'
import { GoogleBaseRequest, PaymentRequestDetails } from '../config.js'

const canMakePaymentRequest = (config) => (done) => {
  const request = getPaymentRequest([config], PaymentRequestDetails, {})
  if (request === null) return done(false)
  request
    .canMakePayment()
    .then(function (status) {
      done(status === true)
    })
    .catch(function () {
      done(false)
    })
}

let applePayNative = false

const getPaymentMethods = () => {
  return [
    {
      method: 'google',
      check: canMakePaymentRequest({
        supportedMethods: 'https://google.com/pay',
        data: GoogleBaseRequest,
      }),
    },
    {
      // Native ApplePaySession only (Safari, any browser on iOS/iPadOS).
      // Third-party browsers get it from Apple's JS SDK later, see getApplePaySdkSupport()
      method: 'apple',
      check: (done) => {
        applePayNative = ApplePay.hasSession()
        if (applePayNative === false) return done(false)
        ApplePay.isAvailable().done(done)
      },
    },
  ]
}

let requestDeferred = null

let requestSupported = {
  fallback: false,
  provider: [],
}

const getSupportedMethods = () => {
  if (requestDeferred) return requestDeferred
  requestDeferred = Deferred()
  const methods = getPaymentMethods()
  ;(function check() {
    const item = methods.shift()
    if (item === undefined) {
      if (requestSupported.provider.indexOf('google') === -1) {
        requestSupported.fallback = true
        requestSupported.provider.push('google')
      }
      return requestDeferred.resolve(requestSupported)
    }
    item.check(function (status) {
      if (status === true) requestSupported.provider.push(item.method)
      setTimeout(check, 25)
    })
  })()
  return requestDeferred
}

let applePaySdkDeferred = null

// Apple Pay in third-party browsers (Chrome, Edge, Firefox): Apple's JS SDK is loaded once per page,
// when a gateway payload allows Apple Pay. Resolves with true when it adds Apple Pay to the supported methods.
const getApplePaySdkSupport = () => {
  if (applePaySdkDeferred) return applePaySdkDeferred
  applePaySdkDeferred = Deferred()
  const resolve = (status) => {
    applePaySdkDeferred.resolve(status === true)
  }
  getSupportedMethods().done(function () {
    // ApplePaySession existed when the supported methods were checked: that result is final
    if (applePayNative) {
      resolve(false)
      return
    }
    ApplePay.load()
      .done(function () {
        ApplePay.isAvailable().done(function (status) {
          if (status === true && requestSupported.provider.indexOf('apple') === -1) {
            requestSupported.provider.push('apple')
          }
          resolve(status)
        })
      })
      .fail(function () {
        resolve(false)
      })
  })
  return applePaySdkDeferred
}

const PaymentRequestInterface = Module.extend({
  config: {
    payment_system: '',
    fallback: false,
    methods: [],
    details: {},
    options: {},
  },
  supported: {
    fallback: false,
    provider: [],
  },
  payload: {
    payment_system: null,
    provider: [],
  },
  params: {},
  getSupportedMethods() {
    return getSupportedMethods().then((supported) => {
      this.setSupported(supported)
      return supported
    })
  },
  init(params) {
    this.params = params || {}
  },
  setSupported(supported) {
    this.supported = supported
    this.trigger('supported', supported)
    return this
  },
  setPayload(payload) {
    this.payload = payload
    this.trigger('payload', payload)
    this.loadExternalApi()
    return this
  },
  isMethodAllowed(method) {
    const allowed = this.payload && this.payload.allowed
    return isArray(allowed) && allowed.indexOf(method) !== -1
  },
  // params.methods: the buttons the merchant renders (PaymentButton `methods`), all methods by default
  isMethodRequested(method) {
    const methods = this.params.methods
    return !isArray(methods) || methods.indexOf(method) !== -1
  },
  // Wallet scripts are loaded only for the methods the merchant renders and the gateway allows
  loadExternalApi() {
    if (this.isMethodRequested('google') && this.isMethodAllowed('google')) {
      getSupportedMethods().done(function (supported) {
        // Load pay.js before the click, so the payment sheet opens within the user gesture
        if (supported.fallback) GooglePay.load()
      })
    }
    if (
      this.isMethodRequested('apple') &&
      this.isMethodAllowed('apple') &&
      !this.applePaySdkRequested
    ) {
      this.applePaySdkRequested = true
      getApplePaySdkSupport().done((status) => {
        if (status === true) this.setSupported(requestSupported)
      })
    }
  },
  setMerchant(merchant) {
    this.merchant = merchant
  },
  setBeforeCallback(beforeCallback) {
    if (isFunction(beforeCallback)) {
      this.params.before = beforeCallback
    }
  },
  setAfterCallback(afterCallback) {
    if (isFunction(afterCallback)) {
      this.params.after = afterCallback
    }
  },
  setApi(api) {
    if (api instanceof Api) this.api = api
    return this
  },
  getProviderPayload(method) {
    return this.payload.provider[method] || {}
  },
  isMethodSupported(method) {
    return this.supported.provider.indexOf(method) !== -1
  },
  isFallbackMethod(method) {
    return method === 'google' && this.supported.fallback
  },
})

export const PaymentRequestApi = PaymentRequestInterface.extend({
  request(method, params, success, failure) {
    if (this.api) {
      this.api.scope(
        this.proxy(function () {
          this.api
            .request('api.checkout.pay', method, params)
            .done(this.proxy(success))
            .fail(this.proxy(failure))
        })
      )
    }
  },
  update(data) {
    const defer = Deferred()
    this.request(
      'methods',
      data,
      function (cx, model) {
        this.onUpdate(cx, model)
        defer.resolveWith(this, [model])
      },
      function (cx, model) {
        this.onError(cx, model)
        defer.rejectWith(this, [model])
      }
    )
    return defer
  },
  onUpdate(cx, model) {
    this.setPayload(model.serialize())
  },
  onError(cx, model) {
    this.trigger('error', model)
  },
  isPending() {
    return this.pendingState === true
  },
  setPending(state) {
    this.pendingState = state
    clearTimeout(this.pendingTimeoutEvent)
    this.pendingTimeoutEvent = setTimeout(() => {
      this.trigger('pending', state)
    }, 100)
  },
  beforeCallback(defer) {
    defer.resolve()
  },
  setBeforeCallback(callback) {
    if (isFunction(callback)) {
      this.beforeCallback = callback
    }
    return this
  },
  before() {
    if (this.isPending()) return
    this.setPending(true)
    const defer = Deferred()
    const context = this
    defer.always(function () {
      context.setPending(false)
    })
    this.params.before(defer)
    return defer
  },
  after(params) {
    const defer = Deferred()
    this.params.after(defer, params)
    return defer
  },
  pay(method) {
    if (this.isPending()) return
    this.setPending(true)
    const context = this
    const response = Deferred()
    const payload = this.getProviderPayload(method)
    response.always(function () {
      context.setPending(false)
    })
    if (this.isMethodSupported(method) === false) {
      return response.rejectWith(this, [{ test: true }])
    }
    if (method === 'apple') {
      this.makeApplePayment(response, payload)
    } else if (this.isFallbackMethod(method)) {
      this.makePaymentFallback(response, payload.methods)
    } else {
      this.makeNativePayment(response, payload)
    }
    return response
      .done(function (data) {
        context.trigger('details', {
          payment_system: context.payload.payment_system,
          data,
        })
      })
      .fail(function (error) {
        context.trigger('error', error)
        if (context.params.embedded === true) {
          location.reload()
          context.trigger('reload', context.params)
        }
      })
  },
  makeNativePayment(defer, payload) {
    const self = this
    const request = getPaymentRequest(payload.methods, payload.details, payload.options)
    if (request === null) {
      return defer.rejectWith(self, [{ message: 'PaymentRequest is not available' }])
    }
    // show() is called right away: awaiting canMakePayment() first may lose the user gesture
    request
      .show()
      .then(function (response) {
        response.complete('success').then(function () {
          defer.resolveWith(self, [response.details])
        })
      })
      .catch(function (e) {
        defer.rejectWith(self, [{ code: e.code, message: e.message }])
      })
  },
  // Apple Pay JS API: ApplePaySession is created and started synchronously in the click handler,
  // otherwise the browser rejects it as not triggered by a user gesture.
  makeApplePayment(defer, payload) {
    const self = this
    const reject = function (error) {
      defer.rejectWith(self, [error])
    }
    let session
    try {
      session = ApplePay.createSession(payload)
    } catch (e) {
      return reject({ code: e.code, message: e.message })
    }
    const abort = function (error) {
      // reject before abort(): it may trigger oncancel, whose code 20 consumers treat as a user cancel
      reject(error)
      try {
        session.abort()
      } catch (e) {}
    }
    session.onvalidatemerchant = function (event) {
      self
        .appleSession({
          url: event.validationURL,
          domain: location.host,
          merchant_id: self.merchant,
        })
        .done(function (data) {
          const merchantSession = data && data.data
          // The gateway answers {status: 'fail', reason} without a merchant session
          // (Apple Pay disabled, domain not registered). Apple's JS SDK doesn't throw on an empty one.
          if (!isPlainObject(merchantSession) || Object.keys(merchantSession).length === 0) {
            abort({
              message: 'Apple Pay merchant validation failed',
              reason: (data && data.reason) || null,
            })
          } else {
            try {
              session.completeMerchantValidation(merchantSession)
            } catch (e) {
              abort({ code: e.code, message: e.message })
            }
          }
        })
        .fail(function (error) {
          abort(error)
        })
    }
    session.onpaymentauthorized = function (event) {
      try {
        session.completePayment(ApplePay.getStatusSuccess())
      } catch (e) {}
      defer.resolveWith(self, [event.payment])
    }
    session.oncancel = function () {
      reject({ code: 20, message: 'Payment request was cancelled' })
    }
    try {
      session.begin()
    } catch (e) {
      reject({ code: e.code, message: e.message })
    }
  },
  makePaymentFallback(defer, methods) {
    const self = this
    GooglePay.load().then(() => {
      GooglePay.show(methods)
        .then((details) => {
          defer.resolveWith(self, [details])
        })
        .catch((e) => {
          defer.rejectWith(self, [{ code: e.code, message: e.message }])
        })
    })
  },
  appleSession(params) {
    const defer = Deferred()
    this.request(
      'session',
      params,
      function (c, model) {
        defer.resolveWith(this, [model.serialize()])
      },
      function (c, model) {
        defer.rejectWith(this, [model])
      }
    )
    return defer
  },
})
