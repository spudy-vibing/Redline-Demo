/**
 * API service for WireScreen backend.
 */

import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
})

// Types
export interface Entity {
  id: string
  name_en: string
  name_cn?: string
  type: string
  risk_flags: string[]
  jurisdiction?: string
  risk_score?: number
  industry?: string
  description?: string
  uscc?: string
  founded?: string
  status?: string
  bis_50_captured?: boolean
  sanctions?: SanctionInfo[]
  timeline_events?: TimelineEvent[]
}

export interface SanctionInfo {
  list_name: string
  program?: string
  date_listed?: string
  citation?: string
}

export interface TimelineEvent {
  id: string
  date: string
  event_type: string
  title: string
  description?: string
  source?: string
}

export interface TimelinePattern {
  type: string
  severity: 'high' | 'medium' | 'low'
  description: string
  details: string
  related_events: string[]
}

export interface TimelineAnalysis {
  entity_id: string
  events: TimelineEvent[]
  patterns: TimelinePattern[]
  event_summary: {
    total: number
    by_type: Record<string, number>
  }
}

export interface SearchResult {
  id: string
  name_en: string
  name_cn?: string
  type: string
  risk_flags: string[]
  jurisdiction?: string
  risk_score?: number
}

export interface NetworkNode {
  id: string
  name: string
  type: string
  risk_flags: string[]
  bis_50_captured: boolean
  risk_score?: number
}

export interface NetworkEdge {
  source: string
  target: string
  type: string
  percentage?: number
  role?: string
}

export interface NetworkGraph {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
  center_id: string
}

export interface BIS50Analysis {
  entity_id: string
  captured: boolean
  reason?: string
  is_direct_listing?: boolean
  ownership_chains?: OwnershipChain[]
  aggregate_percentage?: number
}

export interface OwnershipChain {
  seed_id: string
  seed_name: string
  chain: { id: string; name: string }[]
  percentages: number[]
  effective_percentage: number
}

export interface ScreeningResult {
  input_name: string
  matched_entity?: SearchResult
  match_score: number
  risk_level: 'critical' | 'high' | 'medium' | 'low' | 'clear' | 'unknown'
  flags: string[]
  bis_50_captured: boolean
  details?: string
}

export interface ScreeningResponse {
  screened_count: number
  high_risk_count: number
  results: ScreeningResult[]
  summary: {
    by_risk_level: Record<string, number>
    requires_action: number
    unknown_entities: number
  }
}

export interface NarrativeSource {
  type: string
  citation: string
  description: string
}

export interface RiskNarrative {
  entity_id: string
  narrative: string
  generated_by: 'claude' | 'template'
  sources: NarrativeSource[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatSource {
  entity_id: string
  name: string
  type: string
}

export interface ChatResponse {
  answer: string
  cypher_query?: string
  sources: ChatSource[]
  generated_by: 'claude' | 'template'
}

// API functions
export async function searchEntities(
  query: string,
  limit = 20,
  type?: string
): Promise<SearchResult[]> {
  const params: Record<string, string | number> = { q: query, limit }
  if (type) params.type = type

  const response = await api.get('/search', { params })
  return response.data.results
}

export async function getEntity(entityId: string): Promise<Entity> {
  const response = await api.get(`/entity/${entityId}`)
  return response.data
}

export async function getEntityNetwork(
  entityId: string,
  depth = 2
): Promise<NetworkGraph> {
  const response = await api.get(`/entity/${entityId}/network`, {
    params: { depth },
  })
  return response.data
}

export async function getBIS50Analysis(entityId: string): Promise<BIS50Analysis> {
  const response = await api.get(`/entity/${entityId}/bis50`)
  return response.data
}

export async function getEntityTimeline(entityId: string): Promise<TimelineAnalysis> {
  const response = await api.get(`/entity/${entityId}/timeline`)
  return response.data
}

export async function screenEntities(names: string[]): Promise<ScreeningResponse> {
  const response = await api.post('/screen', { entities: names })
  return response.data
}

export async function quickScreen(name: string): Promise<ScreeningResult> {
  const response = await api.post('/screen/quick', null, { params: { name } })
  return response.data
}

export async function getRiskNarrative(entityId: string): Promise<RiskNarrative> {
  const response = await api.get(`/entity/${entityId}/narrative`)
  return response.data
}

export async function sendChatMessage(
  message: string,
  history: ChatMessage[] = []
): Promise<ChatResponse> {
  const response = await api.post('/chat', { message, history })
  return response.data
}

export default api
