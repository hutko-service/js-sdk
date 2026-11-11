export const ApiOrigin = 'https://pay.hutko.org'

export const ApiEndpoint = {
  gateway: '/latest/checkout-v2/index.html',
  element: '/latest/checkout-v2/button/element.html',
}

export const ProxyUrl = 'http://secure-redirect.cloudipsp.com/submit/'

export const GooglePayApi = 'https://pay.google.com/gp/p/js/pay.js'

// Apple's JS SDK: provides ApplePaySession in third-party browsers (Chrome, Edge, Firefox).
// Only the `1.latest` build includes it, pinned builds (e.g. `1.2.0`) don't.
// `components`: without it the SDK also loads the Apple Wallet button, which adds a <style> to the page.
// `apple-pay-button` is the smallest documented set, the buttons are rendered by this SDK.
export const ApplePayApi =
  'https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js?components=apple-pay-button'

// Minimum Apple Pay JS API version for the button, also used when the gateway payload has no version
export const ApplePayVersion = 3

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
}

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
  // `allowpaymentrequest` is deprecated, Permissions-Policy `allow="payment"` replaces it
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
