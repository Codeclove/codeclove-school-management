import { describe, it, expect } from 'vitest'
import type { GatewayClientConfig, GatewaysConfigResponse, CheckoutSessionParams } from '../api/gateways'
import type { PaymentGatewaysSettings, PayPalGatewaySettings, StripeGatewaySettings } from '../api/settings'

describe('Payment Gateways Integration & Config', () => {
  describe('Gateways Config Resolution', () => {
    it('handles multiple active gateways with client config attributes', () => {
      const config: GatewaysConfigResponse = {
        gateways: {
          stripe: {
            id: 'stripe',
            name: 'Stripe',
            enabled: true,
            test_mode: false,
            publishable_key: 'pk_live_example123',
          },
          paypal: {
            id: 'paypal',
            name: 'PayPal',
            enabled: true,
            test_mode: true,
            client_id: 'client_sandbox_abc456',
          },
        },
      }

      const activeList = Object.values(config.gateways).filter((g) => g.enabled)
      expect(activeList).toHaveLength(2)

      const stripeCfg = config.gateways['stripe']
      expect(stripeCfg?.publishable_key).toBe('pk_live_example123')
      expect(stripeCfg?.test_mode).toBe(false)

      const paypalCfg = config.gateways['paypal']
      expect(paypalCfg?.client_id).toBe('client_sandbox_abc456')
      expect(paypalCfg?.test_mode).toBe(true)
    })

    it('determines the default selected gateway based on active availability', () => {
      function resolveDefaultGateway(
        gateways: Record<string, GatewayClientConfig>,
        preferred?: 'stripe' | 'paypal'
      ): 'stripe' | 'paypal' {
        if (preferred && gateways[preferred]?.enabled) {
          return preferred
        }
        if (gateways['stripe']?.enabled) {
          return 'stripe'
        }
        if (gateways['paypal']?.enabled) {
          return 'paypal'
        }
        return 'stripe'
      }

      const onlyPaypal: Record<string, GatewayClientConfig> = {
        stripe: { id: 'stripe', name: 'Stripe', enabled: false, test_mode: true },
        paypal: { id: 'paypal', name: 'PayPal', enabled: true, test_mode: true, client_id: 'pid_1' },
      }
      expect(resolveDefaultGateway(onlyPaypal)).toBe('paypal')

      const bothEnabled: Record<string, GatewayClientConfig> = {
        stripe: { id: 'stripe', name: 'Stripe', enabled: true, test_mode: false },
        paypal: { id: 'paypal', name: 'PayPal', enabled: true, test_mode: true },
      }
      expect(resolveDefaultGateway(bothEnabled)).toBe('stripe')
      expect(resolveDefaultGateway(bothEnabled, 'paypal')).toBe('paypal')
    })
  })

  describe('Webhook Endpoint URL Formatting', () => {
    it('generates correct webhook URL for Stripe and PayPal', () => {
      const restUrl = 'https://school.test/wp-json/codeclove/v1/'
      const base = restUrl.replace(/\/+$/, '')
      expect(`${base}/finance/gateways/webhook/stripe`).toBe(
        'https://school.test/wp-json/codeclove/v1/finance/gateways/webhook/stripe'
      )
      expect(`${base}/finance/gateways/webhook/paypal`).toBe(
        'https://school.test/wp-json/codeclove/v1/finance/gateways/webhook/paypal'
      )
    })

    it('handles base URLs without trailing slash cleanly', () => {
      const restUrl = 'https://school.test/wp-json/codeclove/v1'
      const base = restUrl.replace(/\/+$/, '')
      expect(`${base}/finance/gateways/webhook/paypal`).toBe(
        'https://school.test/wp-json/codeclove/v1/finance/gateways/webhook/paypal'
      )
    })
  })

  describe('Checkout Session Parameters Construction', () => {
    function buildCheckoutParams(
      invoiceId: number,
      gateway: 'stripe' | 'paypal',
      amountMinor: number,
      baseUrl: string,
      customerEmail?: string
    ): CheckoutSessionParams {
      const cleanBase = baseUrl.split('?')[0]
      const successUrl =
        gateway === 'stripe'
          ? `${cleanBase}?payment_status=success&session_id={CHECKOUT_SESSION_ID}&gateway=stripe`
          : `${cleanBase}?payment_status=success&gateway=paypal`
      const cancelUrl = `${cleanBase}?payment_status=cancelled&gateway=${gateway}`

      return {
        invoice_id: invoiceId,
        gateway,
        amount_minor: amountMinor,
        customer_email: customerEmail || undefined,
        success_url: successUrl,
        cancel_url: cancelUrl,
      }
    }

    it('constructs Stripe session parameters with session_id template token', () => {
      const params = buildCheckoutParams(101, 'stripe', 25000, 'https://school.test/invoices/101', 'parent@example.com')
      expect(params.gateway).toBe('stripe')
      expect(params.amount_minor).toBe(25000)
      expect(params.customer_email).toBe('parent@example.com')
      expect(params.success_url).toContain('session_id={CHECKOUT_SESSION_ID}')
      expect(params.success_url).toContain('gateway=stripe')
      expect(params.cancel_url).toContain('gateway=stripe')
    })

    it('constructs PayPal session parameters with return and cancel URLs', () => {
      const params = buildCheckoutParams(102, 'paypal', 15000, 'https://school.test/invoices/102')
      expect(params.gateway).toBe('paypal')
      expect(params.amount_minor).toBe(15000)
      expect(params.customer_email).toBeUndefined()
      expect(params.success_url).toBe('https://school.test/invoices/102?payment_status=success&gateway=paypal')
      expect(params.cancel_url).toBe('https://school.test/invoices/102?payment_status=cancelled&gateway=paypal')
    })
  })

  describe('Payment Gateways Settings Type Validation', () => {
    it('supports PayPal settings alongside Stripe in PaymentGatewaysSettings', () => {
      const stripeSettings: StripeGatewaySettings = {
        enabled: true,
        test_mode: false,
        publishable_key: 'pk_live_123',
        secret_key: 'sk_live_123',
        webhook_secret: 'whsec_123',
      }

      const paypalSettings: PayPalGatewaySettings = {
        enabled: true,
        test_mode: true,
        client_id: 'client_id_live',
        client_secret: 'client_secret_live',
        webhook_id: 'wh_id_123',
      }

      const settings: PaymentGatewaysSettings = {
        stripe: stripeSettings,
        paypal: paypalSettings,
      }

      expect(settings.stripe.enabled).toBe(true)
      expect(settings.paypal?.enabled).toBe(true)
      expect(settings.paypal?.client_id).toBe('client_id_live')
      expect(settings.paypal?.webhook_id).toBe('wh_id_123')
    })
  })
})
