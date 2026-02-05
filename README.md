# REDLINE

**China Corporate Intelligence Platform**

A knowledge graph-powered system for screening entities against sanctions lists, tracing ownership structures, and analyzing compliance risks. Built for investigative research into Chinese corporate networks.

```
┌─────────────────────────────────────────────────────────────────┐
│                        R E D L I N E                            │
│                      "Cross the Redline"                        │
└─────────────────────────────────────────────────────────────────┘
```

## Overview

Redline aggregates data from multiple sanctions and corporate registries into a Neo4j knowledge graph, enabling:

- **Entity Search** - Find companies, individuals, and government bodies with risk scoring
- **Batch Screening** - Screen multiple entities against 13+ sanctions lists simultaneously
- **Ownership Tracing** - Visualize corporate ownership chains and BIS 50% rule capture
- **Natural Language Chat** - Query the knowledge graph using plain English (Claude-powered)
- **Timeline Analysis** - Track entity restructuring and detect sanctions evasion patterns
- **Risk Narratives** - AI-generated investigative summaries for each entity

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                     │
│                     React + TypeScript + TailwindCSS                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Search  │  │ Screener │  │   Chat   │  │  Entity  │  │ Network  │   │
│  │   Page   │  │   Page   │  │   Page   │  │  Profile │  │   Graph  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │ HTTP/REST
                                ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                               API                                         │
│                        FastAPI + Python 3.13                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ /search  │  │ /screen  │  │  /chat   │  │ /entity  │  │/narrative│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                │                                          │
│                    ┌───────────┴───────────┐                             │
│                    ▼                       ▼                             │
│             ┌──────────┐            ┌──────────┐                         │
│             │  Claude  │            │  Neo4j   │                         │
│             │   API    │            │  Driver  │                         │
│             └──────────┘            └──────────┘                         │
└──────────────────────────────────────┬───────────────────────────────────┘
                                       │ Bolt Protocol
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           KNOWLEDGE GRAPH                                 │
│                              Neo4j 5.x                                    │
│                                                                          │
│   ┌─────────┐    OWNS     ┌─────────┐   SANCTIONED_AS   ┌─────────┐    │
│   │ Company │────────────▶│ Company │──────────────────▶│Sanction │    │
│   └─────────┘             └─────────┘                   │  Entry  │    │
│        │                       │                        └─────────┘    │
│        │ OFFICER_OF            │ CONTROLS                               │
│        ▼                       ▼                                        │
│   ┌─────────┐            ┌───────────┐                                 │
│   │ Person  │            │Government │                                 │
│   └─────────┘            │   Body    │                                 │
│                          └───────────┘                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

## Data Sources

| Source | Description | Lists Covered |
|--------|-------------|---------------|
| **CSL** | Consolidated Screening List (BIS) | Entity List, UVL, DPL, MEU, NS-CMIC |
| **OFAC SDN** | Specially Designated Nationals | SDN, Sectoral Sanctions |
| **OpenCorporates** | Corporate registry data | Company profiles, officers |
| **Manual Curation** | Hand-researched entities | CMC-1260H, ownership chains |

### Sanctions Lists Tracked

- **Entity List** - BIS export control restrictions
- **MEU List** - Military End-User restrictions
- **SDN List** - OFAC Specially Designated Nationals
- **NS-CMIC** - Non-SDN Chinese Military-Industrial Complex
- **CMC-1260H** - Chinese Military Companies (DoD)
- **UVL** - Unverified List
- **DPL** - Denied Persons List

## Key Features

### 1. Entity Search & Risk Scoring

Full-text search across all entities with computed risk scores based on:
- Direct sanctions list presence
- Ownership by sanctioned entities (BIS 50% rule)
- Sector classification (defense, semiconductors, surveillance)
- Government ownership (SASAC, CMC connections)

### 2. BIS 50% Rule Engine

Automatically identifies entities captured by the BIS 50% ownership rule:

```
If Entity A is on the Entity List and owns >50% of Entity B,
then Entity B is also subject to export controls.
```

The system traces ownership chains and flags captured entities.

### 3. Chat Interface (GraphRAG)

Natural language queries powered by Claude that translate to Cypher:

```
User: "Who are Huawei's subsidiaries?"

→ Claude generates: MATCH (h:Company {id:'huawei-001'})-[:OWNS]->(s) RETURN s

→ Returns: HiSilicon (100%), Huawei Cloud (100%), ...
```

### 4. Timeline Analysis

Tracks entity events over time and detects potential evasion patterns:

- **Restructuring near sanctions** - Corporate changes within 6 months of sanctions
- **Name changes after sanctions** - Rebranding following designation
- **Ownership transfers** - Spin-offs or transfers post-sanction

### 5. AI Risk Narratives

Claude-generated investigative summaries explaining why an entity is risky:

> "Huawei Technologies represents critical export control risk due to its presence on the Entity List since 2019, NS-CMIC designation, and CMC-1260H listing. The company's 100% ownership of HiSilicon triggers BIS 50% rule capture for subsidiaries..."

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, TailwindCSS, Vite |
| API | FastAPI, Python 3.13, Pydantic |
| Database | Neo4j 5.x (Graph Database) |
| AI | Claude API (Anthropic) |
| Deployment | Docker Compose |

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Anthropic API key (optional, for AI features)

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd redline
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your ANTHROPIC_API_KEY (optional)
   ```

3. **Start all services**
   ```bash
   docker compose up --build
   ```

4. **Access the application**
   - Frontend: http://localhost:5173
   - API Docs: http://localhost:8000/docs
   - Neo4j Browser: http://localhost:7474

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEO4J_URI` | Neo4j connection string | Yes |
| `NEO4J_USER` | Neo4j username | Yes |
| `NEO4J_PASSWORD` | Neo4j password | Yes |
| `ANTHROPIC_API_KEY` | Claude API key | No* |

*Without an API key, chat and narrative features fall back to template responses.

## API Endpoints

### Search & Screening

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search` | GET | Search entities by name |
| `/api/screen` | POST | Batch screen multiple entities |

### Entity Details

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/entity/{id}` | GET | Get entity profile |
| `/api/entity/{id}/network` | GET | Get ownership network |
| `/api/entity/{id}/bis50` | GET | Check BIS 50% capture |
| `/api/entity/{id}/timeline` | GET | Get timeline with pattern analysis |
| `/api/entity/{id}/narrative` | GET | Get AI risk narrative |

### Chat

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Natural language graph queries |

## Project Structure

```
redline/
├── api/                    # FastAPI backend
│   ├── main.py            # App entry point
│   ├── routers/           # API route handlers
│   │   ├── entities.py    # Entity endpoints
│   │   ├── screening.py   # Screening endpoints
│   │   └── chat.py        # Chat endpoint
│   └── services/          # Business logic
│       └── neo4j_service.py
│
├── frontend/              # React frontend
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # Shared components
│   │   └── services/     # API client
│   └── tailwind.config.js
│
├── data/
│   ├── manual/           # Curated entity data
│   └── raw/              # Downloaded source data
│
├── scripts/              # Data ingestion scripts
│
├── docker-compose.yml    # Container orchestration
└── README.md
```

## Graph Schema

### Node Types

| Label | Properties | Description |
|-------|------------|-------------|
| `Company` | id, name_en, name_cn, jurisdiction, risk_score | Corporate entities |
| `Person` | id, name_en, name_cn, nationality | Individuals |
| `GovernmentBody` | id, name_en, name_cn, country | Government agencies |
| `SanctionEntry` | id, list_name, date_added, program | Sanctions designations |

### Relationship Types

| Type | Description |
|------|-------------|
| `OWNS` | Ownership (with percentage property) |
| `CONTROLS` | Control relationship |
| `OFFICER_OF` | Person is officer of company |
| `SANCTIONED_AS` | Entity has sanction entry |

## Sample Queries

### Find all Entity List companies
```cypher
MATCH (c:Company)-[:SANCTIONED_AS]->(s:SanctionEntry)
WHERE s.list_name = 'Entity List'
RETURN c.name_en, s.date_added
```

### Trace ownership chain
```cypher
MATCH path = (parent:Company)-[:OWNS*1..3]->(child:Company)
WHERE parent.id = 'huawei-001'
RETURN path
```

### Find BIS 50% captured entities
```cypher
MATCH (parent:Company)-[o:OWNS]->(child:Company)
WHERE parent.risk_flags CONTAINS 'entity_list'
  AND o.percentage >= 50
RETURN child.name_en, parent.name_en, o.percentage
```

## Development

### Running locally (without Docker)

```bash
# Terminal 1: Start Neo4j
docker run -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/redline123 \
  neo4j:5

# Terminal 2: Start API
cd api
pip install -r requirements.txt
uvicorn main:app --reload

# Terminal 3: Start Frontend
cd frontend
npm install
npm run dev
```

### Loading sample data

```bash
# With services running
python scripts/load_data.py
```

## License

Proprietary - Demo purposes only.

---

Built with [Claude Code](https://claude.ai/claude-code)
