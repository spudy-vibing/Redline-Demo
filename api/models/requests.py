"""Request/Response models for API endpoints."""

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    """Search request parameters."""
    query: str = Field(..., min_length=1)
    limit: int = Field(20, ge=1, le=100)
    entity_type: str | None = None


class ScreenRequest(BaseModel):
    """Batch screening request."""
    entities: list[str] = Field(..., min_length=1, max_length=100)


class ChatRequest(BaseModel):
    """Chat/query request."""
    message: str = Field(..., min_length=1)
    conversation_id: str | None = None


class ChatResponse(BaseModel):
    """Chat response."""
    message: str
    sources: list[dict] = Field(default_factory=list)
    conversation_id: str
