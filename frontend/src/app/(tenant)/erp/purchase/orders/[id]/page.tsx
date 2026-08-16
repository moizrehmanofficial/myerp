import { use } from 'react'
import PurchaseOrderDetailClient from '@/components/purchase/PurchaseOrderDetailClient'

type Props = { params: Promise<{ id: string }> }

export default function PurchaseOrderPage({ params }: Props) {
  const { id } = use(params)
  return <PurchaseOrderDetailClient id={id} />
}