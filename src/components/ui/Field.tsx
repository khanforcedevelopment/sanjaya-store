import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface FieldShellProps { label: string; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode; className?: string }

export function FieldShell({ label, hint, error, children, className }: FieldShellProps) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      {children(id)}
      {error ? <p className="mt-1 text-sm text-danger" role="alert">{error}</p> : hint ? <p className="mt-1 text-xs text-navy-600/70">{hint}</p> : null}
    </div>
  )
}

type InputFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string | null }
export function InputField({ label, hint, error, className, ...rest }: InputFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className}>
      {(id) => <input id={id} className={cn('input', error && 'border-danger')} aria-invalid={!!error} {...rest} />}
    </FieldShell>
  )
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: ReactNode; error?: string | null }
export function SelectField({ label, hint, error, className, children, ...rest }: SelectFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className}>
      {(id) => <select id={id} className={cn('input', error && 'border-danger')} {...rest}>{children}</select>}
    </FieldShell>
  )
}

type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode; error?: string | null }
export function TextareaField({ label, hint, error, className, ...rest }: TextareaFieldProps) {
  return (
    <FieldShell label={label} hint={hint} error={error} className={className}>
      {(id) => <textarea id={id} className={cn('input min-h-24', error && 'border-danger')} {...rest} />}
    </FieldShell>
  )
}
