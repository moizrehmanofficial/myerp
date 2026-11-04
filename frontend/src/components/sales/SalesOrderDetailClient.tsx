'use client'

import DocumentView from '@/components/documents/DocumentView'

export default function SalesOrderDetailClient({ id }: { id: string }) {
  return <DocumentView kind="sales" id={id} />
}
