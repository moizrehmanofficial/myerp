import InvoiceEditClient from '@/components/invoices/InvoiceEditClient'
import { use } from 'react'

type Props = { params: Promise<{ id: string }> }

export default function EditInvoicePage({ params }: Props) {
  const { id } = use(params)
  return <InvoiceEditClient id={id} />
}