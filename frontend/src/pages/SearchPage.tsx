import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, AlertTriangle, Shield, Building2, User, Landmark } from 'lucide-react'
import { clsx } from 'clsx'
import { searchEntities, type SearchResult } from '../services/api'

const riskLevelColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200',
}

const flagLabels: Record<string, string> = {
  entity_list: 'Entity List',
  meu_list: 'MEU List',
  ns_cmic: 'NS-CMIC',
  cmc_1260h: 'CMC 1260H',
  bis_50_captured: 'BIS 50%',
  xinjiang_uyghur: 'Xinjiang',
  military_civil_fusion: 'MCF',
  central_soe: 'Central SOE',
  defense_industrial_base: 'Defense',
  strategic_sector: 'Strategic',
  under_investigation: 'Under Investigation',
}

function getRiskLevel(result: SearchResult): string {
  const flags = result.risk_flags || []
  if (flags.includes('entity_list') || flags.includes('meu_list')) return 'critical'
  if (flags.includes('ns_cmic') || flags.includes('cmc_1260h') || flags.includes('bis_50_captured')) return 'high'
  if ((result.risk_score ?? 0) >= 70) return 'medium'
  return 'low'
}

function EntityTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'Company':
      return <Building2 className="w-5 h-5" />
    case 'Person':
      return <User className="w-5 h-5" />
    case 'GovernmentBody':
      return <Landmark className="w-5 h-5" />
    default:
      return <Building2 className="w-5 h-5" />
  }
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const riskLevel = getRiskLevel(result)
  const flags = result.risk_flags || []

  return (
    <Link
      to={`/entity/${result.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={clsx(
            'p-2 rounded-lg',
            riskLevel === 'critical' ? 'bg-red-100 text-red-600' :
            riskLevel === 'high' ? 'bg-orange-100 text-orange-600' :
            'bg-gray-100 text-gray-600'
          )}>
            <EntityTypeIcon type={result.type} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{result.name_en}</h3>
            {result.name_cn && (
              <p className="text-sm text-gray-500">{result.name_cn}</p>
            )}
            {result.jurisdiction && (
              <p className="text-xs text-gray-400 mt-1">{result.jurisdiction}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {result.risk_score !== undefined && (
            <div className={clsx(
              'px-2 py-1 rounded text-xs font-medium',
              riskLevelColors[riskLevel]
            )}>
              Risk: {result.risk_score}
            </div>
          )}
        </div>
      </div>

      {flags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {flags.slice(0, 5).map((flag) => (
            <span
              key={flag}
              className={clsx(
                'px-2 py-0.5 text-xs rounded-full',
                flag === 'entity_list' || flag === 'meu_list'
                  ? 'bg-red-100 text-red-700'
                  : flag === 'bis_50_captured'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-gray-100 text-gray-600'
              )}
            >
              {flagLabels[flag] || flag}
            </span>
          ))}
          {flags.length > 5 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">
              +{flags.length - 5} more
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: results, isLoading, error } = useQuery({
    queryKey: ['search', searchQuery],
    queryFn: () => searchEntities(searchQuery),
    enabled: searchQuery.length > 0,
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(query)
  }

  return (
    <div className="space-y-8">
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          China Corporate Intelligence
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Search companies, individuals, and government entities.
          Trace ownership chains and identify sanctions exposure.
        </p>
      </div>

      <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entities (e.g., Huawei, SMIC, AVIC...)"
            className="w-full pl-12 pr-24 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Quick filters */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => { setQuery('Huawei'); setSearchQuery('Huawei') }}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
        >
          Huawei
        </button>
        <button
          onClick={() => { setQuery('SMIC'); setSearchQuery('SMIC') }}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
        >
          SMIC
        </button>
        <button
          onClick={() => { setQuery('AVIC'); setSearchQuery('AVIC') }}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
        >
          AVIC
        </button>
        <button
          onClick={() => { setQuery('DeepSeek'); setSearchQuery('DeepSeek') }}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
        >
          DeepSeek
        </button>
        <button
          onClick={() => { setQuery('Hikvision'); setSearchQuery('Hikvision') }}
          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
        >
          Hikvision
        </button>
      </div>

      {/* Results */}
      <div className="max-w-3xl mx-auto">
        {isLoading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="mt-2 text-gray-500">Searching...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Search failed</p>
              <p className="text-sm text-red-600">
                {error instanceof Error ? error.message : 'Please try again'}
              </p>
            </div>
          </div>
        )}

        {results && results.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Found {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
            {results.map((result) => (
              <SearchResultCard key={result.id} result={result} />
            ))}
          </div>
        )}

        {results && results.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No entities found matching "{searchQuery}"</p>
            <p className="text-sm mt-1">Try a different search term</p>
          </div>
        )}

        {!searchQuery && (
          <div className="text-center text-gray-500 py-8">
            <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Enter a search query to find entities</p>
          </div>
        )}
      </div>
    </div>
  )
}
