import { Component } from './core/component.js'

import * as Utils from './core/utils.js'
import * as Config from './core/config.js'

import { Api } from './core/api.js'
import { Module } from './core/module.js'
import { Connector } from './core/connector.js'
import { Response } from './core/response.js'
import { PaymentButton } from './core/payment/button.js'
import { PaymentRequestApi } from './core/payment/request.js'
import { PaymentElement } from './core/payment/element.js'
import { PaymentContainer } from './core/payment/container.js'
import { WidgetForm } from './core/widget/form.js'
import { WidgetButton } from './core/widget/button.js'
import { Modal } from './core/modal.js'

Component.add('Api', Api)
Component.add('Connector', Connector)
Component.add('PaymentButton', PaymentButton)
Component.add('PaymentRequestApi', PaymentRequestApi)
Component.add('PaymentElement', PaymentElement)
Component.add('FormWidget', WidgetForm)
Component.add('ButtonWidget', WidgetButton)

Component.Utils = Utils
Component.Config = Config
Component.Api = Api
Component.Module = Module
Component.Modal = Modal
Component.Connector = Connector
Component.Response = Response
Component.PaymentRequestApi = PaymentRequestApi
Component.PaymentContainer = PaymentContainer
Component.PaymentElement = PaymentElement
Component.PaymentButton = PaymentButton

export {
  Utils,
  Config,
  Api,
  Module,
  Connector,
  Response,
  PaymentRequestApi,
  PaymentContainer,
  PaymentElement,
  PaymentButton,
}

export default Component
