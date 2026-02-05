import { useParams } from 'react-router-dom'

export default function EntityPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Entity: {id}</h1>
      <p className="text-gray-600">Entity details will be displayed here.</p>
    </div>
  )
}
