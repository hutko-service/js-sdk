import { Module } from '../module.js'
import { Api } from '../api.js'
import { GooglePay } from '../google/pay.js'
import { Deferred } from '../deferred.js'
import { getPaymentRequest, hasProp, isFunction } from '../utils.js'
import { GoogleBaseRequest, ApplePayMaxVersion, PaymentRequestDetails } from '../config.js'

const APPLE_PAY_METHOD = 'https://apple.com/apple-pay'

// Apple Pay capability pre-filter (needs no merchant data).
// - Safari / WebKit: `ApplePaySession.canMakePayments()` is synchronous and
//   authoritative (desktop Safari with Touch ID / a paired device included).
// - Other browsers (Chrome, Edge, Firefox), iOS 18+/2025+: Apple Pay is exposed
//   through the W3C PaymentRequest API (cross-device QR), so we only require
//   `PaymentRequest` here; the real gate is `show()` at pay time.
// Previously this was hard-gated to `window.ApplePaySession`, which excluded
// every non-Safari browser and hid Apple Pay on desktop Chrome/Firefox.
const canUseApplePay = () => {
  const session = window.ApplePaySession
  if (session && isFunction(session.canMakePayments)) {
    try {
      return session.canMakePayments()
    } catch (e) {
      return false
    }
  }
  return hasProp(window, 'PaymentRequest')
}

// The SDK owns the Apple Pay version (everything else comes from the gateway
// payload). Negotiate the highest version the browser supports in Safari, down
// from ApplePayMaxVersion; other browsers get the ceiling.
const getApplePayVersion = () => {
  const session = window.ApplePaySession
  if (session && isFunction(session.supportsVersion)) {
    for (let v = ApplePayMaxVersion; v >= 1; v--) {
      try {
        if (session.supportsVersion(v)) return v
      } catch (e) {}
    }
    return 1
  }
  return ApplePayMaxVersion
}

// Override ONLY the `version` of the Apple Pay method inside a gateway payload;
// merchantIdentifier / networks / capabilities / country stay as the backend sent them.
// Backward-compatibility guard: the effective version is negotiated DOWN to what
// the browser supports but is NEVER raised above the version the backend declared
// in the payload — so an existing merchant/backend that only supports v3 keeps
// getting v3 (no regression), while newer backends can advertise higher versions.
const withApplePayVersion = (payload) => {
  const negotiated = getApplePayVersion()
  const methods = payload && payload.methods ? payload.methods : []
  methods.forEach((method) => {
    if (method && method.supportedMethods === APPLE_PAY_METHOD && method.data) {
      const backend = method.data.version || negotiated
      method.data.version = Math.min(negotiated, backend)
    }
  })
  return payload
}

// Wallet methods probed on init:
// - google: decided by an async PaymentRequest.canMakePayment() probe.
// - apple: decided synchronously by canUseApplePay() — no hardcoded request
//   object; the Apple Pay parameters arrive with the gateway payload at pay time.
const getPaymentMethods = () => {
  return [
    {
      method: 'google',
      config: { supportedMethods: 'https://google.com/pay', data: GoogleBaseRequest },
    },
    {
      method: 'apple',
      available: canUseApplePay,
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
  const details = PaymentRequestDetails
  ;(function check() {
    const item = methods.shift()
    if (item === undefined) {
      if (requestSupported.provider.indexOf('google') === -1) {
        requestSupported.fallback = true
        requestSupported.provider.push('google')
        // Preload the Google Pay JS API now so the first button click keeps the
        // user gesture. Otherwise the fallback lazy-loads pay.js on click, the
        // async load breaks the gesture chain and loadPaymentData is blocked as
        // a popup. Idempotent (GooglePay.load() no-ops if already loaded).
        GooglePay.load()
      }
      return requestDeferred.resolve(requestSupported)
    }
    // Synchronous capability decision (Apple Pay) — no PaymentRequest probe.
    if (isFunction(item.available)) {
      if (item.available()) requestSupported.provider.push(item.method)
      setTimeout(check, 25)
      return
    }
    // Async PaymentRequest.canMakePayment() probe (Google Pay).
    const request = getPaymentRequest([item.config], details, {})
    if (request) {
      request
        .canMakePayment()
        .then(function (status) {
          if (status === true) requestSupported.provider.push(item.method)
          setTimeout(check, 25)
        })
        .catch(function () {
          setTimeout(check, 25)
        })
    } else {
      setTimeout(check, 25)
    }
  })()
  return requestDeferred
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
    return this
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
    if (this.isFallbackMethod(method)) {
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
    // SDK owns the Apple Pay version; everything else stays from the payload.
    payload = withApplePayVersion(payload)
    const request = getPaymentRequest(payload.methods, payload.details, payload.options)
    if (!request) {
      return defer.rejectWith(self, [{ message: 'PaymentRequest is not available' }])
    }
    this.addEvent(request, 'merchantvalidation', 'merchantValidation')
    // Call show() directly inside the click's user gesture. Support was already
    // probed in getSupportedMethods(); awaiting canMakePayment() here first would
    // consume the transient user activation and make show() throw in strict browsers.
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
  merchantValidation(cx, event) {
    const { validationURL } = event
    const { host } = location
    this.appleSession({
      url: validationURL,
      domain: host,
      merchant_id: this.merchant,
    })
      .done(function (session) {
        try {
          event.complete(session.data)
        } catch (error) {
          this.trigger('error', error)
        }
      })
      .fail(function (error) {
        this.trigger('error', error)
      })
  },
})
