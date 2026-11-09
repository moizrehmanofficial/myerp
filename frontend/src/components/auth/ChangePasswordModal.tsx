'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Button, Field, Input, Modal } from '@/components/ui'
import { tenantApi, apiError } from '@/lib/tenantApi'

export default function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ current: '', next: '', again: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function close() {
    setF({ current: '', next: '', again: '' })
    setError('')
    onClose()
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (!f.current) return setError('Enter your current password.')
    if (f.next.length < 8) return setError('The new password must be at least 8 characters.')
    if (f.next !== f.again) return setError('The two new passwords are not the same.')
    setError('')
    setSaving(true)
    try {
      await tenantApi.post('/tenant-auth/change-password', { currentPassword: f.current, newPassword: f.next })
      toast.success('Password changed')
      close()
    } catch (err) {
      setError(apiError(err, 'Could not change the password.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title="Change password"
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button onClick={() => save()} loading={saving}>Change password</Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="Current password">
          {(id) => <Input id={id} type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} autoFocus />}
        </Field>
        <Field label="New password" hint="At least 8 characters">
          {(id) => <Input id={id} type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />}
        </Field>
        <Field label="New password again">
          {(id) => <Input id={id} type="password" autoComplete="new-password" value={f.again} onChange={(e) => setF({ ...f, again: e.target.value })} />}
        </Field>
        {error && <p className="rounded-[var(--radius-control)] bg-bad-soft px-3 py-2 text-[13px] text-bad">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
