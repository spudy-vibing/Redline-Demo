"""Core entity models for WireScreen."""

from datetime import date
from typing import Optional
from pydantic import BaseModel, Field


class SanctionInfo(BaseModel):
    """Information about a sanctions listing."""
    list_name: str = Field(..., description="Name of sanctions list")
    program: Optional[str] = None
    date_listed: Optional[date] = None
    date_delisted: Optional[date] = None
    citation: Optional[str] = None


class EntityBase(BaseModel):
    """Base model for all entities."""
    id: str
    name_en: str
    name_cn: Optional[str] = None
    description: Optional[str] = None
    risk_flags: list[str] = Field(default_factory=list)


class Company(EntityBase):
    """Company entity model."""
    type: str = "company"
    uscc: Optional[str] = Field(None, description="Unified Social Credit Code (18 chars)")
    status: Optional[str] = None
    registered_capital: Optional[str] = None
    founded: Optional[date] = None
    jurisdiction: Optional[str] = None
    industry: Optional[str] = None
    sanctions: list[SanctionInfo] = Field(default_factory=list)
    bis_50_captured: bool = False
    bis_50_reason: Optional[str] = None
    risk_score: Optional[int] = Field(None, ge=0, le=100)


class Person(EntityBase):
    """Person entity model."""
    type: str = "person"
    pinyin: Optional[str] = None
    nationality: Optional[str] = None
    is_pep: bool = False
    sanctions: list[SanctionInfo] = Field(default_factory=list)


class GovernmentBody(EntityBase):
    """Government body entity model."""
    type: str = "government"
    level: Optional[str] = Field(None, description="central, provincial, municipal")
    body_type: Optional[str] = Field(None, description="military, regulatory, soe_parent")


class Relationship(BaseModel):
    """Relationship between entities."""
    from_id: str = Field(..., alias="from")
    to_id: str = Field(..., alias="to")
    type: str = Field(..., description="OWNS, OFFICER_OF, CONTROLS, SANCTIONED_AS")
    percentage: Optional[float] = Field(None, ge=0, le=100)
    role: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    control_type: Optional[str] = None
    source: Optional[str] = None

    class Config:
        populate_by_name = True


class EntitySearchResult(BaseModel):
    """Search result for an entity."""
    id: str
    name_en: str
    name_cn: Optional[str] = None
    type: str
    risk_flags: list[str] = Field(default_factory=list)
    jurisdiction: Optional[str] = None
    score: float = 0.0


class NetworkNode(BaseModel):
    """Node in a network graph."""
    id: str
    name: str
    type: str
    risk_flags: list[str] = Field(default_factory=list)
    bis_50_captured: bool = False


class NetworkEdge(BaseModel):
    """Edge in a network graph."""
    source: str
    target: str
    type: str
    percentage: Optional[float] = None
    role: Optional[str] = None


class NetworkGraph(BaseModel):
    """Network graph response."""
    nodes: list[NetworkNode]
    edges: list[NetworkEdge]
    center_id: str


class BIS50Result(BaseModel):
    """Result of BIS 50% rule check."""
    entity_id: str
    entity_name: str
    captured: bool
    reason: Optional[str] = None
    ownership_chains: list[dict] = Field(default_factory=list)
    aggregate_percentage: Optional[float] = None


class ScreeningResult(BaseModel):
    """Result of screening an entity."""
    input_name: str
    matched_entity: Optional[EntitySearchResult] = None
    match_score: float = 0.0
    risk_level: str = "unknown"  # critical, high, medium, low, clear
    flags: list[str] = Field(default_factory=list)
    bis_50_captured: bool = False
    details: Optional[str] = None
