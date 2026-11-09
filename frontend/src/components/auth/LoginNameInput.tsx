'use client'

// "name" + locked "@companyname": the owner types only the name part
export function LoginNameInput({
  id,
  value,
  onChange,
  company,
  disabled,
  invalid,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  company: string
  disabled?: boolean
  invalid?: boolean
}) {
  return (
    <div
      className={
        'flex h-9 w-full items-stretch overflow-hidden rounded-[var(--radius-control)] border bg-surface transition-colors ' +
        'focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/15 ' +
        (invalid ? 'border-bad' : 'border-line-strong hover:border-ink-3') +
        (disabled ? ' bg-subtle' : '')
      }
    >
      <input
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s/g, ''))}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoComplete="off"
        placeholder="name"
        aria-invalid={invalid}
        className="min-w-0 flex-1 bg-transparent px-3 text-base text-ink outline-none placeholder:text-ink-3 disabled:cursor-not-allowed disabled:text-ink-3 sm:text-sm"
      />
      <span className="flex shrink-0 items-center border-l border-line bg-subtle px-3 text-sm text-ink-2 select-none" title="Added for you, cannot be changed">
        @{company || 'company'}
      </span>
    </div>
  )
}
