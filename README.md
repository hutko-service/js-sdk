![hutko](https://hutko.org/wp-content/plugins/g-blocks/template-parts/svg/logos/logo.svg)
# JavaScript SDK

[![NPM Version](https://img.shields.io/npm/v/@hutko/js-sdk.svg)](https://www.npmjs.com/package/@hutko/js-sdk)
[![Downloads](https://img.shields.io/npm/dt/@hutko/js-sdk.svg)](https://www.npmjs.com/package/@hutko/js-sdk)
[![Licence](https://img.shields.io/github/license/hutkorg/js-sdk.svg)](https://github.com/hutkorg/js-sdk)

## Installation

### Node

If you’re using [Npm](https://npmjs.com/) in your project, you can add `@hutko/js-sdk` dependency to `package.json`
with following command:

```cmd
npm i --save @hutko/js-sdk
```

or add dependency manually:

```json
{
  "dependency": {
    "@hutko/js-sdk":"^2.0"
  }
}
```
### Manual installation

If you do not use NPM, you can download the
[latest release](https://github.com/hutkorg/js-sdk/releases).
Or clone from GitHub the latest developer version
```cmd
git clone git@github.com:hutkorg/js-sdk.git
```


## Quick start

```html
<script src="https://cdn.jsdelivr.net/npm/@hutko/js-sdk"></script>
```

## Basic template

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  </head>
  <body>
    <script src="https://cdn.jsdelivr.net/npm/@hutko/js-sdk"></script>
    <script>
    $checkout('Api').scope(function(){
        this.request('api.checkout.form','request', { Parameters } ).done(function(model){
            model.sendResponse();
            console.log(model.attr('order'));
        }).fail(function(model){
            console.log(model.attr('error'));
        });
    });
    </script>
  </body>
</html>
```

## PaymentButton template (ApplePay/GooglePay)

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  </head>
  <body>
    <script src="https://cdn.jsdelivr.net/npm/@hutko/js-sdk"></script>
    <div class="payment-button-container"></div>
    <script>
    $checkout.get('PaymentButton', {
      element: '.payment-button-container',
      style: {
        type: 'long', // short|long
        color: 'black', // black|white
        height: 38 // button height
      },
      data: { Parameters }
    }).on('success', function(model) {
      console.log('success', model);
    }).on('error', function(model) {
      console.log('error', model);
    });
    </script>
  </body>
</html>
```

### Apple Pay

| Browser | Apple Pay |
|---|---|
| Safari on macOS, any browser on iOS/iPadOS | native payment sheet |
| Chrome, Edge, Firefox on desktop | the customer scans a QR code and pays on iPhone (iOS 18 or later) |
| Browsers on Android | not available, the button is not shown |

- In Chrome, Edge and Firefox this SDK loads
  [Apple Pay JS SDK](https://developer.apple.com/documentation/applepayontheweb) (`https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js`)
  only when `methods` includes `apple` and Apple Pay is enabled for the merchant. If it can't be
  loaded (blocked by CSP or a content blocker), the Apple Pay button is not shown.
- Apple Pay works only on a domain registered for Apple Pay, the same as in Safari.
- The payment sheet must be opened by the customer's click. If you pass the `before` callback to
  `PaymentButton`, resolve it synchronously, otherwise the browser refuses to open Apple Pay:

```js
$checkout.get('PaymentButton', {
  // ...
  before: function (defer) {
    // synchronous checks only, e.g. form validation
    defer.resolve()
  },
})
```

- Apple Pay JS SDK assigns `window.onbeforeunload`. Use
  `window.addEventListener('beforeunload', ...)` for your own handlers.

## Content Security Policy

If your site sends a `Content-Security-Policy` header, allow the following sources.

| Directive | Source | Used for |
|---|---|---|
| `script-src` | `https://cdn.jsdelivr.net` | the SDK, if loaded from the CDN |
| `frame-src` | `https://pay.hutko.org` | payment gateway and payment button frames (or your `origin`) |
| `script-src`, `frame-src` | `https://applepay.cdn-apple.com` | Apple Pay in Chrome, Edge, Firefox: Apple Pay JS SDK and its QR code dialog |
| `script-src`, `frame-src`, `connect-src` | `https://pay.google.com` | Google Pay in Safari, Firefox and other browsers without Google Pay in the Payment Request API: Google Pay JS (`pay.js`) |
| `connect-src` | `https://google.com`, `https://www.google.com`, `https://pay.google.com` | Google Pay in Chrome: the payment method manifest of `https://google.com/pay` and its redirects |

Example:

```
Content-Security-Policy:
  script-src 'self' https://cdn.jsdelivr.net https://applepay.cdn-apple.com https://pay.google.com;
  frame-src https://pay.hutko.org https://applepay.cdn-apple.com https://pay.google.com;
  connect-src 'self' https://google.com https://www.google.com https://pay.google.com
```

If you add the payment button to your own `<iframe>`, allow payments in it: `<iframe allow="payment" ...>`.
A `Permissions-Policy` header of your page must not disable `payment`.

## Parameters

### Host-to-host token

```json
{
  "payment_system":"Supported payment systems: card, p24",
  "token":"host-to-host generated token",
  "card_number":"16/19-digits number",
  "expiry_date":"Supported formats: MM/YY, MM/YYYY, MMYY, MMYYYY",
  "cvv2":"3-digits number"
}
```

Where token is value, returned in payment gateway response from API endpoint /api/checkout/token 

request example:

```
curl -i -X POST \
   -H "Content-Type:application/json" \
   -d \
'{
  "request": {
    "server_callback_url": "http://myshop/callback/",
    "order_id": "TestOrder1",
    "currency": "USD",
    "merchant_id": 1396424,
    "order_desc": "Test payment",
    "amount": 1000
  }
}' \
 'https://pay.hutko.org/api/checkout/token'
```

response example:

```json
{
    "response": {
        "response_status": "success",
        "token": "7ddb3fbb03d60787b3972ef8d6fad0f97f7d2f86"
    }
}
```

### Client-side merchant ID

```json
{
  "payment_system":"Supported payment systems: card, p24",
  "merchant_id":"1396424",
  "currency":"USD",
  "amount":"100.20",
  "card_number":"16/19-digits number",
  "expiry_date":"Supported formats: MM/YY, MM/YYYY, MMYY, MMYYYY",
  "cvv2":"3-digits number"
}
```

optional merchant parameters:

```json
{
  "email":"customer email address",
  "phone":"customer phone number"
}
```

## License

License
Code released under [MIT LICENSE](https://github.com/hutkorg/js-sdk/blob/HEAD/LICENSE)

