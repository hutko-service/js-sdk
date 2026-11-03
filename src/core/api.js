import { Deferred } from './deferred.js'
import { Module } from './module.js'
import { Connector } from './connector.js'
import { Modal } from './modal.js'
import { Response } from './response.js'
import { ApiFrameCss, ApiOrigin, ApiEndpoint } from './config.js'

export const Api = Module.extend({
  defaults: {
    origin: ApiOrigin,
    endpoint: ApiEndpoint,
    container: 'body',
    messages: {
      modalHeader:
        'Now you will be redirected to your bank 3DSecure. If you are not redirected please refer',
      modalLinkLabel: 'link',
    },
  },
  init(params) {
    this.initParams(params)
  },
  url(type, url) {
    return [this.params.origin, this.params.endpoint[type] || '/', url || ''].join('')
  },
  extendParams(params) {
    this.utils.extend(this.params, params)
    return this
  },
  initParams(params) {
    this.params = this.utils.extend({}, this.defaults)
    this.extendParams(params)
    this.setOrigin(this.params.origin)
    this.loaded = false
    this.created = false
  },
  setOrigin(origin) {
    if (this.utils.isString(origin)) {
      this.params.origin = origin
    }
    return this
  },
  scope(callback) {
    callback = this.proxy(callback)
    this.domReady(function () {
      if (this.createFrame().loaded === true) {
        callback()
      } else {
        this.on('checkout.api', callback)
      }
    })
  },
  domReady(callback) {
    callback = this.proxy(callback)
    document.readyState !== 'loading'
      ? callback()
      : window.addEventListener('DOMContentLoaded', callback)
  },
  request(model, method, params) {
    const defer = Deferred()
    const data = {
      uid: this.connector.getUID(),
      action: model,
      method: method,
      params: params || {},
    }
    this.connector.send('request', data)
    this.connector.on(
      data.uid,
      this.proxy(function (ev, response, model, action) {
        const responseModel = new Response(response)
        responseModel.setUID(data.uid)
        responseModel.setConnector(this.connector)
        action = 'resolveWith'
        if (responseModel.attr('submit3ds')) {
          action = 'notifyWith'
        }
        if (responseModel.attr('error')) {
          action = 'rejectWith'
        }
        defer[action](this, [responseModel])
      })
    )
    return defer
  },

  loadFrame(url) {
    this.iframe = this.utils.createElement('iframe')
    this.addAttr(this.iframe, {
      allowtransparency: true,
      frameborder: 0,
      scrolling: 'no',
      // Permissions-Policy so the gateway iframe may invoke Payment Request /
      // Apple Pay / Google Pay when the wallet flow runs inside it.
      allow: 'payment',
    })
    this.addAttr(this.iframe, { src: url })
    this.addCss(this.iframe, ApiFrameCss)
    this.container = this.utils.querySelector(this.params.container)
    if (this.container) {
      if (this.container.firstChild) {
        this.container.insertBefore(this.iframe, this.container.firstChild)
      } else {
        this.container.appendChild(this.iframe)
      }
    } else {
      throw Error(`container element not found: querySelector("${this.params.container}")`)
    }
    return this.iframe
  },
  createFrame() {
    if (this.created === false) {
      this.created = true
      this.iframe = this.loadFrame(this.url('gateway'))
      this.connector = new Connector({
        target: this.iframe.contentWindow,
        origin: this.params.origin,
      })
      this.connector.on('load', this.proxy('onLoadConnector'))
      this.connector.on('modal', this.proxy('onOpenModal'))
    }
    return this
  },
  onOpenModal(xhr, model) {
    this.modal = new Modal({
      checkout: this,
      model: model,
    })
    this.modal.on('close', this.proxy('onCloseModal'))
  },
  onCloseModal(modal, data) {
    this.trigger('modal.close', modal, data)
  },
  onLoadConnector() {
    this.loaded = true
    this.connector.off('load')
    this.trigger('checkout.api')
    this.off('checkout.api')
  },
})
