import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { useNavigate } from 'react-router-dom'
import type { NetworkGraph as NetworkGraphData, NetworkNode } from '../services/api'

interface Props {
  data: NetworkGraphData
  width?: number
  height?: number
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string
  name: string
  type: string
  risk_flags: string[]
  bis_50_captured: boolean
  risk_score?: number
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  type: string
  percentage?: number
  role?: string
}

function getRiskClass(node: NetworkNode): string {
  const flags = node.risk_flags || []
  if (flags.includes('entity_list') || flags.includes('meu_list')) return 'critical'
  if (flags.includes('ns_cmic') || flags.includes('cmc_1260h') || node.bis_50_captured) return 'high'
  if ((node.risk_score ?? 0) >= 70) return 'medium'
  if ((node.risk_score ?? 0) >= 50) return 'low'
  return 'default'
}

function getNodeColor(node: NetworkNode): string {
  const riskClass = getRiskClass(node)
  const colors: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
    default: '#64748b',
  }
  return colors[riskClass] || colors.default
}

function getLinkColor(link: D3Link): string {
  switch (link.type) {
    case 'OWNS':
      return '#06b6d4'
    case 'CONTROLS':
      return '#f59e0b'
    case 'OFFICER_OF':
      return '#a855f7'
    default:
      return '#475569'
  }
}

export default function NetworkGraph({ data, width = 600, height = 400 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: D3Node } | null>(null)
  const [dimensions, setDimensions] = useState({ width, height })

  // Responsive sizing
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: containerWidth } = entry.contentRect
        setDimensions({
          width: Math.max(containerWidth, 300),
          height: Math.max(Math.min(containerWidth * 0.7, 500), 300),
        })
      }
    })

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width: w, height: h } = dimensions

    // Create defs for gradients and markers
    const defs = svg.append('defs')

    // Arrow marker
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', '#475569')

    // Radial gradient for center node glow
    const gradient = defs.append('radialGradient')
      .attr('id', 'centerGlow')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%')

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#06b6d4')
      .attr('stop-opacity', 0.8)

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#06b6d4')
      .attr('stop-opacity', 0)

    // Create container group with zoom
    const g = svg.append('g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Prepare data
    const nodes: D3Node[] = data.nodes.map((n) => ({ ...n }))
    const links: D3Link[] = data.edges.map((e) => ({
      source: e.source,
      target: e.target,
      type: e.type,
      percentage: e.percentage,
      role: e.role,
    }))

    // Force simulation
    const simulation = d3.forceSimulation<D3Node>(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links)
        .id((d) => d.id)
        .distance(100)
        .strength(0.5))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide().radius(40))

    // Links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', getLinkColor)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => d.type === 'OWNS' ? 2 : 1.5)
      .attr('marker-end', 'url(#arrowhead)')

    // Link labels (ownership percentages)
    const linkLabels = g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(links.filter((l) => l.percentage !== undefined))
      .join('text')
      .attr('font-size', 10)
      .attr('font-family', 'JetBrains Mono')
      .attr('fill', '#94a3b8')
      .attr('text-anchor', 'middle')
      .text((d) => `${d.percentage}%`)

    // Glow effect for center node
    const centerGlow = g.append('circle')
      .attr('r', 35)
      .attr('fill', 'url(#centerGlow)')
      .attr('opacity', 0.5)

    // Drag behavior
    const drag = d3.drag<SVGGElement, D3Node>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    // Nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, D3Node>('g')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(drag)

    // Node circles
    node.append('circle')
      .attr('r', (d) => d.id === data.center_id ? 20 : 14)
      .attr('fill', getNodeColor)
      .attr('stroke', (d) => d.id === data.center_id ? '#06b6d4' : '#1e293b')
      .attr('stroke-width', (d) => d.id === data.center_id ? 3 : 2)

    // Node icons (simple text for entity type)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', (d) => d.id === data.center_id ? 12 : 10)
      .attr('fill', '#fff')
      .text((d) => {
        switch (d.type) {
          case 'Company': return 'C'
          case 'Person': return 'P'
          case 'GovernmentBody': return 'G'
          default: return 'E'
        }
      })

    // Node labels
    node.append('text')
      .attr('x', 0)
      .attr('y', (d) => d.id === data.center_id ? 32 : 26)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('font-family', 'IBM Plex Sans')
      .attr('fill', '#cbd5e1')
      .attr('font-weight', (d) => d.id === data.center_id ? '600' : '400')
      .text((d) => {
        const name = d.name || d.id
        return name.length > 15 ? name.slice(0, 12) + '...' : name
      })

    // Interactions
    node
      .on('mouseover', (event, d) => {
        const [x, y] = d3.pointer(event, svgRef.current)
        setTooltip({ x, y, node: d })
        d3.select(event.currentTarget).select('circle')
          .transition()
          .duration(200)
          .attr('r', (d as D3Node).id === data.center_id ? 24 : 18)
      })
      .on('mouseout', (event, d) => {
        setTooltip(null)
        d3.select(event.currentTarget).select('circle')
          .transition()
          .duration(200)
          .attr('r', (d as D3Node).id === data.center_id ? 20 : 14)
      })
      .on('click', (_, d) => {
        navigate(`/entity/${d.id}`)
      })

    // Simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as D3Node).x!)
        .attr('y1', (d) => (d.source as D3Node).y!)
        .attr('x2', (d) => (d.target as D3Node).x!)
        .attr('y2', (d) => (d.target as D3Node).y!)

      linkLabels
        .attr('x', (d) => ((d.source as D3Node).x! + (d.target as D3Node).x!) / 2)
        .attr('y', (d) => ((d.source as D3Node).y! + (d.target as D3Node).y!) / 2 - 8)

      const centerNode = nodes.find((n) => n.id === data.center_id)
      if (centerNode) {
        centerGlow
          .attr('cx', centerNode.x!)
          .attr('cy', centerNode.y!)
      }

      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    // Initial zoom to fit
    setTimeout(() => {
      const bounds = g.node()?.getBBox()
      if (bounds) {
        const dx = bounds.width
        const dy = bounds.height
        const x = bounds.x + dx / 2
        const y = bounds.y + dy / 2
        const scale = 0.85 / Math.max(dx / w, dy / h)
        const translate = [w / 2 - scale * x, h / 2 - scale * y]

        svg.transition()
          .duration(750)
          .call(
            zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
          )
      }
    }, 300)

    return () => {
      simulation.stop()
    }
  }, [data, dimensions, navigate])

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="bg-slate-900/50 rounded-lg border border-slate-700/50"
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 10,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="font-medium text-slate-200">{tooltip.node.name}</div>
          <div className="text-xs text-slate-400 font-mono">{tooltip.node.id}</div>
          {tooltip.node.risk_flags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {tooltip.node.risk_flags.slice(0, 3).map((flag) => (
                <span
                  key={flag}
                  className="px-1.5 py-0.5 text-[10px] rounded bg-slate-700 text-slate-300"
                >
                  {flag.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
          <div className="text-[10px] text-slate-500 mt-1">Click to view entity</div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex gap-3 text-[10px] text-slate-400 bg-slate-900/80 px-2 py-1 rounded">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-500" />
          <span>Owns</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span>Controls</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-500" />
          <span>Officer</span>
        </div>
      </div>

      {/* Zoom hint */}
      <div className="absolute bottom-2 right-2 text-[10px] text-slate-500 bg-slate-900/80 px-2 py-1 rounded">
        Scroll to zoom | Drag to pan
      </div>
    </div>
  )
}
