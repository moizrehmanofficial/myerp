'use client'

import DocumentView from '@/components/documents/DocumentView'

export default function InvoiceDetailClient({ id }: { id: string }) {
  return <DocumentView kind="invoice" id={id} />
}
