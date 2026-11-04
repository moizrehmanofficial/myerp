'use client'

import DocumentEditor from '@/components/documents/DocumentEditor'

export default function InvoiceEditClient({ id }: { id: string }) {
  return <DocumentEditor kind="invoice" editId={id} />
}
