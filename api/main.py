"""
WireScreen API - China Corporate Intelligence Platform

FastAPI backend providing:
- Entity search and profiles
- Network graph data
- BIS 50% rule analysis
- Batch screening
- Risk narrative generation (coming soon)
- GraphRAG chat interface (coming soon)
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers import entities, screening, chat
from services.neo4j_service import get_neo4j_service

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    # Startup: verify Neo4j connection
    try:
        service = get_neo4j_service()
        with service.session() as session:
            session.run("RETURN 1")
        print("Connected to Neo4j")
    except Exception as e:
        print(f"Warning: Could not connect to Neo4j: {e}")
        print("API will start but database features may not work")

    yield

    # Shutdown: close connections
    try:
        service = get_neo4j_service()
        service.close()
    except Exception:
        pass


app = FastAPI(
    title="WireScreen API",
    description="China Corporate Intelligence Platform - Sanctions screening, ownership analysis, and risk assessment",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://redline-demo.vercel.app",
        "https://redline-demo-git-main-spudy-vibings-projects.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(entities.router)
app.include_router(screening.router)
app.include_router(chat.router)


@app.get("/")
async def root():
    """API root - basic info."""
    return {
        "name": "WireScreen API",
        "version": "0.1.0",
        "description": "China Corporate Intelligence Platform",
        "endpoints": {
            "search": "/api/search?q={query}",
            "entity": "/api/entity/{id}",
            "network": "/api/entity/{id}/network",
            "bis50": "/api/entity/{id}/bis50",
            "timeline": "/api/entity/{id}/timeline",
            "narrative": "/api/entity/{id}/narrative",
            "screen": "POST /api/screen",
            "chat": "POST /api/chat",
        }
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    # Check Neo4j connection
    try:
        service = get_neo4j_service()
        with service.session() as session:
            session.run("RETURN 1")
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy",
        "database": db_status
    }
