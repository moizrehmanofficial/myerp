import { QuotationDetailClient } from '@/components/quotations/QuotationClients'
import { use } from 'react'

type Props = { params: Promise<{ id: string }> }

export default function QuotationPage({ params }: Props) {
  const { id } = use(params)
  return <QuotationDetailClient id={id} />
}
