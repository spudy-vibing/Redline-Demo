import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Search, AlertTriangle, Building2, User, Landmark,
  ChevronRight, Crosshair, Database, Globe, ArrowRight
} from 'lucide-react'
import { clsx } from 'clsx'
import { searchEntities, type SearchResult } from '../services/api'

const flagLabels: Record<string, string> = {
  entity_list: 'Entity List',
  meu_list: 'MEU',
  ns_cmic: 'NS-CMIC',
  cmc_1260h: 'CMC-1260H',
  bis_50_captured: 'BIS 50%',
  xinjiang_uyghur: 'Xinjiang',
  military_civil_fusion: 'MCF',
  central_soe: 'Central SOE',
  defense_industrial_base: 'Defense',
  strategic_sector: 'Strategic',
  under_investigation: 'Investigation',
}

function getRiskLevel(result: SearchResult): string {
  const flags = result.risk_flags || []
  if (flags.includes('entity_list') || flags.includes('meu_list')) return 'critical'
  if (flags.includes('ns_cmic') || flags.includes('cmc_1260h') || flags.includes('bis_50_captured')) return 'high'
  if ((result.risk_score ?? 0) >= 70) return 'medium'
  return 'low'
}

function EntityTypeIcon({ type }: { type: string }) {
  const iconClass = 'w-4 h-4'
  switch (type) {
    case 'Company':
      return <Building2 className={iconClass} />
    case 'Person':
      return <User className={iconClass} />
    case 'GovernmentBody':
      return <Landmark className={iconClass} />
    default:
      return <Building2 className={iconClass} />
  }
}

function RiskIndicator({ level, score }: { level: string; score?: number }) {
  const config: Record<string, { color: string; bg: string; border: string; label: string; dot: string }> = {
    critical: { color: 'text-redline-400', bg: 'bg-redline-500/10', border: 'border-redline-500/30', label: 'CRITICAL', dot: 'bg-redline-500' },
    high: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'HIGH', dot: 'bg-orange-500' },
    medium: { color: 'text-gold-400', bg: 'bg-gold-500/10', border: 'border-gold-500/30', label: 'MEDIUM', dot: 'bg-gold-500' },
    low: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'LOW', dot: 'bg-emerald-500' },
  }

  const { color, bg, border, label, dot } = config[level] || config.low

  return (
    <div className={clsx('flex items-center gap-2 px-2.5 py-1 rounded border', bg, border)}>
      <div className={clsx('w-1.5 h-1.5 rounded-full', dot, level === 'critical' && 'animate-pulse')} />
      <span className={clsx('text-xs font-mono font-medium', color)}>{label}</span>
      {score !== undefined && (
        <span className="text-xs font-mono text-neutral-500">{score}</span>
      )}
    </div>
  )
}

function SearchResultCard({ result, index }: { result: SearchResult; index: number }) {
  const riskLevel = getRiskLevel(result)
  const flags = result.risk_flags || []

  return (
    <Link
      to={`/entity/${result.id}`}
      className={clsx(
        'block bg-neutral-900/60 backdrop-blur-sm rounded-lg border p-4',
        'hover:bg-neutral-800/60 transition-all duration-300 group',
        'animate-slide-up',
        riskLevel === 'critical' ? 'border-redline-500/30 hover:border-redline-500/50 hover:shadow-redline' :
        riskLevel === 'high' ? 'border-orange-500/20 hover:border-orange-500/40' :
        'border-neutral-800 hover:border-neutral-700'
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {/* Entity type icon */}
          <div className={clsx(
            'p-2.5 rounded-lg flex-shrink-0 border',
            riskLevel === 'critical' ? 'bg-redline-500/10 text-redline-400 border-redline-500/20' :
            riskLevel === 'high' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
            'bg-neutral-800/50 text-neutral-400 border-neutral-700/50'
          )}>
            <EntityTypeIcon type={result.type} />
          </div>

          {/* Entity info */}
          <div className="min-w-0">
            <h3 className="font-semibold text-neutral-100 group-hover:text-redline-400 transition-colors truncate">
              {result.name_en}
            </h3>
            {result.name_cn && (
              <p className="text-sm text-neutral-500 font-mono truncate">{result.name_cn}</p>
            )}
            {result.jurisdiction && (
              <p className="text-xs text-neutral-600 mt-1.5 flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {result.jurisdiction}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <RiskIndicator level={riskLevel} score={result.risk_score} />
          <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-redline-400 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      {/* Risk flags */}
      {flags.length > 0 && (
        <div className="mt-3 pt-3 border-t border-neutral-800/50 flex flex-wrap gap-1.5">
          {flags.slice(0, 5).map((flag) => (
            <span
              key={flag}
              className={clsx(
                'px-2 py-0.5 text-[10px] font-mono uppercase rounded tracking-wide',
                flag === 'entity_list' || flag === 'meu_list'
                  ? 'bg-redline-500/10 text-redline-400 border border-redline-500/20'
                  : flag === 'bis_50_captured'
                  ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                  : 'bg-neutral-800/50 text-neutral-400 border border-neutral-700/30'
              )}
            >
              {flagLabels[flag] || flag}
            </span>
          ))}
          {flags.length > 5 && (
            <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-neutral-800/50 text-neutral-500">
              +{flags.length - 5}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

const quickFilters = [
  { label: 'Huawei', query: 'Huawei' },
  { label: 'SMIC', query: 'SMIC' },
  { label: 'AVIC', query: 'AVIC' },
  { label: 'DeepSeek', query: 'DeepSeek' },
  { label: 'Hikvision', query: 'Hikvision' },
]

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
      {/* Hero Section */}
      <div className="text-center py-16 relative">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-redline-500/5 via-transparent to-transparent pointer-events-none" />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 mb-8">
          <Crosshair className="w-3.5 h-3.5 text-redline-500" />
          <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">China Corporate Intelligence</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-bold text-neutral-100 mb-4 tracking-tight">
          Cross the
          <span className="text-gradient"> Redline</span>
        </h1>

        <p className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-2">
          Entity screening, ownership tracing, and sanctions analysis.
        </p>
        <p className="text-sm text-neutral-500 max-w-xl mx-auto">
          Track companies, individuals, and government bodies across CSL, OFAC SDN, and more.
        </p>

        {/* Stats */}
        <div className="flex items-center justify-center gap-8 mt-10">
          <div className="text-center group">
            <div className="text-3xl font-bold text-redline-400 group-hover:scale-110 transition-transform">21</div>
            <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mt-1">Entities</div>
          </div>
          <div className="h-10 w-px bg-gradient-to-b from-transparent via-neutral-700 to-transparent" />
          <div className="text-center group">
            <div className="text-3xl font-bold text-gold-400 group-hover:scale-110 transition-transform">13+</div>
            <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mt-1">Lists</div>
          </div>
          <div className="h-10 w-px bg-gradient-to-b from-transparent via-neutral-700 to-transparent" />
          <div className="text-center group">
            <div className="text-3xl font-bold text-emerald-400 group-hover:scale-110 transition-transform">31</div>
            <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mt-1">Relations</div>
          </div>
        </div>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
        <div className="relative group">
          {/* Glow effect on focus */}
          <div className="absolute -inset-1 bg-gradient-to-r from-redline-500/20 via-redline-500/10 to-redline-500/20 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />

          <div className="relative flex items-center bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden focus-within:border-redline-500/50 transition-colors">
            <Search className="w-5 h-5 text-neutral-500 ml-4 flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entities..."
              className="flex-1 px-4 py-4 bg-transparent text-neutral-100 placeholder-neutral-500 outline-none text-lg"
            />
            <button
              type="submit"
              className="m-2 px-5 py-2.5 bg-redline-600 hover:bg-redline-500 text-white font-medium rounded-lg transition-all duration-200 flex items-center gap-2 shadow-lg shadow-redline-500/20 hover:shadow-redline-500/30"
            >
              <span className="hidden sm:inline">Search</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </form>

      {/* Quick Filters */}
      <div className="flex justify-center gap-2 flex-wrap">
        {quickFilters.map(({ label, query: q }) => (
          <button
            key={label}
            onClick={() => { setQuery(q); setSearchQuery(q) }}
            className="px-3 py-1.5 text-sm font-mono bg-neutral-900 text-neutral-400 rounded-lg border border-neutral-800 hover:border-redline-500/30 hover:text-redline-400 hover:bg-neutral-800/50 transition-all"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="max-w-3xl mx-auto">
        {/* Loading */}
        {isLoading && (
          <div className="text-center py-16">
            <div className="inline-flex items-center gap-3 px-5 py-3 bg-neutral-900 rounded-lg border border-neutral-800">
              <div className="w-5 h-5 border-2 border-redline-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-neutral-400 font-mono">Scanning database...</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-redline-500/10 border border-redline-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-redline-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-redline-400">Search failed</p>
              <p className="text-sm text-redline-400/70">
                {error instanceof Error ? error.message : 'Please try again'}
              </p>
            </div>
          </div>
        )}

        {/* Results list */}
        {results && results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-1 h-5 bg-redline-500 rounded-full" />
                <p className="text-sm font-mono text-neutral-400">
                  <span className="text-redline-400 font-semibold">{results.length}</span> result{results.length !== 1 ? 's' : ''} found
                </p>
              </div>
            </div>
            {results.map((result, index) => (
              <SearchResultCard key={result.id} result={result} index={index} />
            ))}
          </div>
        )}

        {/* No results */}
        {results && results.length === 0 && (
          <div className="text-center py-16">
            <Database className="w-12 h-12 mx-auto mb-4 text-neutral-700" />
            <p className="text-neutral-400">No entities found matching "{searchQuery}"</p>
            <p className="text-sm text-neutral-600 mt-2">Try a different search term</p>
          </div>
        )}

        {/* Empty state */}
        {!searchQuery && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center">
              <Crosshair className="w-8 h-8 text-neutral-600" />
            </div>
            <p className="text-neutral-400 mb-2">Enter a search query to find entities</p>
            <p className="text-sm text-neutral-600">Or click a quick filter above to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}
