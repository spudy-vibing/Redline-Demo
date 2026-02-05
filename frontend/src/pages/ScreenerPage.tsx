import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle, AlertCircle,
  HelpCircle, XCircle, ChevronDown, ChevronUp,
  Shield, FileText, Zap, Target, Activity, Upload
} from 'lucide-react'
import { clsx } from 'clsx'
import { screenEntities, type ScreeningResponse, type ScreeningResult } from '../services/api'

const riskLevelConfig: Record<string, { icon: typeof AlertTriangle; color: string; bg: string; border: string }> = {
  critical: { icon: XCircle, color: 'text-redline-400', bg: 'bg-redline-500/10', border: 'border-redline-500/30' },
  high: { icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  medium: { icon: AlertTriangle, color: 'text-gold-400', bg: 'bg-gold-500/10', border: 'border-gold-500/30' },
  low: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  clear: { icon: CheckCircle, color: 'text-steel-400', bg: 'bg-steel-500/10', border: 'border-steel-500/30' },
  unknown: { icon: HelpCircle, color: 'text-neutral-400', bg: 'bg-neutral-800/50', border: 'border-neutral-700/50' },
}

function ScreeningResultRow({ result, index }: { result: ScreeningResult; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const config = riskLevelConfig[result.risk_level] || riskLevelConfig.unknown
  const Icon = config.icon

  return (
    <div
      className={clsx(
        'border rounded-lg overflow-hidden backdrop-blur-sm animate-slide-up',
        config.bg, config.border
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-neutral-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={clsx('p-2 rounded-lg', config.bg, config.border, 'border')}>
            <Icon className={clsx('w-4 h-4', config.color)} />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-neutral-200 truncate">{result.input_name}</div>
            {result.matched_entity && (
              <div className="text-sm text-neutral-500 truncate font-mono">
                Matched: {result.matched_entity.name_en}
                {result.matched_entity.name_cn && ` (${result.matched_entity.name_cn})`}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className={clsx(
            'px-2.5 py-1 rounded text-xs font-mono font-medium uppercase border',
            config.bg, config.border, config.color
          )}>
            {result.risk_level}
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-neutral-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-neutral-500" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-neutral-800/30 bg-neutral-900/50">
          <div className="pt-4 space-y-3">
            <p className="text-sm text-neutral-400">{result.details}</p>

            {result.flags && result.flags.length > 0 && (
              <div>
                <div className="text-xs font-mono text-neutral-600 uppercase tracking-wider mb-2">Risk Flags</div>
                <div className="flex flex-wrap gap-1.5">
                  {result.flags.map((flag) => (
                    <span
                      key={flag}
                      className={clsx(
                        'px-2 py-0.5 text-[10px] font-mono uppercase rounded border',
                        flag === 'entity_list' || flag === 'meu_list'
                          ? 'bg-redline-500/10 text-redline-400 border-redline-500/20'
                          : 'bg-neutral-800/50 text-neutral-400 border-neutral-700/30'
                      )}
                    >
                      {flag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.bis_50_captured && (
              <div className="flex items-center gap-2 text-sm text-orange-400 bg-orange-500/10 px-3 py-2 rounded-lg border border-orange-500/20">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">Captured by BIS 50% Rule</span>
              </div>
            )}

            {result.matched_entity && (
              <Link
                to={`/entity/${result.matched_entity.id}`}
                className="inline-flex items-center gap-2 mt-2 text-sm text-redline-400 hover:text-redline-300 transition-colors"
              >
                <Target className="w-4 h-4" />
                View full entity profile
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultsSummary({ response }: { response: ScreeningResponse }) {
  const { summary, screened_count, high_risk_count } = response

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-neutral-900/60 backdrop-blur-sm rounded-lg border border-neutral-800 p-4">
        <div className="text-2xl font-bold text-redline-400">{screened_count}</div>
        <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider mt-1">Total Screened</div>
      </div>

      <div className={clsx(
        'rounded-lg border p-4 backdrop-blur-sm',
        high_risk_count > 0
          ? 'bg-redline-500/10 border-redline-500/30'
          : 'bg-emerald-500/10 border-emerald-500/30'
      )}>
        <div className={clsx(
          'text-2xl font-bold flex items-center gap-2',
          high_risk_count > 0 ? 'text-redline-400' : 'text-emerald-400'
        )}>
          {high_risk_count > 0 && <Activity className="w-5 h-5 animate-pulse" />}
          {high_risk_count}
        </div>
        <div className={clsx(
          'text-xs font-mono uppercase tracking-wider mt-1',
          high_risk_count > 0 ? 'text-redline-400/70' : 'text-emerald-400/70'
        )}>
          High/Critical
        </div>
      </div>

      <div className="bg-emerald-500/5 rounded-lg border border-emerald-500/20 p-4">
        <div className="text-2xl font-bold text-emerald-400">
          {(summary.by_risk_level.clear || 0) + (summary.by_risk_level.low || 0)}
        </div>
        <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider mt-1">Clear/Low</div>
      </div>

      <div className="bg-neutral-900/60 backdrop-blur-sm rounded-lg border border-neutral-800 p-4">
        <div className="text-2xl font-bold text-neutral-500">{summary.unknown_entities}</div>
        <div className="text-xs font-mono text-neutral-600 uppercase tracking-wider mt-1">Not Found</div>
      </div>
    </div>
  )
}

export default function ScreenerPage() {
  const [input, setInput] = useState('')

  const screenMutation = useMutation({
    mutationFn: (names: string[]) => screenEntities(names),
  })

  const handleScreen = () => {
    const names = input
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)

    if (names.length === 0) return

    screenMutation.mutate(names)
  }

  const loadSampleData = () => {
    setInput(`Huawei Technologies
HiSilicon
SMIC
DeepSeek
AVIC
Hikvision
BYD
Apple Inc
Microsoft Corporation
CATL`)
  }

  const entityCount = input.split('\n').filter(l => l.trim()).length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-redline-500/10 border border-redline-500/30 flex items-center justify-center">
          <Shield className="w-6 h-6 text-redline-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Batch Screener</h1>
          <p className="text-sm text-neutral-500">
            Screen multiple entities against sanctions and export control lists
          </p>
        </div>
      </div>

      {/* The redline divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-redline-500/50 to-transparent" />

      {/* Input section */}
      <div className="bg-neutral-900/60 backdrop-blur-sm rounded-lg border border-neutral-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-redline-400" />
            <span className="font-medium text-neutral-200">Entity List</span>
            <span className="text-xs font-mono text-neutral-500 ml-2">One per line</span>
          </div>
          <button
            onClick={loadSampleData}
            className="flex items-center gap-1.5 text-sm text-redline-400 hover:text-redline-300 transition-colors font-mono"
          >
            <Upload className="w-3.5 h-3.5" />
            Load sample
          </button>
        </div>

        <div className="p-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Huawei Technologies&#10;SMIC&#10;DeepSeek&#10;..."
            className="w-full h-48 p-4 bg-neutral-800/50 border border-neutral-700/50 rounded-lg focus:ring-2 focus:ring-redline-500/30 focus:border-redline-500/50 outline-none resize-none font-mono text-sm text-neutral-200 placeholder-neutral-600"
          />

          <div className="flex items-center justify-between mt-4">
            <span className="text-sm font-mono text-neutral-500">
              <span className="text-redline-400 font-semibold">{entityCount}</span> entities
            </span>
            <button
              onClick={handleScreen}
              disabled={screenMutation.isPending || !input.trim()}
              className={clsx(
                'px-5 py-2.5 font-medium rounded-lg transition-all flex items-center gap-2',
                screenMutation.isPending || !input.trim()
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  : 'bg-redline-600 hover:bg-redline-500 text-white shadow-lg shadow-redline-500/20'
              )}
            >
              {screenMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
                  <span>Screening...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Screen All</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-gold-500/5 border border-gold-500/20 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-gold-500/10 border border-gold-500/20">
            <AlertTriangle className="w-4 h-4 text-gold-400" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gold-400 mb-3">Screening Coverage</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-neutral-400">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-redline-500" />
                <span><span className="text-redline-400 font-medium">Entity List</span> - BIS export restrictions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-redline-500" />
                <span><span className="text-redline-400 font-medium">SDN List</span> - OFAC sanctions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <span><span className="text-orange-400 font-medium">MEU List</span> - Military end-use</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <span><span className="text-orange-400 font-medium">NS-CMIC</span> - Investment restrictions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-500" />
                <span><span className="text-gold-400 font-medium">CMC-1260H</span> - Chinese military cos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-steel-500" />
                <span><span className="text-steel-400 font-medium">BIS 50%</span> - Ownership capture rule</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {screenMutation.isError && (
        <div className="bg-redline-500/10 border border-redline-500/30 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-redline-400 mt-0.5" />
          <div>
            <p className="font-medium text-redline-400">Screening failed</p>
            <p className="text-sm text-redline-400/70">
              {screenMutation.error instanceof Error
                ? screenMutation.error.message
                : 'Please try again'}
            </p>
          </div>
        </div>
      )}

      {screenMutation.data && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-redline-500 rounded-full" />
            <h2 className="text-lg font-semibold text-neutral-100">Screening Results</h2>
            <span className="text-xs font-mono text-neutral-500 ml-auto">
              {new Date().toLocaleTimeString()}
            </span>
          </div>

          <ResultsSummary response={screenMutation.data} />

          <div className="space-y-2">
            {screenMutation.data.results
              .sort((a, b) => {
                const order = { critical: 0, high: 1, medium: 2, unknown: 3, low: 4, clear: 5 }
                return (order[a.risk_level] ?? 6) - (order[b.risk_level] ?? 6)
              })
              .map((result, i) => (
                <ScreeningResultRow key={i} result={result} index={i} />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
