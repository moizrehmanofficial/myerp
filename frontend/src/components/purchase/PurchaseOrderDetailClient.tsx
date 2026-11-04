'use client'

import DocumentView from '@/components/documents/DocumentView'

export default function PurchaseOrderDetailClient({ id }: { id: string }) {
  return <DocumentView kind="purchase" id={id} />
}
