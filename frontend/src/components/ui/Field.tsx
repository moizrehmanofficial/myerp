'use client'

import { forwardRef, useId } from 'react'
import { cn } from '@/utils/utils'

const control =
  'w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-sm text-ink ' +
  'placeholder:text-ink-3 transition-colors hover:border-ink-3 ' +
  'focus:border-brand focus:outline-none focus-visible:outline-none focus:ring-3 focus:ring-brand/15 ' +
  'disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-3'

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(control, 'h-9', className)} {...props} />
  },
)

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(control, 'h-9 pr-8', className)} {...props}>
        {children}
      </select>
    )
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(control, 'min-h-20 py-2', className)} {...props} />
  },
)

// Label + control + hint/error, with the label linked to the control
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: (id: string) => React.ReactNode
}) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink-2">
        {label}
        {required && <span className="ml-0.5 text-bad">*</span>}
      </label>
      {children(id)}
      {error ? (
        <p className="text-xs text-bad">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  )
}
