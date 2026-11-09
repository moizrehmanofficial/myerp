'use client'

import DocumentEditor from '@/components/documents/DocumentEditor'
import DocumentView from '@/components/documents/DocumentView'

export function QuotationDetailClient({ id }: { id: string }) {
  return <DocumentView kind="quotation" id={id} />
}

export function QuotationEditClient({ id }: { id: string }) {
  return <DocumentEditor kind="quotation" editId={id} />
}
