import { useState } from 'react'
import { Upload, AlertTriangle } from 'lucide-react'

export default function ScreenerPage() {
  const [input, setInput] = useState('')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Batch Screener</h1>
        <p className="text-gray-600">
          Screen multiple entities against sanctions lists and ownership restrictions.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="w-5 h-5 text-gray-500" />
          <span className="font-medium text-gray-900">Enter Entities</span>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter company names, one per line..."
          className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
        />
        <button className="mt-4 px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
          Screen Entities
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">Screening includes:</p>
            <ul className="mt-2 text-sm text-amber-800 space-y-1">
              <li>• Entity List (BIS) - Export restrictions</li>
              <li>• SDN List (OFAC) - Sanctions</li>
              <li>• NS-CMIC List - Investment restrictions</li>
              <li>• BIS 50% Rule - Ownership-based capture</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
