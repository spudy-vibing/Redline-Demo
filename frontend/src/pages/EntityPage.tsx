import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, Shield, Building2, User, Landmark,
  Calendar, MapPin, Hash, ArrowLeft, ExternalLink,
  ChevronRight, AlertCircle, CheckCircle, Clock
} from 'lucide-react'
import { clsx } from 'clsx'
import { getEntity, getEntityNetwork, getBIS50Analysis, type Entity, type NetworkGraph, type BIS50Analysis } from '../services/api'

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

  let color = 'bg-green-100 text-green-800'
  let label = 'Low Risk'

  if (score >= 90) {
    color = 'bg-red-100 text-red-800'
    label = 'Critical'
  } else if (score >= 70) {
    color = 'bg-orange-100 text-orange-800'
    label = 'High Risk'
  } else if (score >= 50) {
    color = 'bg-yellow-100 text-yellow-800'
    label = 'Medium Risk'
  }

  return (
    <div className={clsx('px-3 py-1 rounded-full text-sm font-medium', color)}>
      {label} ({score})
    </div>
  )
}

function EntityTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'Company':
      return <Building2 className="w-6 h-6" />
    case 'Person':
      return <User className="w-6 h-6" />
    case 'GovernmentBody':
      return <Landmark className="w-6 h-6" />
    default:
      return <Building2 className="w-6 h-6" />
  }
}

function SanctionsSection({ entity }: { entity: Entity }) {
  const sanctions = entity.sanctions || []
  if (sanctions.length === 0) return null

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
      <h3 className="font-semibold text-red-900 flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5" />
        Sanctions ({sanctions.length})
      </h3>
      <div className="space-y-2">
        {sanctions.map((s, i) => (
          <div key={i} className="bg-white rounded-lg p-3 border border-red-100">
            <div className="font-medium text-red-800">{s.list_name}</div>
            {s.program && <div className="text-sm text-red-600">Program: {s.program}</div>}
            {s.date_listed && (
              <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                <Calendar className="w-3 h-3" />
                Listed: {s.date_listed}
              </div>
            )}
            {s.citation && <div className="text-xs text-gray-400 mt-1">{s.citation}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function BIS50Section({ analysis }: { analysis: BIS50Analysis }) {
  if (!analysis.captured) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <h3 className="font-semibold text-green-900 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          BIS 50% Rule: Not Captured
        </h3>
        <p className="text-sm text-green-700 mt-2">
          This entity is not captured by the BIS 50% Rule based on current ownership data.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
      <h3 className="font-semibold text-orange-900 flex items-center gap-2 mb-3">
        <AlertCircle className="w-5 h-5" />
        BIS 50% Rule: CAPTURED
      </h3>
      <p className="text-sm text-orange-700 mb-3">{analysis.reason}</p>

      {analysis.ownership_chains && analysis.ownership_chains.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-orange-800">Ownership Chain:</div>
          {analysis.ownership_chains.map((chain, i) => (
            <div key={i} className="bg-white rounded-lg p-3 border border-orange-100">
              <div className="flex items-center flex-wrap gap-1 text-sm">
                {chain.chain.map((node, j) => (
                  <span key={node.id} className="flex items-center gap-1">
                    <span className={j === 0 ? 'font-semibold text-red-700' : 'text-gray-700'}>
                      {node.name}
                    </span>
                    {j < chain.chain.length - 1 && (
                      <>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {chain.percentages[j]}%
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </>
                    )}
                  </span>
                ))}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Effective ownership: {chain.effective_percentage.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NetworkSection({ network, entityId }: { network: NetworkGraph; entityId: string }) {
  const centerNode = network.nodes.find(n => n.id === entityId)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="font-semibold text-gray-900 mb-3">
        Ownership Network ({network.nodes.length} entities)
      </h3>

      <div className="space-y-2">
        {network.edges.map((edge, i) => {
          const sourceNode = network.nodes.find(n => n.id === edge.source)
          const targetNode = network.nodes.find(n => n.id === edge.target)

          return (
            <div key={i} className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded-lg">
              <Link
                to={`/entity/${edge.source}`}
                className={clsx(
                  'hover:text-blue-600',
                  sourceNode?.risk_flags?.includes('entity_list') ? 'text-red-700 font-medium' : 'text-gray-700'
                )}
              >
                {sourceNode?.name || edge.source}
              </Link>
              <span className="text-gray-400">
                {edge.type === 'OWNS' && `→ owns ${edge.percentage}% of →`}
                {edge.type === 'OFFICER_OF' && `→ ${edge.role || 'officer of'} →`}
                {edge.type === 'CONTROLS' && `→ controls →`}
              </span>
              <Link
                to={`/entity/${edge.target}`}
                className={clsx(
                  'hover:text-blue-600',
                  targetNode?.risk_flags?.includes('entity_list') ? 'text-red-700 font-medium' : 'text-gray-700'
                )}
              >
                {targetNode?.name || edge.target}
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimelineSection({ entity }: { entity: Entity }) {
  const events = entity.timeline_events || []
  if (events.length === 0) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
        <Clock className="w-5 h-5" />
        Timeline ({events.length} events)
      </h3>
      <div className="space-y-3">
        {events.map((event, i) => (
          <div key={i} className="flex gap-3">
            <div className="text-sm text-gray-400 w-24 flex-shrink-0">{event.date}</div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">{event.title}</div>
              {event.description && (
                <div className="text-sm text-gray-600 mt-1">{event.description}</div>
              )}
              {event.source && (
                <div className="text-xs text-gray-400 mt-1">Source: {event.source}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
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

  if (entityLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (entityError || !entity) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-red-900">Entity not found</h2>
        <p className="text-red-700 mt-2">Could not load entity: {id}</p>
        <Link to="/" className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-800">
          <ArrowLeft className="w-4 h-4" />
          Back to search
        </Link>
      </div>
    )
  }

  const riskFlags = entity.risk_flags || []

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link to="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" />
        Back to search
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className={clsx(
            'p-3 rounded-xl',
            riskFlags.includes('entity_list') || riskFlags.includes('meu_list')
              ? 'bg-red-100 text-red-600'
              : 'bg-gray-100 text-gray-600'
          )}>
            <EntityTypeIcon type={entity.type || 'Company'} />
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{entity.name_en}</h1>
                {entity.name_cn && (
                  <p className="text-lg text-gray-500">{entity.name_cn}</p>
                )}
              </div>
              <RiskBadge score={entity.risk_score} />
            </div>

            {entity.description && (
              <p className="text-gray-600 mt-2">{entity.description}</p>
            )}

            {/* Metadata */}
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500">
              {entity.jurisdiction && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {entity.jurisdiction}
                </span>
              )}
              {entity.industry && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {entity.industry}
                </span>
              )}
              {entity.uscc && (
                <span className="flex items-center gap-1">
                  <Hash className="w-4 h-4" />
                  USCC: {entity.uscc}
                </span>
              )}
              {entity.founded && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Founded: {entity.founded}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Risk Flags */}
        {riskFlags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-sm font-medium text-gray-700 mb-2">Risk Flags</div>
            <div className="flex flex-wrap gap-2">
              {riskFlags.map((flag) => {
                const info = flagLabels[flag] || { label: flag, description: '' }
                return (
                  <div
                    key={flag}
                    className={clsx(
                      'px-3 py-1 rounded-full text-sm',
                      flag === 'entity_list' || flag === 'meu_list'
                        ? 'bg-red-100 text-red-700'
                        : flag === 'bis_50_captured'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-100 text-gray-700'
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
          <SanctionsSection entity={entity} />
          {bis50 && <BIS50Section analysis={bis50} />}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {network && network.edges.length > 0 && (
            <NetworkSection network={network} entityId={id!} />
          )}
          <TimelineSection entity={entity} />
        </div>
      </div>
    </div>
  )
}
