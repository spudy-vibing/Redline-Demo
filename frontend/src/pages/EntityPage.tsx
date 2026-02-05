import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Building2, User, Landmark,
  Calendar, MapPin, Hash, ArrowLeft,
  ChevronRight, AlertCircle, CheckCircle, Clock,
  Shield, Network, FileWarning, Activity, FileText, BookOpen, Sparkles
} from 'lucide-react'
import { clsx } from 'clsx'
import { getEntity, getEntityNetwork, getBIS50Analysis, getEntityTimeline, getRiskNarrative, type Entity, type NetworkGraph as NetworkGraphData, type BIS50Analysis, type TimelineAnalysis, type RiskNarrative } from '../services/api'
import NetworkGraph from '../components/NetworkGraph'

const flagLabels: Record<string, { label: string; description: string }> = {
  entity_list: { label: 'BIS Entity List', description: 'US export restrictions apply' },
  meu_list: { label: 'Military End User', description: 'Military end-use restrictions' },
  ns_cmic: { label: 'NS-CMIC', description: 'Non-SDN Chinese Military-Industrial Complex' },
  cmc_1260h: { label: 'CMC 1260H', description: 'Chinese Military Company' },
  bis_50_captured: { label: 'BIS 50% Captured', description: 'Captured via ownership by listed party' },
  xinjiang_uyghur: { label: 'Xinjiang/Uyghur', description: 'Linked to Xinjiang surveillance/forced labor' },
  military_civil_fusion: { label: 'Military-Civil Fusion', description: 'PLA/defense contractor ties' },
  central_soe: { label: 'Central SOE', description: 'State-owned enterprise under SASAC' },
  defense_industrial_base: { label: 'Defense Industrial Base', description: 'Defense manufacturing/R&D' },
  strategic_sector: { label: 'Strategic Sector', description: 'Critical technology sector' },
  under_investigation: { label: 'Under Investigation', description: 'Subject to ongoing investigation' },
  human_rights_abuse: { label: 'Human Rights', description: 'Human rights abuse concerns' },
  pla_background: { label: 'PLA Background', description: 'Former PLA personnel' },
}

function RiskBadge({ score }: { score?: number }) {
  if (score === undefined) return null

  let color = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
  let label = 'LOW RISK'

  if (score >= 90) {
    color = 'bg-redline-500/10 text-redline-400 border-redline-500/30'
    label = 'CRITICAL'
  } else if (score >= 70) {
    color = 'bg-orange-500/10 text-orange-400 border-orange-500/30'
    label = 'HIGH RISK'
  } else if (score >= 50) {
    color = 'bg-gold-500/10 text-gold-400 border-gold-500/30'
    label = 'MEDIUM'
  }

  return (
    <div className={clsx('px-3 py-1.5 rounded-lg text-sm font-mono font-medium border flex items-center gap-2', color)}>
      <Activity className="w-4 h-4" />
      {label}
      <span className="text-neutral-500">({score})</span>
    </div>
  )
}

function EntityTypeIcon({ type, large }: { type: string; large?: boolean }) {
  const size = large ? 'w-6 h-6' : 'w-5 h-5'
  switch (type) {
    case 'Company':
      return <Building2 className={size} />
    case 'Person':
      return <User className={size} />
    case 'GovernmentBody':
      return <Landmark className={size} />
    default:
      return <Building2 className={size} />
  }
}

function SectionCard({ title, icon: Icon, children, variant = 'default' }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  variant?: 'default' | 'danger' | 'warning' | 'success'
}) {
  const variants = {
    default: 'bg-neutral-900/60 border-neutral-800',
    danger: 'bg-redline-500/5 border-redline-500/30',
    warning: 'bg-orange-500/5 border-orange-500/30',
    success: 'bg-emerald-500/5 border-emerald-500/30',
  }

  const iconColors = {
    default: 'text-redline-400',
    danger: 'text-redline-400',
    warning: 'text-orange-400',
    success: 'text-emerald-400',
  }

  return (
    <div className={clsx('rounded-lg border backdrop-blur-sm overflow-hidden', variants[variant])}>
      <div className="px-4 py-3 border-b border-neutral-800/30 flex items-center gap-2">
        <Icon className={clsx('w-4 h-4', iconColors[variant])} />
        <h3 className="font-medium text-neutral-200">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function SanctionsSection({ entity }: { entity: Entity }) {
  const sanctions = entity.sanctions || []
  if (sanctions.length === 0) return null

  return (
    <SectionCard title={`Sanctions (${sanctions.length})`} icon={Shield} variant="danger">
      <div className="space-y-3">
        {sanctions.map((s, i) => (
          <div key={i} className="bg-neutral-900/50 rounded-lg p-3 border border-neutral-800/30">
            <div className="font-medium text-redline-400 text-sm">{s.list_name}</div>
            {s.program && <div className="text-xs text-neutral-400 mt-1">Program: {s.program}</div>}
            {s.date_listed && (
              <div className="text-xs text-neutral-500 flex items-center gap-1 mt-2">
                <Calendar className="w-3 h-3" />
                Listed: {s.date_listed}
              </div>
            )}
            {s.citation && <div className="text-xs text-neutral-600 mt-1 font-mono">{s.citation}</div>}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

function BIS50Section({ analysis }: { analysis: BIS50Analysis }) {
  if (!analysis.captured) {
    return (
      <SectionCard title="BIS 50% Rule" icon={CheckCircle} variant="success">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="font-medium text-emerald-400">Not Captured</div>
            <div className="text-sm text-neutral-500">Entity is not captured by the BIS 50% Rule</div>
          </div>
        </div>
      </SectionCard>
    )
  }

  return (
    <SectionCard title="BIS 50% Rule: CAPTURED" icon={AlertCircle} variant="warning">
      <p className="text-sm text-orange-300/80 mb-4">{analysis.reason}</p>

      {analysis.ownership_chains && analysis.ownership_chains.length > 0 && (
        <div className="space-y-3">
          <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider">Ownership Chain</div>
          {analysis.ownership_chains.map((chain, i) => (
            <div key={i} className="bg-neutral-900/50 rounded-lg p-3 border border-neutral-800/30">
              <div className="flex items-center flex-wrap gap-1 text-sm">
                {chain.chain.map((node, j) => (
                  <span key={node.id} className="flex items-center gap-1">
                    <Link
                      to={`/entity/${node.id}`}
                      className={clsx(
                        'hover:text-redline-400 transition-colors',
                        j === 0 ? 'font-semibold text-redline-400' : 'text-neutral-300'
                      )}
                    >
                      {node.name}
                    </Link>
                    {j < chain.chain.length - 1 && (
                      <>
                        <ChevronRight className="w-4 h-4 text-neutral-600" />
                        <span className="text-xs text-redline-500 font-mono">
                          {chain.percentages[j]}%
                        </span>
                        <ChevronRight className="w-4 h-4 text-neutral-600" />
                      </>
                    )}
                  </span>
                ))}
              </div>
              <div className="text-xs text-neutral-500 mt-2 font-mono">
                Effective ownership: <span className="text-orange-400">{chain.effective_percentage.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

function NetworkSection({ network }: { network: NetworkGraphData }) {
  return (
    <SectionCard title={`Ownership Network (${network.nodes.length} entities)`} icon={Network}>
      <NetworkGraph data={network} />

      {/* Relationship list below graph */}
      <div className="mt-4 pt-4 border-t border-neutral-800/30">
        <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider mb-3">Relationships</div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {network.edges.map((edge, i) => {
            const sourceNode = network.nodes.find(n => n.id === edge.source)
            const targetNode = network.nodes.find(n => n.id === edge.target)

            return (
              <div key={i} className="flex items-center gap-2 text-sm p-2 bg-neutral-800/30 rounded-lg">
                <Link
                  to={`/entity/${edge.source}`}
                  className={clsx(
                    'hover:text-redline-400 transition-colors truncate',
                    sourceNode?.risk_flags?.includes('entity_list') ? 'text-redline-400 font-medium' : 'text-neutral-300'
                  )}
                >
                  {sourceNode?.name || edge.source}
                </Link>
                <span className="text-xs text-neutral-500 flex-shrink-0 font-mono">
                  {edge.type === 'OWNS' && (
                    <span className="text-redline-400">--{edge.percentage}%--{'>'}</span>
                  )}
                  {edge.type === 'OFFICER_OF' && (
                    <span className="text-steel-400">--{edge.role || 'officer'}--{'>'}</span>
                  )}
                  {edge.type === 'CONTROLS' && (
                    <span className="text-gold-400">--controls--{'>'}</span>
                  )}
                </span>
                <Link
                  to={`/entity/${edge.target}`}
                  className={clsx(
                    'hover:text-redline-400 transition-colors truncate',
                    targetNode?.risk_flags?.includes('entity_list') ? 'text-redline-400 font-medium' : 'text-neutral-300'
                  )}
                >
                  {targetNode?.name || edge.target}
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </SectionCard>
  )
}

function RiskNarrativeSection({ narrative, isLoading }: { narrative?: RiskNarrative; isLoading: boolean }) {
  if (isLoading) {
    return (
      <SectionCard title="Risk Assessment" icon={FileText}>
        <div className="flex items-center gap-3 py-4">
          <div className="w-5 h-5 border-2 border-redline-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-neutral-400 font-mono text-sm">Generating risk narrative...</span>
        </div>
      </SectionCard>
    )
  }

  if (!narrative) return null

  return (
    <SectionCard title="Risk Assessment" icon={FileText} variant="danger">
      {/* AI indicator */}
      <div className="flex items-center gap-2 mb-3 text-xs">
        {narrative.generated_by === 'claude' ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-redline-500/10 text-redline-400 border border-redline-500/30">
            <Sparkles className="w-3 h-3" />
            AI-Generated Analysis
          </span>
        ) : (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-500/10 text-neutral-400 border border-neutral-500/30">
            <FileText className="w-3 h-3" />
            Template Analysis
          </span>
        )}
      </div>

      {/* Narrative text */}
      <div className="prose prose-sm prose-invert max-w-none">
        <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap">
          {narrative.narrative}
        </p>
      </div>

      {/* Sources */}
      {narrative.sources && narrative.sources.length > 0 && (
        <div className="mt-4 pt-4 border-t border-neutral-800/30">
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-500 uppercase tracking-wider mb-2">
            <BookOpen className="w-3 h-3" />
            Sources ({narrative.sources.length})
          </div>
          <div className="space-y-1">
            {narrative.sources.slice(0, 5).map((source, i) => (
              <div key={i} className="text-xs text-neutral-500 flex items-start gap-2">
                <span className="text-neutral-600">•</span>
                <span>
                  <span className="text-neutral-400">{source.citation}</span>
                  {source.description && (
                    <span className="text-neutral-600"> — {source.description}</span>
                  )}
                </span>
              </div>
            ))}
            {narrative.sources.length > 5 && (
              <div className="text-xs text-neutral-600">
                +{narrative.sources.length - 5} more sources
              </div>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  )
}

const eventTypeConfig: Record<string, { color: string; icon: string; label: string }> = {
  sanction_added: { color: 'text-redline-400 border-redline-500 bg-redline-500/20', icon: '🚫', label: 'Sanction Added' },
  sanction_expanded: { color: 'text-orange-400 border-orange-500 bg-orange-500/20', icon: '⚠️', label: 'Sanction Expanded' },
  sanction_removed: { color: 'text-emerald-400 border-emerald-500 bg-emerald-500/20', icon: '✓', label: 'Sanction Removed' },
  investigation: { color: 'text-gold-400 border-gold-500 bg-gold-500/20', icon: '🔍', label: 'Investigation' },
  restructure: { color: 'text-purple-400 border-purple-500 bg-purple-500/20', icon: '🔄', label: 'Restructure' },
  name_change: { color: 'text-steel-400 border-steel-500 bg-steel-500/20', icon: '📝', label: 'Name Change' },
  ownership_change: { color: 'text-pink-400 border-pink-500 bg-pink-500/20', icon: '🔀', label: 'Ownership Change' },
  product_launch: { color: 'text-teal-400 border-teal-500 bg-teal-500/20', icon: '🚀', label: 'Product Launch' },
  founding: { color: 'text-emerald-400 border-emerald-500 bg-emerald-500/20', icon: '🏢', label: 'Founded' },
}

function TimelineSection({ timeline }: { timeline: TimelineAnalysis }) {
  const events = timeline.events || []
  const patterns = timeline.patterns || []

  if (events.length === 0) return null

  const getEventConfig = (type: string) => eventTypeConfig[type] || {
    color: 'text-neutral-400 border-neutral-500 bg-neutral-500/20',
    icon: '•',
    label: type
  }

  return (
    <SectionCard title={`Timeline (${events.length} events)`} icon={Clock}>
      {/* Pattern Warnings */}
      {patterns.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="text-xs font-mono text-gold-500 uppercase tracking-wider flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            Potential Evasion Patterns Detected
          </div>
          {patterns.map((pattern, i) => (
            <div
              key={i}
              className={clsx(
                'p-3 rounded-lg border text-sm',
                pattern.severity === 'high'
                  ? 'bg-redline-500/10 border-redline-500/30 text-redline-300'
                  : pattern.severity === 'medium'
                  ? 'bg-gold-500/10 border-gold-500/30 text-gold-300'
                  : 'bg-neutral-500/10 border-neutral-500/30 text-neutral-300'
              )}
            >
              <div className="font-medium flex items-center gap-2">
                {pattern.severity === 'high' && <AlertCircle className="w-4 h-4" />}
                {pattern.description}
              </div>
              <div className="text-xs opacity-75 mt-1">{pattern.details}</div>
            </div>
          ))}
        </div>
      )}

      {/* Event Type Summary */}
      {timeline.event_summary && Object.keys(timeline.event_summary.by_type).length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(timeline.event_summary.by_type).map(([type, count]) => {
            const config = getEventConfig(type)
            return (
              <span
                key={type}
                className={clsx('px-2 py-0.5 rounded text-xs font-mono border', config.color)}
              >
                {config.icon} {config.label}: {count}
              </span>
            )
          })}
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-neutral-700" />

        <div className="space-y-4">
          {events.map((event, i) => {
            const config = getEventConfig(event.event_type)
            return (
              <div key={i} className="flex gap-4 relative">
                <div
                  className={clsx(
                    'w-5 h-5 rounded-full flex-shrink-0 mt-0.5 z-10 flex items-center justify-center text-xs border-2',
                    config.color
                  )}
                >
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-neutral-500">{event.date}</span>
                    <span className={clsx('px-1.5 py-0.5 rounded text-xs font-mono border', config.color)}>
                      {config.label}
                    </span>
                  </div>
                  <div className="font-medium text-neutral-200 text-sm mt-1">{event.title}</div>
                  {event.description && (
                    <div className="text-sm text-neutral-400 mt-1">{event.description}</div>
                  )}
                  {event.source && (
                    <div className="text-xs text-neutral-600 mt-1 font-mono">Source: {event.source}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </SectionCard>
  )
}

export default function EntityPage() {
  const { id } = useParams<{ id: string }>()

  const { data: entity, isLoading: entityLoading, error: entityError } = useQuery({
    queryKey: ['entity', id],
    queryFn: () => getEntity(id!),
    enabled: !!id,
  })

  const { data: network } = useQuery({
    queryKey: ['network', id],
    queryFn: () => getEntityNetwork(id!, 2),
    enabled: !!id,
  })

  const { data: bis50 } = useQuery({
    queryKey: ['bis50', id],
    queryFn: () => getBIS50Analysis(id!),
    enabled: !!id,
  })

  const { data: timeline } = useQuery({
    queryKey: ['timeline', id],
    queryFn: () => getEntityTimeline(id!),
    enabled: !!id,
  })

  const { data: narrative, isLoading: narrativeLoading } = useQuery({
    queryKey: ['narrative', id],
    queryFn: () => getRiskNarrative(id!),
    enabled: !!id,
  })

  if (entityLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 px-4 py-2 bg-neutral-800/50 rounded-lg border border-neutral-700/50">
          <div className="w-5 h-5 border-2 border-redline-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-neutral-400 font-mono">Loading entity...</span>
        </div>
      </div>
    )
  }

  if (entityError || !entity) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-redline-500/10 border border-redline-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileWarning className="w-6 h-6 text-redline-400" />
            <h2 className="text-lg font-semibold text-redline-400">Entity not found</h2>
          </div>
          <p className="text-neutral-400 mb-4">Could not load entity: <span className="font-mono text-redline-400">{id}</span></p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-redline-400 hover:text-redline-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to search
          </Link>
        </div>
      </div>
    )
  }

  const riskFlags = entity.risk_flags || []

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-neutral-500 hover:text-redline-400 transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to search
      </Link>

      {/* Header */}
      <div className="bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className={clsx(
            'p-4 rounded-lg flex-shrink-0',
            riskFlags.includes('entity_list') || riskFlags.includes('meu_list')
              ? 'bg-redline-500/10 text-redline-400 border border-redline-500/30'
              : 'bg-neutral-800/50 text-neutral-400 border border-neutral-700/50'
          )}>
            <EntityTypeIcon type={entity.type || 'Company'} large />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-neutral-100 tracking-tight">
                  {entity.name_en}
                </h1>
                {entity.name_cn && (
                  <p className="text-lg text-neutral-500 font-mono mt-1">{entity.name_cn}</p>
                )}
              </div>
              <RiskBadge score={entity.risk_score} />
            </div>

            {entity.description && (
              <p className="text-neutral-400 mt-3 leading-relaxed">{entity.description}</p>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-neutral-500">
              {entity.jurisdiction && (
                <span className="flex items-center gap-1.5 px-2 py-1 bg-neutral-800/50 rounded-lg">
                  <MapPin className="w-3.5 h-3.5 text-neutral-600" />
                  {entity.jurisdiction}
                </span>
              )}
              {entity.industry && (
                <span className="flex items-center gap-1.5 px-2 py-1 bg-neutral-800/50 rounded-lg">
                  <Building2 className="w-3.5 h-3.5 text-neutral-600" />
                  {entity.industry}
                </span>
              )}
              {entity.uscc && (
                <span className="flex items-center gap-1.5 px-2 py-1 bg-neutral-800/50 rounded-lg font-mono text-xs">
                  <Hash className="w-3.5 h-3.5 text-neutral-600" />
                  USCC: {entity.uscc}
                </span>
              )}
              {entity.founded && (
                <span className="flex items-center gap-1.5 px-2 py-1 bg-neutral-800/50 rounded-lg">
                  <Calendar className="w-3.5 h-3.5 text-neutral-600" />
                  Founded: {entity.founded}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Risk Flags */}
        {riskFlags.length > 0 && (
          <div className="mt-6 pt-4 border-t border-neutral-800/30">
            <div className="text-xs font-mono text-neutral-600 uppercase tracking-wider mb-3">Risk Indicators</div>
            <div className="flex flex-wrap gap-2">
              {riskFlags.map((flag) => {
                const info = flagLabels[flag] || { label: flag, description: '' }
                return (
                  <div
                    key={flag}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border cursor-help transition-colors',
                      flag === 'entity_list' || flag === 'meu_list'
                        ? 'bg-redline-500/10 text-redline-400 border-redline-500/30 hover:bg-redline-500/20'
                        : flag === 'bis_50_captured'
                        ? 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20'
                        : 'bg-neutral-800/50 text-neutral-400 border-neutral-700/50 hover:bg-neutral-700/50'
                    )}
                    title={info.description}
                  >
                    {info.label}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <RiskNarrativeSection narrative={narrative} isLoading={narrativeLoading} />
          <SanctionsSection entity={entity} />
          {bis50 && <BIS50Section analysis={bis50} />}
          {timeline && timeline.events.length > 0 && <TimelineSection timeline={timeline} />}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {network && network.edges.length > 0 && (
            <NetworkSection network={network} />
          )}
        </div>
      </div>
    </div>
  )
}
