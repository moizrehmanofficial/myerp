'use client'

import { useCallback, useRef, useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}

// const [confirm, confirmDialog] = useConfirm()
// if (await confirm({ title: 'Delete customer?', danger: true })) { ... }
// Render {confirmDialog} once in the page.
export function useConfirm(): [(o: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(v: boolean) => void>(() => {})

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  function close(v: boolean) {
    resolver.current(v)
    setOpts(null)
  }

  const dialog = (
    <Modal
      open={!!opts}
      onClose={() => close(false)}
      title={opts?.title || ''}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant={opts?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
            {opts?.confirmLabel || 'Confirm'}
          </Button>
        </>
      }
    >
      {opts?.message && <p className="text-sm text-ink-2">{opts.message}</p>}
    </Modal>
  )

  return [confirm, dialog]
}
