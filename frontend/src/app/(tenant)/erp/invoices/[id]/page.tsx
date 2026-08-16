import InvoiceDetailClient from '@/components/invoices/InvoiceDetailClient'
import { use } from 'react'

type Props = { params: Promise<{ id: string }> }

export default function InvoicePage({ params }: Props) {
  const { id } = use(params)
  return <InvoiceDetailClient id={id} />
}