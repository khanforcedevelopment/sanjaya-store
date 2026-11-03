import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { addItem, loadCart, saveCart, setQuantity, type CartItem } from './cartStore'

interface CartState {
  items: CartItem[]
  count: number
  add: (item: CartItem) => void
  setQty: (variantId: string, qty: number) => void
  remove: (variantId: string) => void
  clear: () => void
  coupon: string
  setCoupon: (code: string) => void
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
}

const CartContext = createContext<CartState | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCart())
  const [coupon, setCoupon] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => saveCart(items), [items])
  // keep tabs in sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === 'sanjaya.cart.v1') setItems(loadCart()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const add = useCallback((item: CartItem) => { setItems((c) => addItem(c, item)); setDrawerOpen(true) }, [])
  const setQty = useCallback((id: string, q: number) => setItems((c) => setQuantity(c, id, q)), [])
  const remove = useCallback((id: string) => setItems((c) => setQuantity(c, id, 0)), [])
  const clear = useCallback(() => { setItems([]); setCoupon('') }, [])

  const value = useMemo(() => ({
    items, count: items.reduce((n, i) => n + i.quantity, 0), add, setQty, remove, clear,
    coupon, setCoupon, drawerOpen, setDrawerOpen,
  }), [items, add, setQty, remove, clear, coupon, drawerOpen])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartState {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
