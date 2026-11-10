/**
 * @jest-environment jsdom
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals'

const APPLE_PAY_SDK =
  'https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js?components=apple-pay-button'

const wait = (ms = 60) => new Promise((resolve) => setTimeout(resolve, ms))

const createApplePaySession = (options = {}) => {
  const { canMakePayments = true, supportsVersion = true, throwOnCreate = false } = options
  const instances = []
  function ApplePaySession(version, request) {
    if (throwOnCreate)
      throw new Error('Must create a new ApplePaySession from a user gesture handler.')
    this.version = version
    this.request = request
    this.begin = jest.fn()
    this.abort = jest.fn(() => {
      if (this.oncancel) this.oncancel({})
    })
    this.completeMerchantValidation = jest.fn()
    this.completePayment = jest.fn()
    instances.push(this)
  }
  ApplePaySession.STATUS_SUCCESS = 0
  ApplePaySession.canMakePayments = jest.fn(() => canMakePayments)
  ApplePaySession.supportsVersion = jest.fn(() => supportsVersion)
  ApplePaySession.canMakePaymentsWithActiveCard = jest.fn(() => Promise.resolve(canMakePayments))
  ApplePaySession.instances = instances
  return ApplePaySession
}

// The payload format of api.checkout.pay -> methods (checkout layer, parseMethods)
const createPayload = (params = {}) => {
  const details = params.details || {
    id: '',
    displayItems: [],
    total: { label: 'Shop', amount: { value: 100.5, currency: 'UAH' } },
  }
  const options = Object.assign(
    {
      requestPayerName: false,
      requestPayerEmail: true,
      requestPayerPhone: false,
      requestShipping: false,
    },
    params.options
  )
  const apple = {
    supportedMethods: 'https://apple.com/apple-pay',
    data: {
      version: 3,
      merchantIdentifier: 'merchant.test',
      merchantCapabilities: ['supports3DS', 'supportsCredit', 'supportsDebit'],
      supportedNetworks: ['masterCard', 'visa', 'maestro'],
      countryCode: 'US',
    },
  }
  const google = {
    supportedMethods: 'https://google.com/pay',
    data: { environment: 'TEST', apiVersion: 2, apiVersionMinor: 0 },
  }
  const allowed = params.allowed || ['apple', 'google']
  const provider = {}
  if (allowed.includes('apple')) provider.apple = { methods: [apple], details, options }
  if (allowed.includes('google')) provider.google = { methods: [google], details, options }
  return { payment_system: 'mobile_pay', allowed, provider }
}

const getSdkScripts = () =>
  document.querySelectorAll('script[src*="applepay.cdn-apple.com/jsapi/"]')

let modules

const loadModules = async () => {
  jest.resetModules()
  const request = await import('../src/core/payment/request.js')
  const element = await import('../src/core/payment/element.js')
  const deferred = await import('../src/core/deferred.js')
  const apple = await import('../src/core/apple/pay.js')
  return {
    PaymentRequestApi: request.PaymentRequestApi,
    PaymentElement: element.PaymentElement,
    Deferred: deferred.Deferred,
    ApplePay: apple.ApplePay,
  }
}

const createRequest = async (params = {}) => {
  const request = new modules.PaymentRequestApi(params)
  const events = { supported: [], error: [], details: [] }
  request.on('supported', (supported) => events.supported.push(supported.provider.slice()))
  request.on('error', (error) => events.error.push(error))
  request.on('details', (details) => events.details.push(details))
  await request.getSupportedMethods()
  return { request, events }
}

beforeEach(async () => {
  delete window.ApplePaySession
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  modules = await loadModules()
})

describe('Apple Pay availability', () => {
  test('native ApplePaySession (Safari, iOS): supported without loading the SDK', async () => {
    window.ApplePaySession = createApplePaySession()
    const { request, events } = await createRequest()
    request.setPayload(createPayload())
    await wait()
    // no PaymentRequest in jsdom: google is added last, as the pay.js fallback
    expect(events.supported).toEqual([['apple', 'google']])
    expect(window.ApplePaySession.supportsVersion).toHaveBeenCalledWith(3)
    expect(getSdkScripts()).toHaveLength(0)
  })

  test('native ApplePaySession: not supported when canMakePayments() is false', async () => {
    window.ApplePaySession = createApplePaySession({ canMakePayments: false })
    const { request, events } = await createRequest()
    request.setPayload(createPayload())
    await wait()
    expect(events.supported).toEqual([['google']])
    expect(getSdkScripts()).toHaveLength(0)
  })

  test('third-party browser: the SDK is loaded once the gateway allows Apple Pay', async () => {
    const { request, events } = await createRequest()
    expect(events.supported).toEqual([['google']])
    expect(getSdkScripts()).toHaveLength(0)

    request.setPayload(createPayload())
    const scripts = getSdkScripts()
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe(APPLE_PAY_SDK)

    window.ApplePaySession = createApplePaySession()
    scripts[0].dispatchEvent(new Event('load'))
    await wait()
    expect(events.supported).toEqual([['google'], ['google', 'apple']])
    expect(events.error).toEqual([])

    // payload updates don't load the SDK again and don't repeat the event
    request.setPayload(createPayload())
    await wait()
    expect(getSdkScripts()).toHaveLength(1)
    expect(events.supported).toHaveLength(2)
  })

  test('third-party browser: the SDK is not loaded when the gateway does not allow Apple Pay', async () => {
    const { request } = await createRequest()
    request.setPayload(createPayload({ allowed: ['google'] }))
    await wait()
    expect(getSdkScripts()).toHaveLength(0)
  })

  test('third-party browser: the SDK is not loaded when the merchant renders no Apple Pay button', async () => {
    const { request } = await createRequest({ methods: ['google'] })
    request.setPayload(createPayload())
    await wait()
    expect(getSdkScripts()).toHaveLength(0)
  })

  test('third-party browser: the SDK failed to load, Apple Pay stays unsupported without errors', async () => {
    const { request, events } = await createRequest()
    request.setPayload(createPayload())
    getSdkScripts()[0].dispatchEvent(new Event('error'))
    await wait()
    expect(events.supported).toEqual([['google']])
    expect(events.error).toEqual([])
  })

  test('mobile browser (Android): the SDK is loaded, but canMakePayments() is false', async () => {
    const { request, events } = await createRequest()
    request.setPayload(createPayload())
    window.ApplePaySession = createApplePaySession({ canMakePayments: false })
    getSdkScripts()[0].dispatchEvent(new Event('load'))
    await wait()
    expect(events.supported).toEqual([['google']])
  })

  test('the page already has the SDK script that is still loading: no second script', async () => {
    const script = document.createElement('script')
    script.src = APPLE_PAY_SDK
    document.head.appendChild(script)
    const { request, events } = await createRequest()
    request.setPayload(createPayload())
    expect(getSdkScripts()).toHaveLength(1)

    window.ApplePaySession = createApplePaySession()
    script.dispatchEvent(new Event('load'))
    await wait()
    expect(events.supported).toEqual([['google'], ['google', 'apple']])
  })
})

describe('Apple Pay session config', () => {
  test('is built from the gateway payload', () => {
    const payload = createPayload().provider.apple
    expect(modules.ApplePay.getVersion(payload)).toBe(3)
    expect(modules.ApplePay.getSessionConfig(payload)).toEqual({
      merchantCapabilities: ['supports3DS', 'supportsCredit', 'supportsDebit'],
      supportedNetworks: ['masterCard', 'visa', 'maestro'],
      countryCode: 'US',
      currencyCode: 'UAH',
      total: { label: 'Shop', amount: '100.5' },
      requiredShippingContactFields: ['email'],
    })
  })

  test('maps display items and payer options', () => {
    const payload = createPayload({
      details: {
        id: 'order-1',
        displayItems: [{ label: 'Delivery', amount: { value: '10.00', currency: 'UAH' } }],
        total: { label: 'Shop', amount: { value: '110.00', currency: 'UAH' } },
      },
      options: {
        requestPayerName: true,
        requestPayerEmail: true,
        requestPayerPhone: true,
        requestShipping: true,
      },
    }).provider.apple
    const config = modules.ApplePay.getSessionConfig(payload)
    expect(config.total).toEqual({ label: 'Shop', amount: '110.00' })
    expect(config.lineItems).toEqual([{ label: 'Delivery', amount: '10.00' }])
    expect(config.requiredShippingContactFields).toEqual([
      'name',
      'email',
      'phone',
      'postalAddress',
    ])
    expect(config.requiredBillingContactFields).toBeUndefined()
  })

  test('without payer options there are no required contact fields', () => {
    const payload = createPayload({ options: { requestPayerEmail: false } }).provider.apple
    expect(modules.ApplePay.getSessionConfig(payload).requiredShippingContactFields).toBeUndefined()
  })

  test('throws without the payment total', () => {
    const payload = createPayload({ details: {} }).provider.apple
    expect(() => modules.ApplePay.getSessionConfig(payload)).toThrow('total is missing')
  })
})

describe('Apple Pay payment', () => {
  const resolved = (value) => {
    const defer = modules.Deferred()
    defer.resolve(value)
    return defer
  }
  const rejected = (value) => {
    const defer = modules.Deferred()
    defer.reject(value)
    return defer
  }

  const preparePayment = async (sessionOptions) => {
    window.ApplePaySession = createApplePaySession(sessionOptions)
    const { request, events } = await createRequest()
    request.setMerchant(1000024)
    request.setPayload(createPayload())
    return { request, events }
  }

  test('success: merchant validation, payment authorization, details event', async () => {
    const { request, events } = await preparePayment()
    request.appleSession = jest.fn(() =>
      resolved({ data: { merchantSessionIdentifier: 'session' } })
    )
    request.pay('apple')

    const session = window.ApplePaySession.instances[0]
    expect(session.version).toBe(3)
    expect(session.request.total).toEqual({ label: 'Shop', amount: '100.5' })
    expect(session.begin).toHaveBeenCalledTimes(1)
    // the merchant identifier is passed only to Apple's JS SDK, not to the native ApplePaySession
    expect(window.ApplePaySession.canMakePaymentsWithActiveCard).not.toHaveBeenCalled()

    session.onvalidatemerchant({
      validationURL: 'https://apple-pay-gateway.apple.com/paymentservices/startSession',
    })
    expect(request.appleSession).toHaveBeenCalledWith({
      url: 'https://apple-pay-gateway.apple.com/paymentservices/startSession',
      domain: location.host,
      merchant_id: 1000024,
    })
    expect(session.completeMerchantValidation).toHaveBeenCalledWith({
      merchantSessionIdentifier: 'session',
    })

    const payment = {
      token: { paymentData: { data: 'encrypted' } },
      shippingContact: { emailAddress: 'a@b.c' },
    }
    session.onpaymentauthorized({ payment })
    expect(session.completePayment).toHaveBeenCalledWith(0)
    expect(events.details).toEqual([{ payment_system: 'mobile_pay', data: payment }])
    expect(events.error).toEqual([])
    expect(request.isPending()).toBe(false)
  })

  test('merchant validation failed: the session is aborted, the error is not reported as a cancel', async () => {
    const { request, events } = await preparePayment()
    const error = { error: { code: 1016, message: 'Merchant not found' } }
    request.appleSession = jest.fn(() => rejected(error))
    request.pay('apple')

    const session = window.ApplePaySession.instances[0]
    session.onvalidatemerchant({
      validationURL: 'https://apple-pay-gateway.apple.com/paymentservices/startSession',
    })
    expect(session.abort).toHaveBeenCalledTimes(1)
    expect(events.error).toEqual([error])
    expect(request.isPending()).toBe(false)
  })

  test('the gateway returned no merchant session: the session is aborted with the reason', async () => {
    const { request, events } = await preparePayment()
    request.appleSession = jest.fn(() =>
      resolved({ status: 'fail', reason: 'session_failed', data: {}, response_status: 'success' })
    )
    request.pay('apple')

    const session = window.ApplePaySession.instances[0]
    session.onvalidatemerchant({
      validationURL: 'https://apple-pay-gateway.apple.com/paymentservices/startSession',
    })
    expect(session.completeMerchantValidation).not.toHaveBeenCalled()
    expect(session.abort).toHaveBeenCalledTimes(1)
    expect(events.error).toEqual([
      { message: 'Apple Pay merchant validation failed', reason: 'session_failed' },
    ])
    expect(request.isPending()).toBe(false)
  })

  test('cancelled by the customer: error with code 20', async () => {
    const { request, events } = await preparePayment()
    request.pay('apple')
    window.ApplePaySession.instances[0].oncancel({})
    expect(events.error).toEqual([{ code: 20, message: 'Payment request was cancelled' }])
    expect(events.details).toEqual([])
  })

  test('the session could not be created: error, the button is not blocked', async () => {
    const { request, events } = await preparePayment({ throwOnCreate: true })
    request.pay('apple')
    expect(events.error).toHaveLength(1)
    expect(events.error[0].message).toContain('user gesture')
    expect(request.isPending()).toBe(false)
  })

  test("Apple's JS SDK: the merchant identifier is passed before the session is created", async () => {
    const { request } = await createRequest()
    request.setMerchant(1000024)
    request.setPayload(createPayload())
    window.ApplePaySession = createApplePaySession()
    getSdkScripts()[0].dispatchEvent(new Event('load'))
    await wait()
    request.pay('apple')
    expect(window.ApplePaySession.canMakePaymentsWithActiveCard).toHaveBeenCalledWith(
      'merchant.test'
    )
    expect(window.ApplePaySession.instances).toHaveLength(1)
  })
})

describe('PaymentElement', () => {
  const createElements = (request) => {
    document.body.innerHTML = '<div id="buttons"></div>'
    return ['apple', 'google'].map((method, index) => {
      const element = new modules.PaymentElement({ method, index, appendTo: '#buttons' })
      element.setPaymentRequest(request)
      jest.spyOn(element, 'show')
      return element
    })
  }
  const getMounted = () =>
    Array.from(document.querySelectorAll('#buttons > .payment-element')).map((el) =>
      el.getAttribute('data-index')
    )

  test('a method supported after the payload is shown and keeps its position', () => {
    const request = new modules.PaymentRequestApi({})
    const [apple, google] = createElements(request)

    request.setSupported({ fallback: true, provider: ['google'] })
    request.setPayload({ payment_system: 'mobile_pay', allowed: ['apple', 'google'], provider: {} })
    expect(getMounted()).toEqual(['1'])
    expect(google.show).toHaveBeenCalled()
    expect(apple.show).not.toHaveBeenCalled()

    request.setSupported({ fallback: true, provider: ['google', 'apple'] })
    expect(getMounted()).toEqual(['0', '1'])
    expect(apple.show).toHaveBeenCalled()
  })

  test('a supported method is not shown until the gateway allows it', () => {
    const request = new modules.PaymentRequestApi({})
    const [apple] = createElements(request)
    request.setSupported({ fallback: false, provider: ['apple'] })
    request.setPayload({ payment_system: 'mobile_pay', allowed: ['google'], provider: {} })
    expect(getMounted()).toEqual(['0'])
    expect(apple.show).not.toHaveBeenCalled()
  })
})
