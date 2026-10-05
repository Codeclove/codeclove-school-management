/**
 * Payment Gateways API client functions and hooks.
 */
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

export interface GatewayClientConfig {
  id: string
  name: string
  enabled: boolean
  test_mode: boolean
  publishable_key?: string
  client_id?: string
}

export interface GatewaysConfigResponse {
  gateways: Record<string, GatewayClientConfig>
}

export interface CheckoutSessionParams {
  invoice_id: number
  gateway?: string
  amount_minor?: number
  customer_email?: string
  success_url?: string
  cancel_url?: string
}

export interface CheckoutSessionResponse {
  gateway: string
  session_id: string
  url: string
  publishable_key?: string
  client_id?: string
  amount_minor: number
  currency: string
  invoice_id: number
  invoice_number: string
}

/**
 * Retrieves public configurations for active gateways.
 */
export function useGatewaysConfig() {
  return useQuery<GatewaysConfigResponse, Error>({
    queryKey: ['gateways-config'],
    queryFn: async () => {
      const res = await api.get<GatewaysConfigResponse>('finance/gateways/config')
      return res.data
    },
    staleTime: 60000,
  })
}

/**
 * Hook to initialize a payment checkout session.
 */
export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: async (params: CheckoutSessionParams): Promise<CheckoutSessionResponse> => {
      const res = await api.post<CheckoutSessionResponse>('finance/gateways/checkout-session', params)
      return res.data
    },
  })
}

export interface PayPalCaptureParams {
  order_id: string
  invoice_id?: number
}

export interface PayPalCaptureResponse {
  success: boolean
  payment?: Record<string, unknown>
  transaction_id: string
  order_id: string
  message?: string
}

/**
 * Hook to capture an authorized PayPal order after approval redirect.
 */
export function useCapturePayPalOrder() {
  return useMutation({
    mutationFn: async (params: PayPalCaptureParams): Promise<PayPalCaptureResponse> => {
      const res = await api.post<PayPalCaptureResponse>('finance/gateways/paypal/capture', params)
      return res.data
    },
  })
}
