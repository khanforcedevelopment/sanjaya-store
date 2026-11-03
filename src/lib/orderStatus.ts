import type { OrderStatus } from './types'

export const STATUS_LABEL: Record<OrderStatus, string> = {
  order_placed: 'Order placed',
  payment_pending: 'Payment pending',
  payment_confirmed: 'Payment confirmed',
  awaiting_approval: 'Awaiting approval',
  order_confirmed: 'Order confirmed',
  processing: 'Processing',
  packed: 'Packed',
  dispatched: 'Dispatched',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  delayed: 'Delayed',
  delivery_failed: 'Delivery attempt failed',
  cancelled: 'Cancelled',
  return_requested: 'Return requested',
  returned: 'Returned',
  refunded: 'Refunded',
}

export type Tone = 'gold' | 'navy' | 'green' | 'red' | 'grey' | 'amber'
export function statusTone(s: OrderStatus): Tone {
  if (s === 'delivered') return 'green'
  if (s === 'cancelled' || s === 'refunded' || s === 'delivery_failed') return 'red'
  if (s === 'delayed' || s === 'return_requested' || s === 'payment_pending' || s === 'awaiting_approval') return 'amber'
  if (s === 'returned') return 'grey'
  return 'navy'
}

/** The main path shown as a progress bar on the tracking page. */
export const TRACK_STEPS: OrderStatus[] = [
  'order_placed', 'payment_confirmed', 'order_confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered',
]

const RANK: Partial<Record<OrderStatus, number>> = {
  order_placed: 0, payment_pending: 0, payment_confirmed: 1, awaiting_approval: 1, order_confirmed: 2, processing: 2,
  packed: 3, dispatched: 4, in_transit: 4, delivery_failed: 5, out_for_delivery: 5, delivered: 6,
}
export function trackStepIndex(s: OrderStatus): number {
  return RANK[s] ?? -1
}

export const CLOSED_STATUSES: OrderStatus[] = ['delivered', 'cancelled', 'refunded', 'returned']
