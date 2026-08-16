import { use } from 'react'
import ManufacturingDetailClient from '@/components/manufacturing/ManufacturingDetailClient'

type Props = { params: Promise<{ id: string }> }

export default function ManufacturingOrderPage({ params }: Props) {
  const { id } = use(params)
  return <ManufacturingDetailClient id={id} />
}