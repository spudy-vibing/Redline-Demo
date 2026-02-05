"""
Entity API endpoints.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from services.neo4j_service import get_neo4j_service

router = APIRouter(prefix="/api", tags=["entities"])


@router.get("/search")
async def search_entities(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    type: Optional[str] = Query(None, description="Filter by entity type: company, person, government")
):
    """
    Search entities by name.

    Searches across English names, Chinese names, and pinyin romanization.
    Results are sorted by risk score (highest first).
    """
    service = get_neo4j_service()

    try:
        results = service.search_entities(q, limit=limit, entity_type=type)
        return {
            "query": q,
            "count": len(results),
            "results": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/entity/{entity_id}")
async def get_entity(entity_id: str):
    """
    Get detailed information about an entity.

    Returns full entity profile including sanctions, risk flags, and timeline events.
    """
    service = get_neo4j_service()

    try:
        entity = service.get_entity(entity_id)
        if not entity:
            raise HTTPException(status_code=404, detail=f"Entity not found: {entity_id}")
        return entity
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entity: {str(e)}")


@router.get("/entity/{entity_id}/network")
async def get_entity_network(
    entity_id: str,
    depth: int = Query(2, ge=1, le=5, description="Traversal depth")
):
    """
    Get network graph data for an entity.

    Returns nodes and edges for visualization, centered on the specified entity.
    Includes ownership relationships, officer positions, and government control links.
    """
    service = get_neo4j_service()

    try:
        # First verify entity exists
        entity = service.get_entity(entity_id)
        if not entity:
            raise HTTPException(status_code=404, detail=f"Entity not found: {entity_id}")

        network = service.get_entity_network(entity_id, depth=depth)
        return network
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch network: {str(e)}")


@router.get("/entity/{entity_id}/bis50")
async def get_bis50_analysis(entity_id: str):
    """
    Analyze entity for BIS 50% Rule compliance.

    The BIS 50% Rule (effective September 2025) extends Entity List restrictions
    to any entity that is 50% or more owned by listed parties.

    Returns:
    - Whether the entity is captured by the rule
    - Ownership chains leading to capture
    - Aggregate ownership by listed parties
    """
    service = get_neo4j_service()

    try:
        analysis = service.get_bis50_analysis(entity_id)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BIS 50% analysis failed: {str(e)}")


@router.get("/entity/{entity_id}/timeline")
async def get_entity_timeline(entity_id: str):
    """
    Get timeline of events for an entity with pattern analysis.

    Includes sanctions additions/removals, corporate restructurings,
    name changes, and other significant events.

    Also analyzes patterns that may indicate sanctions evasion:
    - Corporate restructures within 6 months before/after sanctions
    - Name changes following sanctions
    - Ownership transfers after listing
    """
    service = get_neo4j_service()

    try:
        events = service.get_entity_timeline(entity_id)

        # Analyze for evasion patterns
        patterns = analyze_timeline_patterns(events)

        # Sort events by date descending
        sorted_events = sorted(events, key=lambda e: e.get('date', ''), reverse=True)

        return {
            "entity_id": entity_id,
            "events": sorted_events,
            "patterns": patterns,
            "event_summary": {
                "total": len(events),
                "by_type": count_by_type(events),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch timeline: {str(e)}")


def analyze_timeline_patterns(events: list[dict]) -> list[dict]:
    """Analyze timeline events for potential evasion patterns."""
    from datetime import datetime, timedelta

    patterns = []
    sanction_dates = []
    restructure_dates = []
    name_change_dates = []
    ownership_dates = []

    for event in events:
        event_type = event.get('event_type', '')
        date_str = event.get('date', '')

        if not date_str:
            continue

        try:
            event_date = datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            continue

        if event_type in ('sanction_added', 'sanction_expanded'):
            sanction_dates.append((event_date, event))
        elif event_type == 'restructure':
            restructure_dates.append((event_date, event))
        elif event_type == 'name_change':
            name_change_dates.append((event_date, event))
        elif event_type == 'ownership_change':
            ownership_dates.append((event_date, event))

    # Check for restructures within 6 months of sanctions
    six_months = timedelta(days=180)
    for sanction_date, sanction_event in sanction_dates:
        for restructure_date, restructure_event in restructure_dates:
            if abs((restructure_date - sanction_date).days) <= 180:
                timing = "before" if restructure_date < sanction_date else "after"
                patterns.append({
                    "type": "restructure_near_sanction",
                    "severity": "high",
                    "description": f"Corporate restructure {timing} sanction listing",
                    "details": f"Restructure on {restructure_event.get('date')} occurred within 6 months of sanction on {sanction_event.get('date')}",
                    "related_events": [restructure_event.get('id'), sanction_event.get('id')]
                })

        # Check for name changes after sanctions
        for name_date, name_event in name_change_dates:
            if name_date > sanction_date and (name_date - sanction_date).days <= 365:
                patterns.append({
                    "type": "name_change_after_sanction",
                    "severity": "medium",
                    "description": "Name change following sanction listing",
                    "details": f"Name changed on {name_event.get('date')} within 1 year of sanction on {sanction_event.get('date')}",
                    "related_events": [name_event.get('id'), sanction_event.get('id')]
                })

        # Check for ownership changes after sanctions
        for ownership_date, ownership_event in ownership_dates:
            if ownership_date > sanction_date and (ownership_date - sanction_date).days <= 365:
                patterns.append({
                    "type": "ownership_change_after_sanction",
                    "severity": "high",
                    "description": "Ownership transfer following sanction listing",
                    "details": f"Ownership changed on {ownership_event.get('date')} within 1 year of sanction on {sanction_event.get('date')}",
                    "related_events": [ownership_event.get('id'), sanction_event.get('id')]
                })

    return patterns


def count_by_type(events: list[dict]) -> dict[str, int]:
    """Count events by type."""
    counts: dict[str, int] = {}
    for event in events:
        event_type = event.get('event_type', 'unknown')
        counts[event_type] = counts.get(event_type, 0) + 1
    return counts


@router.get("/entity/{entity_id}/ownership")
async def get_ownership_tree(
    entity_id: str,
    direction: str = Query("down", regex="^(up|down)$", description="Direction: up for parents, down for subsidiaries")
):
    """
    Get ownership tree for an entity.

    - direction=down: Shows subsidiaries and their subsidiaries
    - direction=up: Shows parent companies up to ultimate beneficial owner
    """
    service = get_neo4j_service()

    try:
        tree = service.get_ownership_tree(entity_id, direction=direction)
        return tree
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch ownership tree: {str(e)}")


@router.get("/entity/{entity_id}/narrative")
async def get_risk_narrative(entity_id: str):
    """
    Generate an investigative-style risk narrative for an entity.

    Uses AI to synthesize graph data into a readable prose explanation
    of why the entity poses compliance risk. Written in the style of
    an export control compliance analyst.
    """
    import os
    from anthropic import Anthropic

    service = get_neo4j_service()

    try:
        # Gather all relevant data
        entity = service.get_entity(entity_id)
        if not entity:
            raise HTTPException(status_code=404, detail=f"Entity not found: {entity_id}")

        # Get additional context
        network = service.get_entity_network(entity_id, depth=1)
        bis50 = service.get_bis50_analysis(entity_id)
        timeline_events = service.get_entity_timeline(entity_id)
        timeline_patterns = analyze_timeline_patterns(timeline_events)

        # Build context for the LLM
        context = build_narrative_context(entity, network, bis50, timeline_events, timeline_patterns)

        # Check for API key
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            # Return a template-based narrative if no API key
            return {
                "entity_id": entity_id,
                "narrative": generate_template_narrative(entity, bis50, timeline_patterns),
                "generated_by": "template",
                "sources": extract_sources(entity, timeline_events)
            }

        # Generate narrative using Claude
        client = Anthropic(api_key=api_key)

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            system="""You are an expert export control compliance analyst writing a risk assessment narrative.

Write in the style of an investigative journalist — clear, factual, well-sourced.
Every claim must be grounded in the data provided. Do not speculate or add information not in the context.
Explain the regulatory implications in plain English.

Structure your narrative:
1. Lead with the bottom line risk assessment (1-2 sentences)
2. Explain the key evidence supporting this assessment
3. Detail ownership relationships and their implications
4. Note any concerning patterns (restructures, name changes near sanctions)
5. Conclude with specific risk factors to monitor

Use specific dates, percentages, and legal citations where available.
Be concise but thorough — aim for 250-350 words.
Do not use markdown formatting or headers — write in flowing prose paragraphs.""",
            messages=[{
                "role": "user",
                "content": f"Generate a risk narrative for this entity based on the following data:\n\n{context}"
            }]
        )

        narrative = response.content[0].text

        return {
            "entity_id": entity_id,
            "narrative": narrative,
            "generated_by": "claude",
            "sources": extract_sources(entity, timeline_events)
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate narrative: {str(e)}")


def build_narrative_context(entity: dict, network: dict, bis50: dict, timeline: list, patterns: list) -> str:
    """Build a structured context string for the LLM."""
    lines = []

    # Entity basics
    lines.append(f"ENTITY: {entity.get('name_en')} ({entity.get('name_cn', 'N/A')})")
    lines.append(f"Type: {entity.get('type', 'Unknown')}")
    lines.append(f"Jurisdiction: {entity.get('jurisdiction', 'Unknown')}")
    lines.append(f"Industry: {entity.get('industry', 'Unknown')}")
    lines.append(f"Risk Score: {entity.get('risk_score', 'N/A')}/100")

    if entity.get('description'):
        lines.append(f"Description: {entity.get('description')}")

    # Risk flags
    risk_flags = entity.get('risk_flags', [])
    if risk_flags:
        lines.append(f"\nRISK FLAGS: {', '.join(risk_flags)}")

    # Sanctions
    sanctions = entity.get('sanctions', [])
    if sanctions:
        lines.append(f"\nSANCTIONS ({len(sanctions)}):")
        for s in sanctions:
            line = f"  - {s.get('list_name')}"
            if s.get('date_listed'):
                line += f" (listed {s.get('date_listed')})"
            if s.get('citation'):
                line += f" [{s.get('citation')}]"
            lines.append(line)

    # BIS 50% Rule
    if bis50.get('captured'):
        lines.append(f"\nBIS 50% RULE: CAPTURED")
        lines.append(f"Reason: {bis50.get('reason', 'Ownership by listed entity')}")
        if bis50.get('ownership_chains'):
            for chain in bis50['ownership_chains']:
                chain_str = " -> ".join([f"{n['name']} ({p}%)" for n, p in zip(chain['chain'], chain['percentages'])])
                lines.append(f"  Chain: {chain_str}")
                lines.append(f"  Effective ownership: {chain['effective_percentage']}%")

    # Ownership network
    if network.get('edges'):
        lines.append(f"\nOWNERSHIP RELATIONSHIPS:")
        for edge in network['edges'][:10]:  # Limit to avoid context overflow
            source = next((n['name'] for n in network['nodes'] if n['id'] == edge['source']), edge['source'])
            target = next((n['name'] for n in network['nodes'] if n['id'] == edge['target']), edge['target'])
            if edge['type'] == 'OWNS':
                lines.append(f"  - {source} owns {edge.get('percentage', '?')}% of {target}")
            elif edge['type'] == 'CONTROLS':
                lines.append(f"  - {source} controls {target}")
            elif edge['type'] == 'OFFICER_OF':
                lines.append(f"  - {source} is {edge.get('role', 'officer')} of {target}")

    # Timeline events
    if timeline:
        lines.append(f"\nTIMELINE EVENTS ({len(timeline)}):")
        for event in sorted(timeline, key=lambda e: e.get('date', ''))[:10]:
            lines.append(f"  - {event.get('date')}: {event.get('title')}")
            if event.get('description'):
                lines.append(f"    {event.get('description')[:200]}")

    # Evasion patterns
    if patterns:
        lines.append(f"\nPOTENTIAL EVASION PATTERNS DETECTED:")
        for p in patterns:
            lines.append(f"  - [{p['severity'].upper()}] {p['description']}: {p['details']}")

    return "\n".join(lines)


def generate_template_narrative(entity: dict, bis50: dict, patterns: list) -> str:
    """Generate a basic template-based narrative when no API key is available."""
    name = entity.get('name_en', 'This entity')
    risk_score = entity.get('risk_score', 0)
    sanctions = entity.get('sanctions', [])
    risk_flags = entity.get('risk_flags', [])

    # Determine risk level
    if risk_score >= 90:
        risk_level = "critical export control risk"
    elif risk_score >= 70:
        risk_level = "high compliance risk"
    elif risk_score >= 50:
        risk_level = "moderate risk"
    else:
        risk_level = "lower risk but requires monitoring"

    parts = [f"{name} presents {risk_level} with a risk score of {risk_score}/100."]

    # Sanctions
    if sanctions:
        sanction_lists = [s.get('list_name') for s in sanctions]
        parts.append(f"The entity appears on {len(sanctions)} sanctions list(s): {', '.join(sanction_lists)}.")

        # Find earliest sanction date
        dates = [s.get('date_listed') for s in sanctions if s.get('date_listed')]
        if dates:
            earliest = min(dates)
            parts.append(f"First listed on {earliest}.")

    # Risk flags
    flag_descriptions = {
        'entity_list': 'BIS Entity List restrictions requiring export licenses',
        'meu_list': 'Military End User restrictions',
        'ns_cmic': 'Chinese Military-Industrial Complex designation prohibiting US investment',
        'cmc_1260h': 'Section 1260H Chinese Military Company designation',
        'xinjiang_uyghur': 'connections to Xinjiang surveillance or forced labor',
        'military_civil_fusion': 'participation in China\'s Military-Civil Fusion strategy',
        'central_soe': 'status as a central state-owned enterprise under SASAC',
    }
    notable_flags = [flag_descriptions.get(f) for f in risk_flags if f in flag_descriptions]
    if notable_flags:
        parts.append(f"Key risk indicators include: {'; '.join(notable_flags)}.")

    # BIS 50%
    if bis50.get('captured'):
        parts.append(f"Additionally, this entity is captured under the BIS 50% Rule due to ownership by listed parties, extending Entity List restrictions to its activities.")

    # Evasion patterns
    if patterns:
        high_patterns = [p for p in patterns if p['severity'] == 'high']
        if high_patterns:
            parts.append(f"Concerning patterns detected: {len(high_patterns)} high-severity indicator(s) of potential sanctions evasion activity, including corporate restructuring or ownership changes temporally correlated with sanctions listings.")

    parts.append("Enhanced due diligence is recommended before any business engagement.")

    return " ".join(parts)


def extract_sources(entity: dict, timeline: list) -> list[dict]:
    """Extract source citations from entity and timeline data."""
    sources = []

    # Sanctions sources
    for s in entity.get('sanctions', []):
        if s.get('citation'):
            sources.append({
                "type": "federal_register",
                "citation": s.get('citation'),
                "description": f"{s.get('list_name')} listing"
            })

    # Timeline sources
    for event in timeline:
        if event.get('source'):
            sources.append({
                "type": "timeline_event",
                "citation": event.get('source'),
                "description": event.get('title')
            })

    return sources
