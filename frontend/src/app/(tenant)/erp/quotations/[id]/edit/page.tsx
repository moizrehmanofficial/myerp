import { QuotationEditClient } from '@/components/quotations/QuotationClients'
import { use } from 'react'

type Props = { params: Promise<{ id: string }> }

export default function EditQuotationPage({ params }: Props) {
  const { id } = use(params)
  return <QuotationEditClient id={id} />
}
