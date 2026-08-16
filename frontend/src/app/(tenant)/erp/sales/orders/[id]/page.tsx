import { use } from 'react'
import SalesOrderDetailClient from '@/components/sales/SalesOrderDetailClient'

type Props = { params: Promise<{ id: string }> }

export default function SalesOrderPage({ params }: Props) {
  const { id } = use(params)
  return <SalesOrderDetailClient id={id} />
}