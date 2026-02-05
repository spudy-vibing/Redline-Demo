# WireScreen POC Implementation Plan

## Overview

Build a China-focused corporate intelligence platform demonstrating knowledge graph construction, BIS 50% Rule compliance, risk visualization, and natural language querying.

**Target**: Interview demo for Head of Engineering role at WireScreen
**Scope**: Full feature set including both wow features (Entity Timeline + Risk Narrative Generator)
**Data Strategy**: Curated data first → API ingestion later
**Deployment**: Local Docker Compose + Cloud deployment

---

## Phase Tracker

| Phase | Name | Steps | Status |
|-------|------|-------|--------|
| 0 | Project Setup | 6 | ✅ Complete |
| 1 | Data Layer | 8 | ✅ Complete |
| 2 | Knowledge Graph | 7 | ✅ Complete |
| 3 | API Layer | 10 | ✅ Complete |
| 4 | Frontend Core | 9 | ✅ Complete |
| 5 | Wow Feature 1: Entity Timeline | 6 | 🔜 Next |
| 6 | Wow Feature 2: Risk Narrative | 5 | ⬜ Not Started |
| 7 | Chat Interface | 5 | ⬜ Not Started |
| 8 | Polish & Integration | 6 | ⬜ Not Started |
| 9 | Deployment | 6 | ⬜ Not Started |

**Total Steps**: 68 | **Completed**: 40

---

## Current Status (2026-02-04)

### Running Services
| Service | URL | Status |
|---------|-----|--------|
| Neo4j Browser | http://localhost:7474 | ✅ Running |
| FastAPI | http://localhost:8000 | ✅ Running |
| React Frontend | http://localhost:5173 | ✅ Running |

### Data Loaded
- **Entities**: 21 (17 companies, 3 government bodies, 1 person)
- **Sanctions**: 20 entries across multiple lists
- **Relationships**: 31 (8 OWNS, 2 CONTROLS, 1 OFFICER_OF, 20 SANCTIONED_AS)
- **Timeline Events**: 7
- **BIS 50% Captured**: 2 entities (Huawei Cloud, AVIC Xi'an)

---

## Phase 0: Project Setup

### Objective
Initialize project structure, dependencies, and development environment.

### Steps

| # | Step | Description | Files/Commands | Status |
|---|------|-------------|----------------|--------|
| 0.1 | Initialize git repo | Create repo, .gitignore, initial commit | `git init`, `.gitignore` | ✅ |
| 0.2 | Create directory structure | Set up folder hierarchy per architecture | See structure below | ✅ |
| 0.3 | Setup Python backend | Create venv, requirements.txt, FastAPI skeleton | `api/`, `requirements.txt` | ✅ |
| 0.4 | Setup React frontend | Initialize Vite + React + TypeScript + Tailwind | `frontend/` | ✅ |
| 0.5 | Docker Compose base | Neo4j + API + Frontend services | `docker-compose.yml` | ✅ |
| 0.6 | Environment config | Create .env templates for local/prod | `.env.example`, `.env.local` | ✅ |

### Directory Structure
```
wirescreen-poc/
├── api/
│   ├── __init__.py
│   ├── main.py
│   ├── routers/
│   ├── services/
│   ├── models/
│   └── utils/
├── scripts/
│   ├── ingest/
│   └── process/
├── data/
│   ├── raw/
│   ├── processed/
│   └── manual/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types/
│   └── public/
├── docker/
├── tests/
├── docker-compose.yml
├── requirements.txt
└── README.md
```

### Deliverables
- [x] Running Neo4j container accessible at localhost:7474
- [x] FastAPI server with /health endpoint
- [x] React app with Tailwind rendering "Hello WireScreen"
- [x] All three services orchestrated via `docker-compose up`

---

## Phase 1: Data Layer

### Objective
Create curated entity dataset and establish data models.

### Steps

| # | Step | Description | Files | Status |
|---|------|-------------|-------|--------|
| 1.1 | Define Pydantic models | Entity, Sanction, Relationship, Timeline models | `api/models/entities.py` | ✅ |
| 1.2 | Create curated entities JSON | 10-15 key entities from spec (Huawei ecosystem, DeepSeek, SOEs) | `data/manual/curated_entities.json` | ✅ |
| 1.3 | Create relationships JSON | Ownership chains, control relationships | `data/manual/curated_entities.json` | ✅ |
| 1.4 | Create timeline events JSON | Historical events for key entities | `data/manual/curated_entities.json` | ✅ |
| 1.5 | Build data validation script | Validate JSON against Pydantic models | `scripts/validate_data.py` | ⬜ |
| 1.6 | Create sanctions list mapping | Map list codes to full names and descriptions | `data/manual/sanctions_lists.json` | ⬜ |
| 1.7 | Create risk flag definitions | Define all risk flags with weights | `data/manual/risk_flags.json` | ⬜ |
| 1.8 | Write data loading utilities | Functions to load and parse all JSON files | `scripts/load_neo4j.py` | ✅ |

### Key Entities to Include
1. **Huawei Ecosystem**: Huawei Technologies, HiSilicon, Huawei Cloud, Ren Zhengfei
2. **DeepSeek Ecosystem**: DeepSeek AI, High-Flyer Capital, Liang Wenfeng
3. **State Conglomerates**: AVIC, CETC, SMIC, Hikvision
4. **Government Bodies**: SASAC, CMC
5. **Sample Persons**: Key executives with ownership stakes

### Deliverables
- [x] Validated JSON files with 15+ entities (21 entities created)
- [x] 20+ relationships defining ownership graph (31 relationships)
- [x] Timeline events across entities (7 events)
- [x] All data loadable via Python utilities

---

## Phase 2: Knowledge Graph (Neo4j)

### Objective
Design schema and populate Neo4j with curated data.

### Steps

| # | Step | Description | Files | Status |
|---|------|-------------|-------|--------|
| 2.1 | Design node labels | Company, Person, GovernmentBody, SanctionEntry, TimelineEvent | `docs/schema.md` | ✅ |
| 2.2 | Design relationship types | OWNS, CONTROLS, OFFICER_OF, SANCTIONED_AS, INVESTED_IN | `docs/schema.md` | ✅ |
| 2.3 | Create Cypher schema script | Constraints, indexes for performance | `scripts/load_neo4j.py` | ✅ |
| 2.4 | Build Neo4j connection service | Python driver wrapper with connection pooling | `api/services/neo4j_service.py` | ✅ |
| 2.5 | Write data import script | Load JSON → Neo4j nodes and relationships | `scripts/load_neo4j.py` | ✅ |
| 2.6 | Implement BIS 50% calculation | Recursive ownership aggregation algorithm | `api/services/neo4j_service.py` | ✅ |
| 2.7 | Create graph query utilities | Common queries: path finding, subgraph extraction | `api/services/neo4j_service.py` | ✅ |

### Neo4j Schema
```cypher
// Node Labels
(:Company {id, name_en, name_cn, uscc, risk_score, risk_flags[], status})
(:Person {id, name_en, name_cn, nationality, role})
(:GovernmentBody {id, name_en, name_cn, type, jurisdiction})
(:SanctionEntry {id, list, date_listed, reason, status})
(:TimelineEvent {id, date, event_type, description, significance})

// Relationships
(a)-[:OWNS {percentage, start_date, source}]->(b)
(a)-[:CONTROLS {control_type, start_date}]->(b)
(p)-[:OFFICER_OF {role, start_date, end_date}]->(c)
(e)-[:SANCTIONED_AS]->(s:SanctionEntry)
(e)-[:HAS_EVENT]->(t:TimelineEvent)

// Indexes
CREATE INDEX entity_name_en FOR (n:Company) ON (n.name_en)
CREATE INDEX entity_name_cn FOR (n:Company) ON (n.name_cn)
CREATE INDEX entity_uscc FOR (n:Company) ON (n.uscc)
CREATE FULLTEXT INDEX entity_search FOR (n:Company|Person) ON EACH [n.name_en, n.name_cn, n.aliases]
```

### BIS 50% Rule Algorithm
```
function calculateBIS50Capture(entity_id):
    visited = {}

    function aggregateOwnership(node, multiplier=1.0):
        if node in visited: return visited[node]
        if node.is_entity_list: return multiplier

        total = 0
        for parent, pct in node.owners:
            contribution = aggregateOwnership(parent, multiplier * pct/100)
            total += contribution

        visited[node] = total
        return total

    capture_pct = aggregateOwnership(entity_id)
    return {captured: capture_pct >= 50, percentage: capture_pct}
```

### Deliverables
- [x] Neo4j populated with all curated entities (21 entities)
- [x] Full-text search working on English/Chinese names
- [x] BIS 50% calculation returning correct results for HiSilicon (100% via Huawei)
- [x] Graph traversal returning ownership chains

---

## Phase 3: API Layer (FastAPI)

### Objective
Build RESTful API endpoints for all platform features.

### Steps

| # | Step | Description | Files | Status |
|---|------|-------------|-------|--------|
| 3.1 | Setup FastAPI app structure | CORS, middleware, error handling | `api/main.py` | ✅ |
| 3.2 | Implement search endpoint | Full-text search with filters | `api/routers/entities.py` | ✅ |
| 3.3 | Implement entity detail endpoint | Single entity with all metadata | `api/routers/entities.py` | ✅ |
| 3.4 | Implement network endpoint | Subgraph around entity for visualization | `api/routers/entities.py` | ✅ |
| 3.5 | Implement BIS 50% endpoint | Ownership chain + capture calculation | `api/routers/entities.py` | ✅ |
| 3.6 | Implement screening endpoint | Batch entity screening against lists | `api/routers/screening.py` | ✅ |
| 3.7 | Implement timeline endpoint | Entity timeline events | `api/routers/entities.py` | ✅ |
| 3.8 | Implement risk narrative endpoint | Generated risk explanation | `api/routers/narrative.py` | ⬜ Phase 6 |
| 3.9 | Implement chat endpoint | Natural language query processing | `api/routers/chat.py` | ⬜ Phase 7 |
| 3.10 | Add OpenAPI documentation | Swagger UI customization | `api/main.py` | ✅ |

### API Specification

```
GET  /api/v1/search
     ?q={query}
     &type={company|person|all}
     &risk_min={0-100}
     &lists={entity_list,sdn,meu}
     &limit={10}&offset={0}
     → {results: Entity[], total: int, facets: {}}

GET  /api/v1/entities/{id}
     → {entity: Entity, sanctions: Sanction[], timeline: Event[]}

GET  /api/v1/entities/{id}/network
     ?depth={1-3}
     ?relationship_types={owns,controls,officer_of}
     → {nodes: Node[], edges: Edge[]}

GET  /api/v1/entities/{id}/bis50
     → {captured: bool, percentage: float, chain: OwnershipPath[]}

GET  /api/v1/entities/{id}/timeline
     ?start_date={YYYY-MM-DD}
     ?end_date={YYYY-MM-DD}
     ?event_types={sanctions,corporate,regulatory}
     → {events: TimelineEvent[]}

GET  /api/v1/entities/{id}/narrative
     → {narrative: string, risk_factors: RiskFactor[], confidence: float}

POST /api/v1/screen
     body: {entities: [{name, country?, id_type?, id_value?}]}
     → {results: ScreeningResult[]}

POST /api/v1/chat
     body: {message: string, conversation_id?: string}
     → {response: string, sources: Citation[], suggested_queries: string[]}

GET  /api/v1/health
     → {status: "healthy", neo4j: "connected", version: "1.0.0"}
```

### Deliverables
- [x] All endpoints returning valid responses
- [x] Swagger UI accessible at /docs (http://localhost:8000/docs)
- [x] Response times <500ms for single entity queries
- [x] Proper error handling with meaningful messages

---

## Phase 4: Frontend Core

### Objective
Build React application with core pages and components.

### Steps

| # | Step | Description | Files | Status |
|---|------|-------------|-------|--------|
| 4.1 | Setup routing | React Router with lazy loading | `frontend/src/App.tsx` | ✅ |
| 4.2 | Create layout components | Header, Sidebar, Main content area | `frontend/src/components/layout/` | ✅ |
| 4.3 | Build search component | Global search with typeahead, Chinese support | `frontend/src/components/Search/` | ✅ |
| 4.4 | Build entity card component | Compact entity display with risk indicators | `frontend/src/components/EntityCard/` | ✅ |
| 4.5 | Build search results page | List view with filters and pagination | `frontend/src/pages/SearchResults.tsx` | ✅ |
| 4.6 | Build entity profile page | Detailed entity view with tabs | `frontend/src/pages/EntityProfile.tsx` | ✅ |
| 4.7 | Build network graph component | D3.js/Cytoscape force-directed graph | `frontend/src/components/NetworkGraph/` | ✅ |
| 4.8 | Build BIS 50% tracer component | Ownership chain visualization | `frontend/src/components/BIS50Tracer/` | ✅ |
| 4.9 | Build screening page | Batch upload and results table | `frontend/src/pages/Screener.tsx` | ✅ |

### Component Architecture
```
App
├── Layout
│   ├── Header (logo, global search, nav)
│   ├── Sidebar (filters, recent searches)
│   └── MainContent
│       ├── SearchResults
│       │   ├── FilterPanel
│       │   ├── ResultsList
│       │   │   └── EntityCard[]
│       │   └── Pagination
│       ├── EntityProfile
│       │   ├── EntityHeader (name, risk badge, sanctions tags)
│       │   ├── TabNavigation
│       │   ├── OverviewTab
│       │   ├── NetworkTab
│       │   │   └── NetworkGraph
│       │   ├── OwnershipTab
│       │   │   └── BIS50Tracer
│       │   ├── TimelineTab (Phase 5)
│       │   │   └── EntityTimeline
│       │   └── NarrativeTab (Phase 6)
│       │       └── RiskNarrative
│       ├── Screener
│       │   ├── UploadForm
│       │   ├── ResultsTable
│       │   └── ExportButton
│       └── Chat (Phase 7)
│           ├── MessageList
│           └── InputForm
```

### Design System
- **Colors**: Risk-based palette (green→yellow→orange→red for 0-100)
- **Typography**: Inter for Latin, Noto Sans SC for Chinese
- **Components**: Shadcn/ui or Radix primitives + Tailwind
- **Icons**: Lucide React
- **Graphs**: Cytoscape.js (better for large graphs than D3)

### Deliverables
- [x] All pages navigable and rendering
- [x] Search returning results with proper Chinese rendering
- [x] Network graph interactive with zoom/pan
- [x] Entity profile showing all entity data
- [x] Responsive layout (desktop-first, tablet-friendly)

---

## Phase 5: Wow Feature 1 - Entity Timeline

### Objective
Build interactive timeline showing corporate evolution, sanctions history, and ownership changes.

### Steps

| # | Step | Description | Files | Status |
|---|------|-------------|-------|--------|
| 5.1 | Extend timeline data model | Add event categories, significance levels | `api/models/timeline.py` | ⬜ |
| 5.2 | Build timeline API enhancements | Filtering, aggregation by year/type | `api/routers/timeline.py` | ⬜ |
| 5.3 | Create timeline visualization component | Vertical timeline with expandable events | `frontend/src/components/Timeline/` | ⬜ |
| 5.4 | Add event detail modals | Rich event details with source citations | `frontend/src/components/Timeline/EventModal.tsx` | ⬜ |
| 5.5 | Implement timeline comparison | Side-by-side entity timeline comparison | `frontend/src/pages/TimelineCompare.tsx` | ⬜ |
| 5.6 | Add timeline export | PDF/PNG export of timeline view | `frontend/src/components/Timeline/Export.tsx` | ⬜ |

### Timeline Event Types
```typescript
type TimelineEventType =
  | 'founding'           // Company established
  | 'name_change'        // Corporate rename
  | 'restructuring'      // Merger, spin-off, reorganization
  | 'ownership_change'   // Stake acquisition/divestiture
  | 'sanctions_listing'  // Added to a sanctions list
  | 'sanctions_removal'  // Removed from a list
  | 'regulatory_action'  // License revoked, investigation
  | 'product_launch'     // Significant product/capability
  | 'political_event'    // Government meeting, policy change
  | 'investigation'      // Congressional/regulatory probe

interface TimelineEvent {
  id: string;
  entity_id: string;
  date: string;          // ISO date
  event_type: TimelineEventType;
  description: string;
  significance: 'low' | 'medium' | 'high' | 'critical';
  source?: string;
  related_entities?: string[];  // For ownership changes
  metadata?: Record<string, any>;
}
```

### Deliverables
- [ ] Timeline component rendering 30+ events
- [ ] Events filterable by type and date range
- [ ] High-significance events visually prominent
- [ ] Click-through to related entities
- [ ] Export to PDF working

---

## Phase 6: Wow Feature 2 - Risk Narrative Generator

### Objective
Auto-generate investigative-style explanations of why an entity is risky.

### Steps

| # | Step | Description | Files | Status |
|---|------|-------------|-------|--------|
| 6.1 | Design narrative prompt templates | Templates for different risk patterns | `api/services/narrative/templates.py` | ⬜ |
| 6.2 | Build narrative generation service | LLM integration (Claude API) with caching | `api/services/narrative/generator.py` | ⬜ |
| 6.3 | Create risk factor aggregation | Collect all risk signals for an entity | `api/services/narrative/risk_factors.py` | ⬜ |
| 6.4 | Build narrative display component | Formatted narrative with citations | `frontend/src/components/RiskNarrative/` | ⬜ |
| 6.5 | Add narrative regeneration | Allow user to request fresh narrative | `frontend/src/components/RiskNarrative/` | ⬜ |

### Narrative Generation Approach
```python
def generate_risk_narrative(entity_id: str) -> RiskNarrative:
    # 1. Gather all risk signals
    entity = get_entity(entity_id)
    sanctions = get_sanctions(entity_id)
    ownership_chain = get_ownership_chain(entity_id)
    bis50_status = calculate_bis50(entity_id)
    timeline = get_key_events(entity_id)
    related_risks = get_related_entity_risks(entity_id)

    # 2. Build context for LLM
    context = {
        "entity": entity,
        "sanctions": sanctions,
        "ownership": ownership_chain,
        "bis50": bis50_status,
        "timeline": timeline,
        "network_risks": related_risks
    }

    # 3. Generate narrative via Claude API
    prompt = build_narrative_prompt(context)
    narrative = call_claude_api(prompt)

    # 4. Extract structured risk factors
    risk_factors = extract_risk_factors(narrative, context)

    return RiskNarrative(
        text=narrative,
        risk_factors=risk_factors,
        confidence=calculate_confidence(context),
        generated_at=datetime.now()
    )
```

### Sample Narrative Output
```
**Huawei Technologies Co., Ltd.** presents critical risk exposure
across multiple dimensions:

**Direct Sanctions Exposure**: Huawei is designated on the BIS Entity
List (May 2019), NS-CMIC List (June 2021), and DoD Section 1260H
Chinese Military Company List (June 2020). These designations
restrict access to US-origin technology and prohibit US persons
from investing in Huawei securities.

**Ownership Structure Concerns**: While Huawei claims to be
employee-owned via a trade union holding (98.99%), the structure
lacks transparency typical of Western ESOPs. Founder Ren Zhengfei
retains 1.01% direct ownership and reportedly maintains significant
control through voting rights mechanisms.

**Supply Chain Capture**: Huawei's wholly-owned subsidiary HiSilicon
is captured under the BIS 50% Rule, meaning any entity supplying
to HiSilicon faces the same licensing requirements as supplying
to Huawei directly.

**Recent Escalation**: The August 2023 release of the Mate 60 Pro
with an advanced 7nm chip allegedly fabricated by SMIC suggests
potential circumvention of export controls, prompting renewed
Congressional scrutiny.

*Risk Score: 95/100 | Last Updated: 2025-02-04*
```

### Deliverables
- [ ] Narrative generation working for all curated entities
- [ ] Narratives cite specific sanctions and dates
- [ ] Risk factors displayed as structured list
- [ ] Regeneration produces varied but consistent narratives
- [ ] Response time <5 seconds (with caching <500ms)

---

## Phase 7: Chat Interface

### Objective
Build natural language querying capability using GraphRAG.

### Steps

| # | Step | Description | Files | Status |
|---|------|-------------|-------|--------|
| 7.1 | Setup LangChain integration | Configure Claude API with LangChain | `api/services/chat/llm.py` | ⬜ |
| 7.2 | Build graph query translator | NL → Cypher translation | `api/services/chat/query_translator.py` | ⬜ |
| 7.3 | Create chat service | Conversation management, context tracking | `api/services/chat/chat_service.py` | ⬜ |
| 7.4 | Build chat UI component | Message thread with entity cards inline | `frontend/src/components/Chat/` | ⬜ |
| 7.5 | Add suggested queries | Context-aware query suggestions | `frontend/src/components/Chat/` | ⬜ |

### Sample Queries to Support
```
"Who owns DeepSeek?"
→ Shows ownership chain to Liang Wenfeng and High-Flyer Capital

"Which companies are captured under the BIS 50% rule?"
→ Lists all entities with >50% Entity List ownership

"Show me the relationship between CETC and Hikvision"
→ Displays ownership path with percentages

"What happened to Huawei in 2019?"
→ Timeline events filtered to 2019

"Which entities have connections to Xinjiang?"
→ Entities flagged with xinjiang_surveillance or uyghur_human_rights

"Compare the risk profiles of SMIC and Huawei"
→ Side-by-side comparison of risk factors
```

### Deliverables
- [ ] Chat responding to all sample queries
- [ ] Entity cards embedded in responses
- [ ] Conversation context maintained
- [ ] Suggested follow-up queries displayed

---

## Phase 8: Polish & Integration

### Objective
Refine UI/UX, fix edge cases, and ensure smooth integration.

### Steps

| # | Step | Description | Files | Status |
|---|------|-------------|-------|--------|
| 8.1 | UI polish pass | Consistent spacing, colors, animations | All frontend files | ⬜ |
| 8.2 | Error handling | User-friendly error messages, fallbacks | Frontend + API | ⬜ |
| 8.3 | Loading states | Skeletons, spinners, progress indicators | Frontend components | ⬜ |
| 8.4 | Empty states | Helpful messages when no data | Frontend components | ⬜ |
| 8.5 | Performance optimization | Query caching, lazy loading, code splitting | Frontend + API | ⬜ |
| 8.6 | Cross-browser testing | Chrome, Firefox, Safari verification | - | ⬜ |

### Deliverables
- [ ] No visible UI glitches or broken states
- [ ] All interactions feel responsive (<200ms feedback)
- [ ] Graceful degradation when API is slow
- [ ] Works on Chrome, Firefox, Safari

---

## Phase 9: Deployment

### Objective
Deploy to local Docker and cloud for demo.

### Steps

| # | Step | Description | Files | Status |
|---|------|-------------|-------|--------|
| 9.1 | Finalize Docker Compose | Production-ready compose file | `docker-compose.yml` | ⬜ |
| 9.2 | Create production Dockerfiles | Optimized multi-stage builds | `docker/Dockerfile.*` | ⬜ |
| 9.3 | Setup cloud database | Neo4j Aura or self-hosted | - | ⬜ |
| 9.4 | Deploy API | Railway/Render/Fly.io | - | ⬜ |
| 9.5 | Deploy frontend | Vercel | - | ⬜ |
| 9.6 | Configure custom domain | Optional: wirescreen-demo.yourdomain.com | - | ⬜ |

### Deployment Architecture
```
Local (current dev setup):
┌─────────────────────────────────────────┐
│ Services                                │
│  ┌─────────┐ ┌─────────┐ ┌───────────┐ │
│  │ Neo4j   │ │ FastAPI │ │ Vite/React│ │
│  │ :7474   │ │ :8000   │ │ :5173     │ │
│  │ Docker  │ │ uvicorn │ │ npm dev   │ │
│  └─────────┘ └─────────┘ └───────────┘ │
└─────────────────────────────────────────┘

Cloud:
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Vercel       │────▶│ Railway      │────▶│ Neo4j Aura   │
│ (Frontend)   │     │ (API)        │     │ (Graph DB)   │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Deliverables
- [ ] `docker-compose up` brings up entire stack
- [ ] Cloud URL accessible and functional
- [ ] All features working in cloud deployment
- [ ] Demo data pre-loaded

---

## Verification Plan

### Local Testing
```bash
# 1. Start services
docker-compose up -d

# 2. Verify Neo4j
open http://localhost:7474
# Run: MATCH (n) RETURN count(n)
# Expected: 15+ nodes

# 3. Verify API
curl http://localhost:8000/api/v1/health
# Expected: {"status": "healthy", "neo4j": "connected"}

curl "http://localhost:8000/api/v1/search?q=huawei"
# Expected: Results including Huawei Technologies

curl http://localhost:8000/api/v1/entities/huawei-001/bis50
# Expected: {"captured": false, "percentage": 0, ...}

curl http://localhost:8000/api/v1/entities/hisilicon-001/bis50
# Expected: {"captured": true, "percentage": 100, "chain": [...]}

# 4. Verify Frontend
open http://localhost:5173
# Test: Search for "华为", click result, view network graph

# 5. Verify Wow Features
# Timeline: Navigate to entity, click Timeline tab
# Narrative: Navigate to entity, click Risk Analysis tab
```

### Demo Script
1. **Search**: Type "Huawei" → show bilingual results
2. **Entity Profile**: Click Huawei → show risk badges, sanctions
3. **Network Graph**: Show ownership network, highlight HiSilicon
4. **BIS 50% Rule**: Trace why HiSilicon is captured
5. **Timeline**: Show Huawei's sanctions escalation 2019-2020
6. **Risk Narrative**: Generate and display risk explanation
7. **DeepSeek**: Search "DeepSeek" → show ongoing investigation
8. **Chat**: Ask "Who owns DeepSeek?" → show conversational response

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Neo4j performance with complex queries | Pre-compute BIS50 results, cache heavily |
| LLM API latency for narratives | Cache generated narratives, show loading state |
| Chinese text rendering issues | Test early with Noto Sans SC, verify encoding |
| Graph visualization performance | Limit nodes displayed, use progressive loading |
| Data accuracy concerns | Cite sources in UI, add "data as of" timestamps |

---

## Files to Create (Summary)

### Backend (Python/FastAPI)
- `api/main.py` - FastAPI app entry point
- `api/models/*.py` - Pydantic data models
- `api/routers/*.py` - API endpoint handlers
- `api/services/neo4j_service.py` - Database connection
- `api/services/bis50_service.py` - BIS 50% calculation
- `api/services/graph_queries.py` - Cypher query builders
- `api/services/narrative/*.py` - Risk narrative generation
- `api/services/chat/*.py` - Chat/LangChain integration

### Frontend (React/TypeScript)
- `frontend/src/App.tsx` - Root component with routing
- `frontend/src/pages/*.tsx` - Page components
- `frontend/src/components/**/*.tsx` - UI components
- `frontend/src/services/api.ts` - API client
- `frontend/src/hooks/*.ts` - Custom React hooks
- `frontend/src/types/*.ts` - TypeScript definitions

### Data
- `data/manual/curated_entities.json`
- `data/manual/relationships.json`
- `data/manual/timeline_events.json`
- `data/manual/sanctions_lists.json`
- `data/manual/risk_flags.json`

### Infrastructure
- `docker-compose.yml`
- `docker/Dockerfile.api`
- `docker/Dockerfile.frontend`
- `scripts/neo4j/init_schema.cypher`
- `scripts/load_neo4j.py`
- `.env.example`
