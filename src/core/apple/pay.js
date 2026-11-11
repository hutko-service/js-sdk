import { Deferred } from '../deferred.js'
import { Module } from '../module.js'
import { ApplePayApi, ApplePayVersion } from '../config.js'

const APPLE_PAY_METHOD = 'https://apple.com/apple-pay'

const toAmount = (amount) => String(amount.value)

const ApplePayClient = Module.extend({
  id: 'apple-pay-sdk',
  init() {
    this.defer = null
    this.polyfill = false
  },
  getSession() {
    return window.ApplePaySession || null
  },
  // ApplePaySession is native in Safari and in any browser on iOS/iPadOS.
  // In third-party desktop browsers (Chrome, Edge, Firefox) it is provided by Apple's JS SDK.
  hasSession() {
    return this.getSession() !== null
  },
  // Loads Apple's JS SDK once per page. Resolves when ApplePaySession is available,
  // rejects when the script can't be loaded (CSP, content blocker, CDN unavailable).
  load() {
    if (this.defer) return this.defer
    this.defer = Deferred()
    if (this.hasSession()) return this.defer.resolveWith(this)
    // The page may already include the SDK: wait for that script instead of loading it twice
    let script = this.utils.querySelector('script[src*="applepay.cdn-apple.com/jsapi/"]')
    if (script === null) {
      script = this.utils.createElement('script')
      this.addAttr(script, {
        id: this.id,
        src: ApplePayApi,
        crossorigin: 'anonymous',
      })
      this.utils.querySelector('head').appendChild(script)
    }
    this.addEvent(script, 'load', 'onLoad')
    this.addEvent(script, 'error', 'onLoadError')
    return this.defer
  },
  onLoad() {
    if (this.hasSession()) {
      this.polyfill = true
      this.defer.resolveWith(this)
    } else {
      this.defer.rejectWith(this)
    }
  },
  onLoadError() {
    this.defer.rejectWith(this)
  },
  // canMakePayments() is required in addition to supportsVersion(): Apple's JS SDK
  // defines ApplePaySession on Android too, but Apple Pay can't be used there.
  isAvailable(version) {
    const defer = Deferred()
    const session = this.getSession()
    const done = (status) => {
      defer.resolveWith(this, [status === true])
    }
    try {
      if (session === null || session.supportsVersion(version || ApplePayVersion) !== true) {
        done(false)
      } else {
        const status = session.canMakePayments()
        if (status && typeof status.then === 'function') {
          status.then(done, () => done(false))
        } else {
          done(status)
        }
      }
    } catch (e) {
      done(false)
    }
    return defer
  },
  getMethodData(payload) {
    const methods = payload.methods || []
    const method = methods.find((item) => item.supportedMethods === APPLE_PAY_METHOD)
    return (method && method.data) || {}
  },
  getVersion(payload) {
    return this.getMethodData(payload).version || ApplePayVersion
  },
  // ApplePayPaymentRequest built from the gateway payload, which has the PaymentRequest API format:
  // methods[].data (Apple Pay method data), details (total, displayItems), options (requestPayer*).
  getSessionConfig(payload) {
    const data = this.getMethodData(payload)
    const details = payload.details || {}
    const options = payload.options || {}
    const total = details.total
    if (!total || !total.amount) {
      throw new Error('Apple Pay: payment total is missing')
    }
    const config = {}
    this.utils.forEach(data, function (value, key) {
      // version is the ApplePaySession constructor argument, merchantIdentifier is used by merchant validation
      if (key !== 'version' && key !== 'merchantIdentifier') config[key] = value
    })
    config.currencyCode = config.currencyCode || total.amount.currency
    config.total = {
      label: total.label,
      amount: toAmount(total.amount),
    }
    if (
      !config.lineItems &&
      this.utils.isArray(details.displayItems) &&
      details.displayItems.length
    ) {
      config.lineItems = details.displayItems.map((item) => ({
        label: item.label,
        amount: toAmount(item.amount),
      }))
    }
    // PaymentRequest options are mapped to the shipping contact fields, as Safari does
    const fields = [].concat(config.requiredShippingContactFields || [])
    const requireField = (field, enabled) => {
      if (enabled === true && fields.indexOf(field) === -1) fields.push(field)
    }
    requireField('name', options.requestPayerName)
    requireField('email', options.requestPayerEmail)
    requireField('phone', options.requestPayerPhone)
    requireField('postalAddress', options.requestShipping)
    if (fields.length) config.requiredShippingContactFields = fields
    return config
  },
  // Apple's JS SDK (1.3.x) sends the merchant identifier to its Apple Pay code page only after
  // canMakePaymentsWithActiveCard() or applePayCapabilities() got it. In the SDK the former
  // makes no network requests, its result is not needed.
  setMerchantIdentifier(merchantIdentifier) {
    const session = this.getSession()
    if (this.polyfill === false || !merchantIdentifier) return
    if (typeof session.canMakePaymentsWithActiveCard !== 'function') return
    try {
      const result = session.canMakePaymentsWithActiveCard(merchantIdentifier)
      if (result && typeof result.catch === 'function') result.catch(function () {})
    } catch (e) {}
  },
  createSession(payload) {
    const ApplePaySession = this.getSession()
    const config = this.getSessionConfig(payload)
    this.setMerchantIdentifier(this.getMethodData(payload).merchantIdentifier)
    return new ApplePaySession(this.getVersion(payload), config)
  },
  getStatusSuccess() {
    return this.getSession().STATUS_SUCCESS
  },
})

export const ApplePay = new ApplePayClient()
