"""
Entity API endpoints.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from ..services.neo4j_service import get_neo4j_service

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
    Get timeline of events for an entity.

    Includes sanctions additions/removals, corporate restructurings,
    name changes, and other significant events.
    """
    service = get_neo4j_service()

    try:
        events = service.get_entity_timeline(entity_id)
        return {
            "entity_id": entity_id,
            "events": events
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch timeline: {str(e)}")


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
