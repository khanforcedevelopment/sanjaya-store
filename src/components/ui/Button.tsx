import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'gold' | 'navy' | 'outline' | 'ghost' | 'danger' | 'light'
type Size = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 select-none whitespace-nowrap'
const variants: Record<Variant, string> = {
  gold: 'bg-gradient-to-b from-gold-300 via-gold-400 to-gold-500 text-navy-950 shadow-[0_6px_20px_-8px_rgba(194,154,59,0.9)] hover:brightness-105 active:brightness-95',
  navy: 'bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950',
  outline: 'border border-navy-900/15 bg-white text-navy-900 hover:border-gold-500 hover:text-gold-700',
  ghost: 'text-navy-800 hover:bg-navy-50',
  danger: 'bg-danger text-white hover:brightness-110',
  light: 'border border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20',
}
const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[15px]',
  lg: 'h-13 px-7 text-base',
}

export function buttonClass(variant: Variant = 'gold', size: Size = 'md', extra?: string) {
  return cn(base, variants[variant], sizes[size], extra)
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'gold', size = 'md', loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

export function ButtonLink({ variant = 'gold', size = 'md', className, ...rest }: LinkProps & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...rest} />
}
