export const ApiOrigin = 'https://pay.hutko.org'

export const ApiEndpoint = {
  gateway: '/latest/checkout-v2/index.html',
  element: '/latest/checkout-v2/button/element.html',
}

export const ProxyUrl = 'http://secure-redirect.cloudipsp.com/submit/'

export const GooglePayApi = 'https://pay.google.com/gp/p/js/pay.js'

export const GoogleBaseRequest = {
  apiVersion: 2,
  apiVersionMinor: 0,
  allowedPaymentMethods: [
    {
      type: 'CARD',
      parameters: {
        allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
        allowedCardNetworks: ['AMEX', 'DISCOVER', 'INTERAC', 'JCB', 'MASTERCARD', 'VISA'],
      },
    },
  ],
  // NB: intentionally NOT setting `existingPaymentMethodRequired` — the Google
  // Pay button must be shown even to users without a saved card so they can
  // enrol one during checkout (isReadyToPay defaults to allowing enrolment).
}

// Apple Pay: every parameter (merchantIdentifier, merchantCapabilities,
// supportedNetworks, countryCode, line items, …) comes from the live gateway
// payload (api.checkout.pay/methods -> /api/checkout/ajax/mobile_pay).
// The SINGLE exception is `version`, which the SDK owns and negotiates at
// runtime against the browser (ApplePaySession.supportsVersion), down from the
// ceiling below. Keep this in sync with the highest version the payment
// backend supports. Apple Pay on the web works in Safari and — since
// iOS 18 / Feb 2025 — in third-party browsers (Chrome, Edge, Firefox) via the
// W3C PaymentRequest API.
export const ApplePayMaxVersion = 14

export const GooglePayLanguages = [
  'ar',
  'bg',
  'ca',
  'zh',
  'hr',
  'cs',
  'da',
  'nl',
  'en',
  'et',
  'fi',
  'fr',
  'de',
  'el',
  'id',
  'it',
  'ja',
  'ko',
  'ms',
  'no',
  'pl',
  'pt',
  'ru',
  'sr',
  'sk',
  'sl',
  'es',
  'sv',
  'th',
  'tr',
  'uk',
]

export const PaymentRequestDetails = {
  total: {
    label: 'Total',
    amount: {
      currency: 'USD',
      value: '0.00',
    },
  },
}

export const ApiFrameCss = {
  width: '1px !important',
  height: '1px !important',
  left: '1px !important',
  bottom: '1px !important',
  position: 'fixed !important',
  border: '0px !important',
}

export const ButtonFrameCss = {
  border: 'none !important',
  margin: '0 !important',
  padding: '0 !important',
  display: 'block !important',
  width: '1px !important',
  'min-width': '100% !important',
  background: 'transparent !important',
  position: 'relative !important',
  opacity: '0 !important',
  overflow: 'hidden !important',
  height: '100% !important',
  outline: 'none !important',
  'z-index': '1 !important',
}

export const ButtonFrameAttrs = {
  tabindex: '-1',
  scrolling: 'no',
  frameborder: 0,
  allowtransparency: true,
  // `allowpaymentrequest` is deprecated/removed in modern browsers; the
  // Permissions-Policy `allow="payment"` is the current way to let a
  // cross-origin iframe call the Payment Request / Apple Pay / Google Pay APIs.
  // Keep both for backward compatibility.
  allowpaymentrequest: true,
  allow: 'payment',
}

export const ButtonCoverCss = {
  'z-index': '2 !important',
  position: 'absolute !important',
  border: 'none !important',
  background: 'transparent !important',
  left: '0 !important',
  top: '0 !important',
  cursor: 'pointer !important',
  outline: 'none !important',
  width: '100% !important',
  height: '100% !important',
}

export const ButtonCoverAttrs = {
  role: 'button',
  'aria-pressed': 'false',
}

export const ButtonContainerCss = {
  border: '0 !important',
  margin: '0 !important',
  padding: '0 !important',
  display: 'block !important',
  background: 'transparent !important',
  'user-select': 'none !important',
  overflow: 'hidden !important',
  position: 'relative !important',
  opacity: '1 !important',
  height: '0 !important',
  width: '100% !important',
  outline: 'none !important',
}

export const ButtonDefaultColor = 'dark'

export const ButtonColorMap = {
  dark: 'dark',
  light: 'light',
  black: 'dark',
  white: 'light',
}

export const ButtonLabelMap = {
  ar: '',
  bg: '',
  ca: '',
  zh: '',
  hr: '',
  cs: '',
  da: '',
  nl: '',
  en: 'Pay with',
  et: '',
  es: 'Comprar con',
  el: '',
  fi: '',
  fr: 'Acheter avec',
  de: 'Zahlen über',
  id: '',
  it: 'Acquista con',
  ja: '',
  ko: '',
  ms: '',
  no: '',
  pl: 'Zapłać przez',
  pt: '',
  ru: 'Оплатить через',
  sr: '',
  sk: 'Zaplatiť cez',
  sl: '',
  sv: '',
  th: '',
  tr: '',
  uk: 'Оплатити через',
}
