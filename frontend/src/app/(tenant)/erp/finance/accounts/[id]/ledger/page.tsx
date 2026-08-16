import { use } from 'react'
import AccountLedgerClient from '@/components/finance/AccountLedgerClient'

type Props = { params: Promise<{ id: string }> }

export default function LedgerPage({ params }: Props) {
  const { id } = use(params)
  return <AccountLedgerClient id={id} />
}