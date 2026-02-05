"""
Screening API endpoints.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.neo4j_service import get_neo4j_service

router = APIRouter(prefix="/api", tags=["screening"])


class ScreenRequest(BaseModel):
    """Request body for batch screening."""
    entities: list[str] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="List of entity names to screen"
    )


class ScreenResult(BaseModel):
    """Individual screening result."""
    input_name: str
    matched_entity: dict | None
    match_score: float
    risk_level: str
    flags: list[str]
    bis_50_captured: bool
    details: str | None = None


class ScreenResponse(BaseModel):
    """Response for batch screening."""
    screened_count: int
    high_risk_count: int
    results: list[ScreenResult]
    summary: dict


@router.post("/screen", response_model=ScreenResponse)
async def screen_entities(request: ScreenRequest):
    """
    Screen multiple entities against sanctions and restricted party lists.

    Checks each entity name against:
    - BIS Entity List
    - OFAC SDN List
    - Military End User (MEU) List
    - NS-CMIC List
    - BIS 50% Rule (ownership-based capture)

    Risk levels:
    - critical: Directly on Entity List or SDN
    - high: On NS-CMIC, CMC-1260H, or BIS 50% captured
    - medium: Risk score 70-89
    - low: Risk score 40-69
    - clear: Risk score below 40 or no match
    - unknown: No match found in database
    """
    service = get_neo4j_service()

    try:
        results = service.screen_entities(request.entities)

        # Calculate summary statistics
        risk_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "clear": 0, "unknown": 0}
        for r in results:
            risk_level = r.get("risk_level", "unknown")
            risk_counts[risk_level] = risk_counts.get(risk_level, 0) + 1

        high_risk_count = risk_counts["critical"] + risk_counts["high"]

        # Add details to results
        detailed_results = []
        for r in results:
            risk_level = r.get("risk_level", "unknown")
            flags = r.get("flags", [])

            # Generate details text
            if risk_level == "critical":
                details = "BLOCKED - Entity is on BIS Entity List or OFAC SDN. All transactions prohibited."
            elif risk_level == "high" and r.get("bis_50_captured"):
                details = "HIGH RISK - Entity captured by BIS 50% Rule through ownership by listed party."
            elif risk_level == "high":
                details = "HIGH RISK - Entity on NS-CMIC or CMC-1260H list. Investment restrictions apply."
            elif risk_level == "medium":
                details = "ELEVATED RISK - Enhanced due diligence recommended."
            elif risk_level == "low":
                details = "LOW RISK - Standard due diligence recommended."
            elif risk_level == "clear":
                details = "CLEAR - No significant risk indicators found."
            else:
                details = "UNKNOWN - Entity not found in database. Manual review required."

            detailed_results.append({
                **r,
                "details": details
            })

        return ScreenResponse(
            screened_count=len(results),
            high_risk_count=high_risk_count,
            results=detailed_results,
            summary={
                "by_risk_level": risk_counts,
                "requires_action": high_risk_count,
                "unknown_entities": risk_counts["unknown"]
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Screening failed: {str(e)}")


@router.post("/screen/quick")
async def quick_screen(name: str):
    """
    Quick screen a single entity name.

    Faster than batch screening for single lookups.
    """
    service = get_neo4j_service()

    try:
        results = service.screen_entities([name])
        if results:
            return results[0]
        return {
            "input_name": name,
            "matched_entity": None,
            "match_score": 0.0,
            "risk_level": "unknown",
            "flags": [],
            "bis_50_captured": False,
            "details": "No match found"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quick screen failed: {str(e)}")
