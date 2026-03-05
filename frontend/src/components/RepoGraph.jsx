import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

export default function RepoGraph({ apiBase }) {
  const svgRef = useRef(null)
  const tooltipRef = useRef(null)
  const containerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAndRender()
    return () => {
      // Cleanup simulation on unmount
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll('*').remove()
      }
    }
  }, [])

  const fetchAndRender = async () => {
    try {
      const res = await fetch(`${apiBase}/repo-structure`)
      const data = await res.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      setLoading(false)
      renderGraph(data)
    } catch (err) {
      setError('Failed to load repository structure')
      setLoading(false)
    }
  }

  const renderGraph = (data) => {
    const svg = d3.select(svgRef.current)
    const container = containerRef.current
    const tooltip = d3.select(tooltipRef.current)

    if (!container) return

    const width = container.clientWidth
    const height = 600

    svg.attr('viewBox', `0 0 ${width} ${height}`)

    // Limit nodes for performance
    let nodes = data.nodes
    let edges = data.edges

    if (nodes.length > 300) {
      // Keep directories plus a sample of files
      const dirs = nodes.filter(n => n.type === 'directory' || n.type === 'root')
      const files = nodes.filter(n => n.type === 'file').slice(0, 200)
      const keepIds = new Set([...dirs, ...files].map(n => n.id))
      nodes = nodes.filter(n => keepIds.has(n.id))
      edges = edges.filter(e => keepIds.has(e.source) && keepIds.has(e.target))
    }

    // Color map for file extensions
    const fileColors = {
      js: '#f1e05a', jsx: '#f1e05a',
      ts: '#3178c6', tsx: '#3178c6',
      py: '#3572A5',
      html: '#e34c26',
      css: '#563d7c',
      json: '#cb3837',
      md: '#083fa1',
      // default
      unknown: '#74b9ff'
    }

    const getNodeColor = (d) => {
      if (d.type === 'root') return '#6c5ce7'
      if (d.type === 'directory') return '#fdcb6e'
      
      const ext = d.name.split('.').pop().toLowerCase()
      return fileColors[ext] || fileColors.unknown
    }

    const nodeSizeMap = {
      root: 18,
      directory: 12,
      file: 8,
    }

    // Create the simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(d => d.id).distance(d => {
        const sourceType = typeof d.source === 'object' ? d.source.type : 'file'
        return sourceType === 'root' ? 150 : sourceType === 'directory' ? 80 : 40
      }))
      .force('charge', d3.forceManyBody().strength(d => d.type === 'root' ? -500 : d.type === 'directory' ? -200 : -50))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => nodeSizeMap[d.type] + 20)) // more space for labels

    // Add zoom
    const g = svg.append('g')

    svg.call(d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })
    )

    // Draw edges
    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', 'rgba(255,255,255,0.08)')
      .attr('stroke-width', 1)

    // Node groups (to hold circle + text)
    const nodeGroup = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(d3.drag()
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
      )

    // Draw circles
    nodeGroup.append('circle')
      .attr('r', d => nodeSizeMap[d.type] || 6)
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', d => d.type === 'root' ? 'rgba(108,92,231,0.5)' : 'none')
      .attr('stroke-width', d => d.type === 'root' ? 4 : 0)

    // Draw labels (only for root, dirs, and top files to prevent clutter)
    nodeGroup.append('text')
      .text(d => d.name)
      .attr('x', d => nodeSizeMap[d.type] + 4)
      .attr('y', 4)
      .style('font-size', d => d.type === 'root' ? '14px' : d.type === 'directory' ? '12px' : '10px')
      .style('font-family', 'Inter, sans-serif')
      .style('font-weight', d => d.type === 'root' ? 'bold' : 'normal')
      .style('fill', d => d.type === 'root' || d.type === 'directory' ? '#e2e8f0' : '#94a3b8')
      .style('opacity', d => d.type === 'file' ? 0.7 : 1)
      .style('pointer-events', 'none')

    // Hover effects
    nodeGroup.on('mouseover', function(event, d) {
      d3.select(this).select('circle')
        .transition().duration(150)
        .attr('r', (nodeSizeMap[d.type] || 6) * 1.5)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)

      d3.select(this).select('text')
        .transition().duration(150)
        .style('fill', '#fff')
        .style('opacity', 1)

      tooltip
        .style('opacity', 1)
        .style('left', `${event.offsetX + 15}px`)
        .style('top', `${event.offsetY - 20}px`)
        .text(d.id)
    })
    .on('mouseout', function(event, d) {
      d3.select(this).select('circle')
        .transition().duration(150)
        .attr('r', nodeSizeMap[d.type] || 6)
        .attr('stroke', d.type === 'root' ? 'rgba(108,92,231,0.5)' : 'none')
        .attr('stroke-width', d.type === 'root' ? 4 : 0)

      d3.select(this).select('text')
        .transition().duration(150)
        .style('fill', d.type === 'root' || d.type === 'directory' ? '#e2e8f0' : '#94a3b8')
        .style('opacity', d.type === 'file' ? 0.7 : 1)

      tooltip.style('opacity', 0)
    })

    // Run simulation
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)

      nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`)
    })
  }

  return (
    <div className="graph-container">
      <div className="graph-toolbar">
        <h3>🕸️ Repository Structure</h3>
        <div className="legend">
          <div className="legend-item">
            <span className="legend-dot root" style={{ background: '#6c5ce7' }}></span> Root
          </div>
          <div className="legend-item">
            <span className="legend-dot directory" style={{ background: '#fdcb6e' }}></span> Folder
          </div>
          <div className="legend-item" style={{marginLeft: 10, paddingLeft: 10, borderLeft: '1px solid rgba(255,255,255,0.1)'}}>
            <span className="legend-dot file" style={{ background: '#f1e05a' }}></span> JS/TS
          </div>
          <div className="legend-item">
            <span className="legend-dot file" style={{ background: '#3572A5' }}></span> Python
          </div>
          <div className="legend-item">
            <span className="legend-dot file" style={{ background: '#e34c26' }}></span> HTML
          </div>
          <div className="legend-item">
            <span className="legend-dot file" style={{ background: '#74b9ff' }}></span> Other
          </div>
        </div>
      </div>

      <div className="graph-svg-wrapper" ref={containerRef}>
        {loading && (
          <div className="graph-loading">
            <div className="loading-spinner"></div>
            <p>Building repository graph...</p>
          </div>
        )}

        {error && (
          <div className="graph-loading">
            <p>⚠️ {error}</p>
          </div>
        )}

        <svg ref={svgRef}></svg>
        <div className="graph-tooltip" ref={tooltipRef}></div>
      </div>
    </div>
  )
}
