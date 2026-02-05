import { useState } from 'react'
import { Search } from 'lucide-react'

export default function SearchPage() {
  const [query, setQuery] = useState('')

  return (
    <div className="space-y-8">
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          China Corporate Intelligence
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Search companies, individuals, and government entities.
          Trace ownership chains and identify sanctions exposure.
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entities (e.g., Huawei, SMIC, AVIC...)"
            className="w-full pl-12 pr-4 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Results will be rendered here */}
      <div className="text-center text-gray-500 py-8">
        Enter a search query to find entities
      </div>
    </div>
  )
}
