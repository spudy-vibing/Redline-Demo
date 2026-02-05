import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Upload, AlertTriangle, CheckCircle, AlertCircle,
  HelpCircle, XCircle, ChevronDown, ChevronUp
} from 'lucide-react'
import { clsx } from 'clsx'
import { screenEntities, type ScreeningResponse, type ScreeningResult } from '../services/api'

const riskLevelConfig: Record<string, { icon: typeof AlertTriangle; color: string; bgColor: string }> = {
  critical: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-50 border-red-200' },
  high: { icon: AlertCircle, color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
  medium: { icon: AlertTriangle, color: 'text-yellow-600', bgColor: 'bg-yellow-50 border-yellow-200' },
  low: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50 border-green-200' },
  clear: { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-50 border-green-200' },
  unknown: { icon: HelpCircle, color: 'text-gray-500', bgColor: 'bg-gray-50 border-gray-200' },
}

function ScreeningResultRow({ result }: { result: ScreeningResult }) {
  const [expanded, setExpanded] = useState(false)
  const config = riskLevelConfig[result.risk_level] || riskLevelConfig.unknown
  const Icon = config.icon

  return (
    <div className={clsx('border rounded-lg overflow-hidden', config.bgColor)}>
      <div
        className="p-4 flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <Icon className={clsx('w-5 h-5', config.color)} />
          <div>
            <div className="font-medium text-gray-900">{result.input_name}</div>
            {result.matched_entity && (
              <div className="text-sm text-gray-500">
                Matched: {result.matched_entity.name_en}
                {result.matched_entity.name_cn && ` (${result.matched_entity.name_cn})`}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={clsx(
            'px-2 py-1 rounded text-xs font-medium uppercase',
            result.risk_level === 'critical' ? 'bg-red-100 text-red-800' :
            result.risk_level === 'high' ? 'bg-orange-100 text-orange-800' :
            result.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            result.risk_level === 'low' || result.risk_level === 'clear' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
          )}>
            {result.risk_level}
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-white">
          <div className="pt-3 space-y-2">
            <p className="text-sm text-gray-700">{result.details}</p>

            {result.flags && result.flags.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-1">Risk Flags:</div>
                <div className="flex flex-wrap gap-1">
                  {result.flags.map((flag) => (
                    <span
                      key={flag}
                      className={clsx(
                        'px-2 py-0.5 text-xs rounded',
                        flag === 'entity_list' || flag === 'meu_list'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {flag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.bis_50_captured && (
              <div className="text-sm text-orange-700 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Captured by BIS 50% Rule
              </div>
            )}

            {result.matched_entity && (
              <Link
                to={`/entity/${result.matched_entity.id}`}
                className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                View full entity profile →
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
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-2xl font-bold text-gray-900">{screened_count}</div>
        <div className="text-sm text-gray-500">Total Screened</div>
      </div>

      <div className={clsx(
        'rounded-xl border p-4',
        high_risk_count > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
      )}>
        <div className={clsx(
          'text-2xl font-bold',
          high_risk_count > 0 ? 'text-red-700' : 'text-green-700'
        )}>
          {high_risk_count}
        </div>
        <div className={clsx(
          'text-sm',
          high_risk_count > 0 ? 'text-red-600' : 'text-green-600'
        )}>
          High/Critical Risk
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-2xl font-bold text-green-700">
          {(summary.by_risk_level.clear || 0) + (summary.by_risk_level.low || 0)}
        </div>
        <div className="text-sm text-gray-500">Clear/Low Risk</div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-2xl font-bold text-gray-400">{summary.unknown_entities}</div>
        <div className="text-sm text-gray-500">Not Found</div>
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Batch Screener</h1>
        <p className="text-gray-600">
          Screen multiple entities against sanctions lists and ownership restrictions.
        </p>
      </div>

      {/* Input section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-gray-500" />
            <span className="font-medium text-gray-900">Enter Entities</span>
          </div>
          <button
            onClick={loadSampleData}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Load sample data
          </button>
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter company names, one per line..."
          className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none font-mono text-sm"
        />

        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            {input.split('\n').filter(l => l.trim()).length} entities
          </span>
          <button
            onClick={handleScreen}
            disabled={screenMutation.isPending || !input.trim()}
            className={clsx(
              'px-6 py-2 font-medium rounded-lg transition-colors',
              screenMutation.isPending || !input.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            )}
          >
            {screenMutation.isPending ? 'Screening...' : 'Screen Entities'}
          </button>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">Screening includes:</p>
            <ul className="mt-2 text-sm text-amber-800 space-y-1">
              <li>• <strong>Entity List (BIS)</strong> — Export restrictions</li>
              <li>• <strong>SDN List (OFAC)</strong> — Sanctions / asset freezes</li>
              <li>• <strong>Military End User (MEU)</strong> — Military end-use restrictions</li>
              <li>• <strong>NS-CMIC List</strong> — Investment restrictions</li>
              <li>• <strong>CMC-1260H</strong> — Chinese Military Companies</li>
              <li>• <strong>BIS 50% Rule</strong> — Ownership-based capture</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Results */}
      {screenMutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Screening failed</p>
            <p className="text-sm text-red-600">
              {screenMutation.error instanceof Error
                ? screenMutation.error.message
                : 'Please try again'}
            </p>
          </div>
        </div>
      )}

      {screenMutation.data && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Results</h2>

          <ResultsSummary response={screenMutation.data} />

          <div className="space-y-2">
            {screenMutation.data.results
              .sort((a, b) => {
                const order = { critical: 0, high: 1, medium: 2, unknown: 3, low: 4, clear: 5 }
                return (order[a.risk_level] ?? 6) - (order[b.risk_level] ?? 6)
              })
              .map((result, i) => (
                <ScreeningResultRow key={i} result={result} />
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
