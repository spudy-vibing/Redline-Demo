# WireScreen-Style OSINT Platform — POC Specification

## Project Overview

Build a working prototype of a China-focused corporate intelligence platform that demonstrates:
- Knowledge graph construction from real sanctions and corporate data
- Interactive ownership chain visualization
- BIS 50% Rule compliance computation
- Risk flag propagation through ownership networks
- Natural language querying via GraphRAG
- **Entity Evolution Timeline** — Track corporate restructurings, name changes, and ownership shifts over time (key for sanctions evasion detection)
- **Risk Narrative Generator** — Auto-generate investigative-style explanations of WHY an entity is risky

This POC is designed to be demo-ready for an interview at WireScreen for the Head of Engineering role.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         INGESTION                                │
├─────────────────────────────────────────────────────────────────┤
│  scripts/ingest/                                                 │
│  ├── fetch_csl.py         → US Consolidated Screening List      │
│  ├── fetch_ofac_sdn.py    → OFAC SDN XML with ownership remarks │
│  ├── fetch_opencorp.py    → OpenCorporates company lookups      │
│  └── manual_entities.json → Hand-researched ownership chains    │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        PROCESSING                                │
├─────────────────────────────────────────────────────────────────┤
│  scripts/process/                                                │
│  ├── normalize.py         → Standardize names, dates, IDs       │
│  ├── extract_relations.py → Parse ownership from SDN remarks    │
│  ├── resolve_entities.py  → Dedupe on USCC/registration number  │
│  └── compute_bis50.py     → Calculate BIS 50% Rule captures     │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      KNOWLEDGE GRAPH                             │
├─────────────────────────────────────────────────────────────────┤
│  Neo4j Community Edition (Docker)                                │
│  ├── Nodes: Company, Person, GovernmentBody, SanctionEntry      │
│  ├── Relationships: OWNS, OFFICER_OF, SANCTIONED_AS, CONTROLS   │
│  └── Indexes: name_en, name_cn, uscc, risk_flags                │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  api/ (FastAPI)                                                  │
│  ├── GET  /search?q={query}       → Full-text entity search     │
│  ├── GET  /entity/{id}            → Entity profile with flags   │
│  ├── GET  /entity/{id}/network    → Graph data (nodes/edges)    │
│  ├── GET  /entity/{id}/bis50      → Ownership chain + capture   │
│  ├── POST /screen                 → Batch sanctions screening   │
│  └── POST /chat                   → Natural language query      │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
├─────────────────────────────────────────────────────────────────┤
│  frontend/ (React + TypeScript + Tailwind)                       │
│  ├── Global Search (Chinese + English + Pinyin)                 │
│  ├── Entity Profile Page                                        │
│  ├── Network Graph Visualization                                │
│  ├── BIS 50% Rule Tracer                                        │
│  ├── Organization Screener                                      │
│  └── Chat Interface                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Sources

### Source 1: US Consolidated Screening List (CSL)

**URL**: `https://api.trade.gov/consolidated_screening_list/v1/search`

**What it provides**: ~15,000 restricted party entries across 13+ lists:
- BIS Entity List
- OFAC SDN (Specially Designated Nationals)
- Military End User (MEU) List
- Denied Persons List (DPL)
- Unverified List (UVL)
- NS-CMIC (Chinese Military-Industrial Complex)
- And others

**Fields to extract**:
- `name` — Entity name
- `alt_names` — Aliases
- `addresses` — Registered addresses
- `ids` — Identifiers (OFAC ID, etc.)
- `source` — Which list (Entity List, SDN, etc.)
- `programs` — Sanctions programs
- `federal_register_notice` — Legal citation
- `countries` — Associated countries

**How to fetch**:
```python
import requests

def fetch_csl_china():
    url = "https://api.trade.gov/consolidated_screening_list/v1/search"
    params = {
        "countries": "CN,HK,MO",
        "size": 1000,
        "offset": 0
    }
    all_results = []
    while True:
        response = requests.get(url, params=params)
        data = response.json()
        results = data.get("results", [])
        if not results:
            break
        all_results.extend(results)
        params["offset"] += len(results)
    return all_results
```

**Output file**: `data/raw/csl_china.json`

---

### Source 2: OFAC SDN List (Detailed XML)

**URL**: `https://www.treasury.gov/ofac/downloads/sdn.xml`

**What it provides**: Full SDN data with richer detail than CSL. Critically, the `remarks` field often contains ownership relationships:
- "Subsidiary of HUAWEI TECHNOLOGIES CO., LTD."
- "Owned or controlled by REN ZHENGFEI"
- "Acting for or on behalf of AVIC"

**How to fetch and parse**:
```python
import requests
import xml.etree.ElementTree as ET
import re

def fetch_ofac_sdn():
    url = "https://www.treasury.gov/ofac/downloads/sdn.xml"
    response = requests.get(url)
    root = ET.fromstring(response.content)
    
    entities = []
    for entry in root.findall(".//sdnEntry"):
        entity = {
            "uid": entry.findtext("uid"),
            "name": entry.findtext(".//lastName") or entry.findtext(".//sdnName"),
            "type": entry.findtext("sdnType"),
            "programs": [p.text for p in entry.findall(".//program")],
            "remarks": entry.findtext("remarks"),
            "aliases": [a.findtext("lastName") for a in entry.findall(".//aka")],
            "addresses": [],
            "ids": []
        }
        
        # Parse addresses
        for addr in entry.findall(".//address"):
            entity["addresses"].append({
                "city": addr.findtext("city"),
                "country": addr.findtext("country")
            })
        
        # Parse IDs
        for id_elem in entry.findall(".//id"):
            entity["ids"].append({
                "type": id_elem.findtext("idType"),
                "number": id_elem.findtext("idNumber")
            })
        
        entities.append(entity)
    
    return entities

def extract_ownership_from_remarks(remarks):
    """Parse ownership relationships from SDN remarks field."""
    if not remarks:
        return []
    
    relationships = []
    
    # Pattern: "Subsidiary of X"
    subsidiary_match = re.search(r"[Ss]ubsidiary of ([^;\.]+)", remarks)
    if subsidiary_match:
        relationships.append({
            "type": "SUBSIDIARY_OF",
            "target": subsidiary_match.group(1).strip()
        })
    
    # Pattern: "Owned or controlled by X"
    owned_match = re.search(r"[Oo]wned (?:or controlled )?by ([^;\.]+)", remarks)
    if owned_match:
        relationships.append({
            "type": "OWNED_BY",
            "target": owned_match.group(1).strip()
        })
    
    # Pattern: "Acting for or on behalf of X"
    acting_match = re.search(r"[Aa]cting (?:for|on behalf) of ([^;\.]+)", remarks)
    if acting_match:
        relationships.append({
            "type": "CONTROLLED_BY",
            "target": acting_match.group(1).strip()
        })
    
    return relationships
```

**Output files**: 
- `data/raw/ofac_sdn.json`
- `data/processed/sdn_relationships.json`

---

### Source 3: OpenCorporates API

**URL**: `https://api.opencorporates.com/v0.4/companies/search`

**What it provides**: Corporate registration data from 170+ jurisdictions:
- Official registered name
- Registration number (USCC for China)
- Jurisdiction
- Status (Active/Dissolved)
- Incorporation date
- Registered address
- Officers and directors

**How to fetch** (for specific target entities):
```python
import requests

def search_opencorporates(company_name, jurisdiction_code=None):
    """
    Search OpenCorporates for a company.
    jurisdiction_code examples: 'cn' (China), 'hk' (Hong Kong), 'us_de' (Delaware)
    """
    url = "https://api.opencorporates.com/v0.4/companies/search"
    params = {
        "q": company_name,
        "format": "json"
    }
    if jurisdiction_code:
        params["jurisdiction_code"] = jurisdiction_code
    
    response = requests.get(url)
    data = response.json()
    
    companies = []
    for result in data.get("results", {}).get("companies", []):
        company = result.get("company", {})
        companies.append({
            "name": company.get("name"),
            "company_number": company.get("company_number"),
            "jurisdiction_code": company.get("jurisdiction_code"),
            "incorporation_date": company.get("incorporation_date"),
            "company_type": company.get("company_type"),
            "registry_url": company.get("registry_url"),
            "status": company.get("current_status"),
            "registered_address": company.get("registered_address_in_full"),
            "opencorporates_url": company.get("opencorporates_url")
        })
    
    return companies

def get_company_details(jurisdiction_code, company_number):
    """Get full details including officers for a specific company."""
    url = f"https://api.opencorporates.com/v0.4/companies/{jurisdiction_code}/{company_number}"
    response = requests.get(url)
    return response.json().get("results", {}).get("company", {})
```

**Target entities to look up**:
- Huawei Technologies Co., Ltd.
- HiSilicon Technologies Co., Ltd.
- Semiconductor Manufacturing International Corporation (SMIC)
- Aviation Industry Corporation of China (AVIC)
- China Electronics Technology Group Corporation (CETC)
- Hangzhou Hikvision Digital Technology
- SZ DJI Technology Co., Ltd.
- SenseTime Group Inc.
- Megvii Technology Limited

**Output file**: `data/raw/opencorporates_entities.json`

---

### Source 4: SEC EDGAR Exhibit 21 Filings

**Purpose**: Get subsidiary lists for US-listed companies (including Chinese ADRs)

**How to use**:
1. Go to `https://www.sec.gov/cgi-bin/browse-edgar`
2. Search for company (e.g., "Alibaba Group")
3. Find most recent 10-K filing
4. Look for "Exhibit 21" — list of subsidiaries

**Target filings**:
- Alibaba Group (BABA) — Exhibit 21 shows subsidiary structure through Cayman/VIE
- JD.com (JD)
- PDD Holdings (PDD)
- Any US company with significant China operations

**Manual extraction**: For the POC, manually extract 10-20 subsidiary relationships from these filings into `data/manual/sec_subsidiaries.json`

---

### Source 5: OpenSanctions Bulk Data

**URL**: `https://data.opensanctions.org/datasets/latest/default.json`

**What it provides**: Aggregated, normalized sanctions data from 40+ global lists. Useful for:
- Filling gaps in CSL data
- Adding international sanctions (EU, UK, UN)
- PEP (Politically Exposed Persons) data

**How to fetch**:
```python
import requests

def fetch_opensanctions():
    url = "https://data.opensanctions.org/datasets/latest/default.json"
    response = requests.get(url, stream=True)
    
    entities = []
    for line in response.iter_lines():
        if line:
            entity = json.loads(line)
            # Filter for China-related
            if "CN" in entity.get("countries", []) or "HK" in entity.get("countries", []):
                entities.append(entity)
    
    return entities
```

**Output file**: `data/raw/opensanctions_china.json`

---

### Source 6: Manual Research Data

Create a curated dataset of well-researched ownership chains for key entities. This is the "secret sauce" that makes the demo impressive.

**File**: `data/manual/curated_entities.json`

```json
{
  "entities": [
    {
      "id": "huawei-001",
      "name_en": "Huawei Technologies Co., Ltd.",
      "name_cn": "华为技术有限公司",
      "uscc": "914403001922038216",
      "type": "company",
      "status": "Active",
      "registered_capital": "CNY 40,300,000,000",
      "founded": "1987-09-15",
      "jurisdiction": "Shenzhen, Guangdong, China",
      "industry": "Telecommunications Equipment",
      "description": "Global provider of ICT infrastructure and smart devices",
      "risk_flags": ["entity_list", "ns_cmic", "military_civil_fusion"],
      "sanctions": [
        {
          "list": "BIS Entity List",
          "date_listed": "2019-05-16",
          "program": "Entity List",
          "citation": "84 FR 22961"
        },
        {
          "list": "NS-CMIC",
          "date_listed": "2021-06-03",
          "program": "EO 13959"
        }
      ]
    },
    {
      "id": "huawei-union-001",
      "name_en": "Huawei Investment & Holding Co., Ltd.",
      "name_cn": "华为投资控股有限公司",
      "type": "company",
      "jurisdiction": "Shenzhen, Guangdong, China",
      "description": "Employee shareholding vehicle for Huawei",
      "risk_flags": ["bis_50_captured"]
    },
    {
      "id": "ren-zhengfei-001",
      "name_en": "Ren Zhengfei",
      "name_cn": "任正非",
      "type": "person",
      "nationality": "Chinese",
      "description": "Founder and CEO of Huawei Technologies",
      "risk_flags": []
    },
    {
      "id": "hisilicon-001",
      "name_en": "HiSilicon Technologies Co., Ltd.",
      "name_cn": "海思半导体有限公司",
      "uscc": "91440300708409955J",
      "type": "company",
      "status": "Active",
      "founded": "2004-10-18",
      "jurisdiction": "Shenzhen, Guangdong, China",
      "industry": "Semiconductor Design",
      "description": "Fabless semiconductor company, wholly-owned subsidiary of Huawei",
      "risk_flags": ["entity_list", "bis_50_captured", "strategic_sector"],
      "sanctions": [
        {
          "list": "BIS Entity List",
          "date_listed": "2019-05-16"
        }
      ]
    },
    {
      "id": "smic-001",
      "name_en": "Semiconductor Manufacturing International Corporation",
      "name_cn": "中芯国际集成电路制造有限公司",
      "uscc": "91310000677322415Y",
      "type": "company",
      "status": "Active",
      "registered_capital": "USD 5,600,000,000",
      "founded": "2000-04-03",
      "jurisdiction": "Shanghai, China",
      "industry": "Semiconductor Manufacturing",
      "description": "Largest semiconductor foundry in mainland China",
      "risk_flags": ["entity_list", "meu_list", "ns_cmic"],
      "sanctions": [
        {
          "list": "BIS Entity List",
          "date_listed": "2020-12-18"
        },
        {
          "list": "Military End User List",
          "date_listed": "2020-12-18"
        }
      ]
    },
    {
      "id": "avic-001",
      "name_en": "Aviation Industry Corporation of China",
      "name_cn": "中国航空工业集团有限公司",
      "uscc": "91110000100006821L",
      "type": "company",
      "status": "Active",
      "registered_capital": "CNY 164,000,000,000",
      "founded": "2008-11-06",
      "jurisdiction": "Beijing, China",
      "industry": "Aerospace & Defense",
      "description": "Chinese state-owned aerospace and defense conglomerate",
      "risk_flags": ["entity_list", "meu_list", "ns_cmic", "central_soe", "defense_industrial_base"],
      "sanctions": [
        {
          "list": "BIS Entity List"
        },
        {
          "list": "Military End User List"
        },
        {
          "list": "NS-CMIC"
        }
      ]
    },
    {
      "id": "sasac-001",
      "name_en": "State-owned Assets Supervision and Administration Commission",
      "name_cn": "国务院国有资产监督管理委员会",
      "type": "government",
      "level": "central",
      "description": "Chinese government body that oversees state-owned enterprises"
    }
  ],
  "relationships": [
    {
      "from": "huawei-union-001",
      "to": "huawei-001",
      "type": "OWNS",
      "percentage": 98.99,
      "start_date": "2019-01-01"
    },
    {
      "from": "ren-zhengfei-001",
      "to": "huawei-001",
      "type": "OWNS",
      "percentage": 1.01
    },
    {
      "from": "ren-zhengfei-001",
      "to": "huawei-001",
      "type": "OFFICER_OF",
      "role": "Founder & CEO",
      "start_date": "1987-09-15"
    },
    {
      "from": "huawei-001",
      "to": "hisilicon-001",
      "type": "OWNS",
      "percentage": 100
    },
    {
      "from": "sasac-001",
      "to": "avic-001",
      "type": "CONTROLS",
      "percentage": 100,
      "control_type": "state_ownership"
    }
  ]
}
```

---

## Neo4j Graph Schema

### Node Labels and Properties

```cypher
// Company node
CREATE CONSTRAINT company_id IF NOT EXISTS FOR (c:Company) REQUIRE c.id IS UNIQUE;

(:Company {
  id: STRING,           // Internal unique ID
  name_en: STRING,      // English name
  name_cn: STRING,      // Chinese name (simplified)
  uscc: STRING,         // Unified Social Credit Code (18 chars)
  status: STRING,       // Active, Dissolved, etc.
  registered_capital: STRING,
  founded: DATE,
  jurisdiction: STRING,
  industry: STRING,
  description: STRING,
  risk_flags: [STRING], // ['entity_list', 'meu_list', 'ns_cmic', etc.]
  bis_50_captured: BOOLEAN,
  bis_50_reason: STRING,
  state_ownership_pct: FLOAT
})

// Person node
CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE;

(:Person {
  id: STRING,
  name_en: STRING,
  name_cn: STRING,
  pinyin: STRING,       // Romanization for search
  nationality: STRING,
  is_pep: BOOLEAN,      // Politically Exposed Person
  risk_flags: [STRING]
})

// GovernmentBody node
CREATE CONSTRAINT govt_id IF NOT EXISTS FOR (g:GovernmentBody) REQUIRE g.id IS UNIQUE;

(:GovernmentBody {
  id: STRING,
  name_en: STRING,
  name_cn: STRING,
  level: STRING,        // 'central', 'provincial', 'municipal'
  type: STRING          // 'military', 'regulatory', 'soe_parent'
})

// SanctionEntry node
CREATE CONSTRAINT sanction_id IF NOT EXISTS FOR (s:SanctionEntry) REQUIRE s.id IS UNIQUE;

(:SanctionEntry {
  id: STRING,
  list_name: STRING,    // 'BIS Entity List', 'OFAC SDN', etc.
  program: STRING,
  date_listed: DATE,
  date_delisted: DATE,
  federal_register_citation: STRING,
  details: STRING
})
```

### Relationship Types

```cypher
// Ownership relationship
(:Company|Person)-[:OWNS {
  percentage: FLOAT,    // 0-100
  start_date: DATE,
  end_date: DATE,
  is_direct: BOOLEAN,
  source: STRING        // Data provenance
}]->(:Company)

// Officer/Director relationship
(:Person)-[:OFFICER_OF {
  role: STRING,         // 'CEO', 'Chairman', 'Director', etc.
  start_date: DATE,
  end_date: DATE
}]->(:Company)

// Sanctions relationship
(:Company|Person)-[:SANCTIONED_AS {
  date_listed: DATE,
  program: STRING
}]->(:SanctionEntry)

// Government control relationship
(:GovernmentBody)-[:CONTROLS {
  percentage: FLOAT,
  control_type: STRING  // 'direct_ownership', 'golden_share', 'party_committee'
}]->(:Company)

// Corporate hierarchy (derived from OWNS)
(:Company)-[:SUBSIDIARY_OF {
  percentage: FLOAT,
  tier: INTEGER         // 1 = direct, 2 = grandchild, etc.
}]->(:Company)
```

### Indexes for Search Performance

```cypher
// Full-text search index for entity names
CREATE FULLTEXT INDEX entity_names IF NOT EXISTS 
FOR (n:Company|Person) ON EACH [n.name_en, n.name_cn, n.pinyin];

// Index for filtering
CREATE INDEX company_risk_flags IF NOT EXISTS FOR (c:Company) ON (c.risk_flags);
CREATE INDEX company_jurisdiction IF NOT EXISTS FOR (c:Company) ON (c.jurisdiction);
CREATE INDEX company_industry IF NOT EXISTS FOR (c:Company) ON (c.industry);
CREATE INDEX company_bis50 IF NOT EXISTS FOR (c:Company) ON (c.bis_50_captured);
```

---

## Key Algorithms

### BIS 50% Rule Computation

The BIS 50% Rule (effective September 2025) extends Entity List restrictions to any entity ≥50% owned by listed parties. The algorithm must:

1. Identify all Entity List, MEU List, and relevant SDN parties as "seeds"
2. Traverse ownership chains downward
3. At each hop: if ownership ≥50%, the subsidiary is captured
4. Aggregate ownership from multiple listed parties
5. Propagate recursively through captured entities

```cypher
// Find all entities captured by BIS 50% Rule
// Starting from Entity List companies, traverse OWNS relationships
// where percentage >= 50 at each hop

MATCH (listed:Company)
WHERE 'entity_list' IN listed.risk_flags OR 'meu_list' IN listed.risk_flags

MATCH path = (listed)-[:OWNS*1..10]->(captured:Company)
WHERE ALL(r IN relationships(path) WHERE r.percentage >= 50)

RETURN captured.id, captured.name_en, 
       [n IN nodes(path) | n.name_en] AS ownership_chain,
       [r IN relationships(path) | r.percentage] AS percentages
```

```python
# Python implementation for batch computation
def compute_bis50_captures(neo4j_driver):
    """
    Compute all entities captured by BIS 50% Rule.
    Returns dict mapping entity_id -> capture_info
    """
    query = """
    // Get all Entity List / MEU parties
    MATCH (seed:Company)
    WHERE 'entity_list' IN seed.risk_flags 
       OR 'meu_list' IN seed.risk_flags
    
    // Find downstream entities with >=50% ownership at each hop
    MATCH path = (seed)-[:OWNS*1..10]->(target:Company)
    WHERE ALL(rel IN relationships(path) WHERE rel.percentage >= 50)
      AND target <> seed
    
    WITH target, seed, path,
         reduce(pct = 100.0, r IN relationships(path) | pct * r.percentage / 100) AS effective_ownership
    
    RETURN target.id AS captured_id,
           target.name_en AS captured_name,
           collect(DISTINCT {
             seed_id: seed.id,
             seed_name: seed.name_en,
             chain: [n IN nodes(path) | n.id],
             effective_pct: effective_ownership
           }) AS capture_paths
    """
    
    with neo4j_driver.session() as session:
        result = session.run(query)
        captures = {}
        for record in result:
            captures[record["captured_id"]] = {
                "name": record["captured_name"],
                "captured": True,
                "paths": record["capture_paths"]
            }
        return captures

def compute_aggregate_ownership(neo4j_driver, entity_id):
    """
    Check if an entity is captured via aggregate ownership
    (multiple listed parties collectively owning >=50%)
    """
    query = """
    MATCH (target:Company {id: $entity_id})
    MATCH (listed:Company)-[r:OWNS]->(target)
    WHERE 'entity_list' IN listed.risk_flags 
       OR 'meu_list' IN listed.risk_flags
    
    WITH target, sum(r.percentage) AS total_listed_ownership
    WHERE total_listed_ownership >= 50
    
    RETURN target.id, total_listed_ownership
    """
    
    with neo4j_driver.session() as session:
        result = session.run(query, entity_id=entity_id)
        record = result.single()
        if record:
            return {
                "captured": True,
                "reason": "aggregate_ownership",
                "total_pct": record["total_listed_ownership"]
            }
        return {"captured": False}
```

### Risk Flag Propagation

Risk flags should propagate through ownership chains:

```cypher
// Propagate risk flags from parent to subsidiaries
MATCH (parent:Company)-[:OWNS]->(child:Company)
WHERE parent.risk_flags IS NOT NULL
  AND ANY(flag IN parent.risk_flags WHERE flag IN ['entity_list', 'meu_list', 'ns_cmic', 'military'])

WITH child, collect(DISTINCT parent.risk_flags) AS parent_flags
SET child.inherited_risk_flags = parent_flags
```

---

## API Specification

### FastAPI Backend

**File**: `api/main.py`

```python
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import neo4j

app = FastAPI(title="WireScreen POC API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Neo4j connection
driver = neo4j.GraphDatabase.driver(
    "bolt://localhost:7687",
    auth=("neo4j", "password")
)
```

### Endpoints

#### GET /search

Search entities by name (Chinese or English).

```python
@app.get("/search")
async def search_entities(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, le=100),
    entity_type: Optional[str] = None
):
    """
    Full-text search across entity names.
    Searches English names, Chinese names, and pinyin.
    """
    query = """
    CALL db.index.fulltext.queryNodes('entity_names', $search_term)
    YIELD node, score
    WHERE ($entity_type IS NULL OR labels(node)[0] = $entity_type)
    RETURN node.id AS id,
           node.name_en AS name_en,
           node.name_cn AS name_cn,
           labels(node)[0] AS type,
           node.risk_flags AS risk_flags,
           node.jurisdiction AS jurisdiction,
           score
    ORDER BY score DESC
    LIMIT $limit
    """
    
    with driver.session() as session:
        result = session.run(query, 
            search_term=q + "~",  # Fuzzy search
            entity_type=entity_type,
            limit=limit
        )
        return [dict(record) for record in result]
```

#### GET /entity/{entity_id}

Get full entity profile with risk flags, ownership, and relationships.

```python
class EntityProfile(BaseModel):
    id: str
    name_en: str
    name_cn: Optional[str]
    type: str
    status: Optional[str]
    jurisdiction: Optional[str]
    industry: Optional[str]
    registered_capital: Optional[str]
    founded: Optional[str]
    description: Optional[str]
    risk_flags: List[str]
    bis_50_status: dict
    shareholders: List[dict]
    subsidiaries: List[dict]
    officers: List[dict]
    sanctions: List[dict]

@app.get("/entity/{entity_id}", response_model=EntityProfile)
async def get_entity(entity_id: str):
    """Get complete entity profile."""
    
    # Main entity query
    entity_query = """
    MATCH (e {id: $id})
    OPTIONAL MATCH (e)-[:SANCTIONED_AS]->(s:SanctionEntry)
    RETURN e, collect(DISTINCT s) AS sanctions
    """
    
    # Shareholders query
    shareholders_query = """
    MATCH (owner)-[r:OWNS]->(e:Company {id: $id})
    RETURN owner.id AS id, 
           owner.name_en AS name_en,
           owner.name_cn AS name_cn,
           labels(owner)[0] AS type,
           r.percentage AS percentage,
           owner.risk_flags AS risk_flags
    ORDER BY r.percentage DESC
    """
    
    # Subsidiaries query
    subsidiaries_query = """
    MATCH (e:Company {id: $id})-[r:OWNS]->(sub:Company)
    RETURN sub.id AS id,
           sub.name_en AS name_en,
           sub.name_cn AS name_cn,
           r.percentage AS percentage,
           sub.risk_flags AS risk_flags,
           sub.bis_50_captured AS bis_50_captured
    ORDER BY r.percentage DESC
    """
    
    # Officers query
    officers_query = """
    MATCH (p:Person)-[r:OFFICER_OF]->(e:Company {id: $id})
    RETURN p.id AS id,
           p.name_en AS name_en,
           p.name_cn AS name_cn,
           r.role AS role,
           r.start_date AS since
    """
    
    with driver.session() as session:
        # Execute all queries
        entity_result = session.run(entity_query, id=entity_id).single()
        if not entity_result:
            raise HTTPException(status_code=404, detail="Entity not found")
        
        shareholders = list(session.run(shareholders_query, id=entity_id))
        subsidiaries = list(session.run(subsidiaries_query, id=entity_id))
        officers = list(session.run(officers_query, id=entity_id))
        
        e = entity_result["e"]
        
        return EntityProfile(
            id=e["id"],
            name_en=e.get("name_en"),
            name_cn=e.get("name_cn"),
            type=list(e.labels)[0],
            status=e.get("status"),
            jurisdiction=e.get("jurisdiction"),
            industry=e.get("industry"),
            registered_capital=e.get("registered_capital"),
            founded=str(e.get("founded")) if e.get("founded") else None,
            description=e.get("description"),
            risk_flags=e.get("risk_flags", []),
            bis_50_status={
                "captured": e.get("bis_50_captured", False),
                "reason": e.get("bis_50_reason")
            },
            shareholders=[dict(r) for r in shareholders],
            subsidiaries=[dict(r) for r in subsidiaries],
            officers=[dict(r) for r in officers],
            sanctions=[dict(s) for s in entity_result["sanctions"]]
        )
```

#### GET /entity/{entity_id}/network

Get graph data for visualization (nodes and edges).

```python
class NetworkResponse(BaseModel):
    nodes: List[dict]
    edges: List[dict]

@app.get("/entity/{entity_id}/network", response_model=NetworkResponse)
async def get_entity_network(
    entity_id: str,
    hops: int = Query(2, ge=1, le=5),
    relationship_types: Optional[str] = None  # Comma-separated: "OWNS,OFFICER_OF"
):
    """
    Get network graph data centered on an entity.
    Returns nodes and edges for visualization.
    """
    
    rel_filter = ""
    if relationship_types:
        types = relationship_types.split(",")
        rel_filter = f"AND type(r) IN {types}"
    
    query = f"""
    MATCH (center {{id: $id}})
    CALL apoc.path.subgraphAll(center, {{
        maxLevel: $hops,
        relationshipFilter: "OWNS|OFFICER_OF|CONTROLS|SANCTIONED_AS"
    }})
    YIELD nodes, relationships
    
    RETURN nodes, relationships
    """
    
    with driver.session() as session:
        result = session.run(query, id=entity_id, hops=hops).single()
        
        nodes = []
        for node in result["nodes"]:
            nodes.append({
                "id": node["id"],
                "name_en": node.get("name_en"),
                "name_cn": node.get("name_cn"),
                "type": list(node.labels)[0],
                "risk_flags": node.get("risk_flags", []),
                "bis_50_captured": node.get("bis_50_captured", False)
            })
        
        edges = []
        for rel in result["relationships"]:
            edges.append({
                "source": rel.start_node["id"],
                "target": rel.end_node["id"],
                "type": rel.type,
                "percentage": rel.get("percentage"),
                "role": rel.get("role")
            })
        
        return NetworkResponse(nodes=nodes, edges=edges)
```

#### GET /entity/{entity_id}/bis50

Get BIS 50% Rule capture chain for an entity.

```python
class BIS50Response(BaseModel):
    entity_id: str
    entity_name: str
    captured: bool
    reason: Optional[str]
    ownership_chain: Optional[List[dict]]
    aggregate_ownership: Optional[dict]

@app.get("/entity/{entity_id}/bis50", response_model=BIS50Response)
async def get_bis50_status(entity_id: str):
    """
    Check if entity is captured by BIS 50% Rule.
    Returns the ownership chain if captured.
    """
    
    # Check direct listing
    direct_query = """
    MATCH (e {id: $id})
    WHERE 'entity_list' IN e.risk_flags OR 'meu_list' IN e.risk_flags
    RETURN e.name_en AS name, 'direct_listing' AS reason
    """
    
    # Check ownership chain capture
    chain_query = """
    MATCH (e:Company {id: $id})
    MATCH path = (listed:Company)-[:OWNS*1..10]->(e)
    WHERE ('entity_list' IN listed.risk_flags OR 'meu_list' IN listed.risk_flags)
      AND ALL(r IN relationships(path) WHERE r.percentage >= 50)
    
    WITH path, listed,
         [n IN nodes(path) | {
           id: n.id, 
           name: n.name_en,
           risk_flags: n.risk_flags
         }] AS chain,
         [r IN relationships(path) | r.percentage] AS percentages
    
    RETURN listed.name_en AS listed_party,
           chain,
           percentages
    ORDER BY length(path)
    LIMIT 1
    """
    
    # Check aggregate ownership
    aggregate_query = """
    MATCH (e:Company {id: $id})
    MATCH (listed:Company)-[r:OWNS]->(e)
    WHERE 'entity_list' IN listed.risk_flags OR 'meu_list' IN listed.risk_flags
    
    WITH e, collect({
        party: listed.name_en,
        percentage: r.percentage
    }) AS listed_owners,
    sum(r.percentage) AS total_pct
    
    WHERE total_pct >= 50
    RETURN listed_owners, total_pct
    """
    
    with driver.session() as session:
        # Check direct listing first
        direct = session.run(direct_query, id=entity_id).single()
        if direct:
            return BIS50Response(
                entity_id=entity_id,
                entity_name=direct["name"],
                captured=True,
                reason="Direct listing on Entity List or MEU List",
                ownership_chain=None,
                aggregate_ownership=None
            )
        
        # Check chain capture
        chain = session.run(chain_query, id=entity_id).single()
        if chain:
            return BIS50Response(
                entity_id=entity_id,
                entity_name=chain["chain"][-1]["name"],
                captured=True,
                reason=f"Owned ≥50% by {chain['listed_party']} (Entity List)",
                ownership_chain=[
                    {**node, "ownership_pct": chain["percentages"][i] if i < len(chain["percentages"]) else None}
                    for i, node in enumerate(chain["chain"])
                ],
                aggregate_ownership=None
            )
        
        # Check aggregate
        aggregate = session.run(aggregate_query, id=entity_id).single()
        if aggregate:
            return BIS50Response(
                entity_id=entity_id,
                entity_name="",  # Would need another query
                captured=True,
                reason="Aggregate ownership ≥50% by listed parties",
                ownership_chain=None,
                aggregate_ownership={
                    "parties": aggregate["listed_owners"],
                    "total_percentage": aggregate["total_pct"]
                }
            )
        
        # Not captured
        return BIS50Response(
            entity_id=entity_id,
            entity_name="",
            captured=False,
            reason=None,
            ownership_chain=None,
            aggregate_ownership=None
        )
```

#### POST /chat

Natural language query interface using LangChain GraphCypherQAChain.

```python
from langchain_community.graphs import Neo4jGraph
from langchain_community.chains import GraphCypherQAChain
from langchain_anthropic import ChatAnthropic

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    answer: str
    cypher_query: Optional[str]
    sources: List[dict]

# Initialize LangChain components
graph = Neo4jGraph(
    url="bolt://localhost:7687",
    username="neo4j",
    password="password"
)

llm = ChatAnthropic(model="claude-sonnet-4-20250514", temperature=0)

chain = GraphCypherQAChain.from_llm(
    llm=llm,
    graph=graph,
    verbose=True,
    return_intermediate_steps=True
)

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Natural language query over the knowledge graph.
    Converts questions to Cypher and returns answers.
    """
    try:
        result = chain.invoke({"query": request.message})
        
        return ChatResponse(
            answer=result["result"],
            cypher_query=result.get("intermediate_steps", [{}])[0].get("query"),
            sources=[]  # Could extract entity references from result
        )
    except Exception as e:
        return ChatResponse(
            answer=f"I couldn't answer that question. Error: {str(e)}",
            cypher_query=None,
            sources=[]
        )
```

---

## Frontend Components

### Tech Stack

- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui (Button, Card, Badge, Table, Input, Dialog)
- **Graph Visualization**: react-force-graph-2d
- **State Management**: React Context + useState (no Redux needed for POC)
- **HTTP Client**: fetch or axios
- **Routing**: React Router v6

### Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx         # Top navbar with search
│   │   │   ├── Sidebar.tsx        # Navigation sidebar
│   │   │   └── Layout.tsx         # Main layout wrapper
│   │   ├── search/
│   │   │   ├── SearchBar.tsx      # Global search with autocomplete
│   │   │   └── SearchResults.tsx  # Search results list
│   │   ├── entity/
│   │   │   ├── EntityProfile.tsx  # Main profile page
│   │   │   ├── RiskFlags.tsx      # Risk flag badges
│   │   │   ├── OwnershipCard.tsx  # Ownership breakdown
│   │   │   ├── ExecutivesCard.tsx # Key executives list
│   │   │   └── SanctionsCard.tsx  # Sanctions matches
│   │   ├── graph/
│   │   │   ├── NetworkGraph.tsx   # Force-directed graph
│   │   │   ├── GraphControls.tsx  # Filter/expand controls
│   │   │   └── NodeTooltip.tsx    # Hover tooltip
│   │   ├── bis50/
│   │   │   ├── BIS50Tracer.tsx    # Ownership chain tracer
│   │   │   └── OwnershipTree.tsx  # Vertical tree visualization
│   │   ├── screener/
│   │   │   ├── OrgScreener.tsx    # Filterable entity table
│   │   │   └── FilterPanel.tsx    # Filter controls
│   │   └── chat/
│   │       ├── ChatPanel.tsx      # Chat interface
│   │       └── ChatMessage.tsx    # Individual message
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── SearchPage.tsx
│   │   ├── EntityPage.tsx
│   │   ├── GraphPage.tsx
│   │   ├── BIS50Page.tsx
│   │   ├── ScreenerPage.tsx
│   │   └── ChatPage.tsx
│   ├── hooks/
│   │   ├── useSearch.ts
│   │   ├── useEntity.ts
│   │   └── useGraph.ts
│   ├── api/
│   │   └── client.ts              # API client functions
│   ├── types/
│   │   └── index.ts               # TypeScript interfaces
│   ├── App.tsx
│   └── main.tsx
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

### Key Component Specifications

#### SearchBar.tsx

```tsx
// Global search with Chinese/English support and autocomplete
interface SearchBarProps {
  onSelect: (entityId: string) => void;
}

// Features:
// - Debounced input (300ms)
// - Shows results as you type
// - Displays both Chinese and English names
// - Shows risk flag chips in results
// - Keyboard navigation (up/down/enter)
```

#### EntityProfile.tsx

```tsx
// Full entity profile page
interface EntityProfileProps {
  entityId: string;
}

// Layout:
// ┌─────────────────────────────────────────────────┐
// │ [Logo] Company Name (Chinese Name)      [Status]│
// │ USCC: XXXXXXXXXXXXXXXXXX | Industry | Jurisdiction
// ├─────────────────────────────────────────────────┤
// │ [Entity List] [MEU] [NS-CMIC] [Military] [SOE]  │ <- Risk flags
// ├─────────────────────────────────────────────────┤
// │ ┌──────────────┐  ┌──────────────────────────┐  │
// │ │ Registration │  │ Ownership Breakdown      │  │
// │ │ Details      │  │ [Pie Chart]              │  │
// │ │ - Capital    │  │ - Shareholder A: 51%     │  │
// │ │ - Founded    │  │ - Shareholder B: 30%     │  │
// │ │ - Address    │  │ - Public: 19%            │  │
// │ └──────────────┘  └──────────────────────────┘  │
// │ ┌──────────────┐  ┌──────────────────────────┐  │
// │ │ Executives   │  │ BIS 50% Status           │  │
// │ │ - CEO: Name  │  │ [CAPTURED] View Chain →  │  │
// │ │ - CFO: Name  │  │                          │  │
// │ └──────────────┘  └──────────────────────────┘  │
// ├─────────────────────────────────────────────────┤
// │ [Ownership] [Network] [Sanctions] [Docs] [News] │ <- Tabs
// └─────────────────────────────────────────────────┘
```

#### NetworkGraph.tsx

```tsx
// Interactive force-directed graph using react-force-graph-2d
interface NetworkGraphProps {
  entityId: string;
  hops?: number;
  relationshipTypes?: string[];
  onNodeClick?: (nodeId: string) => void;
}

// Features:
// - Force-directed layout with D3
// - Node colors by type (Company=blue, Person=green, Govt=gray)
// - Red glow/border for sanctioned nodes
// - Yellow glow for BIS 50% captured
// - Edge labels showing ownership percentage
// - Click to select, double-click to recenter
// - Right-click context menu
// - Zoom and pan controls
// - "Trace BIS 50%" button highlights capture path
```

#### BIS50Tracer.tsx

```tsx
// Ownership chain visualization for BIS 50% Rule
interface BIS50TracerProps {
  entityId: string;
}

// Layout:
// ┌─────────────────────────────────────────────────┐
// │ BIS 50% Rule Status                             │
// ├─────────────────────────────────────────────────┤
// │                                                 │
// │   [ENTITY LIST] AVIC                            │
// │        │                                        │
// │        │ 100%                                   │
// │        ▼                                        │
// │   [CAPTURED] AVIC International                 │
// │        │                                        │
// │        │ 52%                                    │
// │        ▼                                        │
// │   [CAPTURED] Target Entity ← Your search       │
// │                                                 │
// ├─────────────────────────────────────────────────┤
// │ Explanation:                                    │
// │ This entity is CAPTURED under the BIS 50% Rule │
// │ because AVIC (Entity List) owns 100% of AVIC   │
// │ International, which owns 52% of Target Entity.│
// │ Since each hop maintains ≥50% ownership, the   │
// │ restriction propagates through the chain.      │
// └─────────────────────────────────────────────────┘
```

#### OrgScreener.tsx

```tsx
// Filterable table of all entities
interface OrgScreenerProps {}

// Layout:
// ┌──────────────┬────────────────────────────────────────┐
// │ Filters      │ Results (847 entities)          [Export]│
// ├──────────────┼────────────────────────────────────────┤
// │ Jurisdiction │ Name          | Jurisdiction | Flags   │
// │ [ ] Beijing  │ ────────────────────────────────────── │
// │ [ ] Shanghai │ Huawei Tech   | Shenzhen     | EL CMIC │
// │ [ ] Shenzhen │ HiSilicon     | Shenzhen     | EL 50%  │
// │              │ SMIC          | Shanghai     | EL MEU  │
// │ Industry     │ AVIC          | Beijing      | EL MEU  │
// │ [ ] Semicon  │ ...           | ...          | ...     │
// │ [ ] Telecom  │                                        │
// │ [ ] Defense  │ ← 1 2 3 4 5 ... 17 →                   │
// │              │                                        │
// │ Risk Flags   │                                        │
// │ [x] Entity   │                                        │
// │ [ ] MEU      │                                        │
// │ [ ] CMIC     │                                        │
// └──────────────┴────────────────────────────────────────┘
```

---

## Docker Setup

### docker-compose.yml

```yaml
version: '3.8'

services:
  neo4j:
    image: neo4j:5.15-community
    container_name: wirescreen-neo4j
    ports:
      - "7474:7474"  # HTTP
      - "7687:7687"  # Bolt
    environment:
      - NEO4J_AUTH=neo4j/wirescreen123
      - NEO4J_PLUGINS=["apoc"]
      - NEO4J_apoc_export_file_enabled=true
      - NEO4J_apoc_import_file_enabled=true
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
      - ./data/import:/var/lib/neo4j/import

  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    container_name: wirescreen-api
    ports:
      - "8000:8000"
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=wirescreen123
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - neo4j

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: wirescreen-frontend
    ports:
      - "3000:3000"
    depends_on:
      - api

volumes:
  neo4j_data:
  neo4j_logs:
```

### api/Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### api/requirements.txt

```
fastapi==0.109.0
uvicorn==0.27.0
neo4j==5.17.0
pydantic==2.6.0
langchain==0.1.5
langchain-community==0.0.17
langchain-anthropic==0.1.1
python-dotenv==1.0.0
```

### frontend/Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

---

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local frontend dev)
- Python 3.11+ (for local API dev)
- Anthropic API key (for chat feature)

### Quick Start

```bash
# Clone the repo
git clone <repo-url>
cd wirescreen-poc

# Set up environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start all services
docker-compose up -d

# Load sample data into Neo4j
python scripts/load_data.py

# Access the application
# Frontend: http://localhost:3000
# API docs: http://localhost:8000/docs
# Neo4j Browser: http://localhost:7474
```

### Development Mode

```bash
# Terminal 1: Start Neo4j
docker-compose up neo4j

# Terminal 2: Start API (with hot reload)
cd api
pip install -r requirements.txt
uvicorn main:app --reload

# Terminal 3: Start Frontend (with hot reload)
cd frontend
npm install
npm run dev
```

---

## Demo Script

Use this sequence to demonstrate the POC in an interview:

### 1. Search Demo (30 seconds)
- Type "华为" in search bar → shows Huawei results
- Type "Huawei" → shows same results
- Show autocomplete with risk flag chips

### 2. Entity Profile Demo (1 minute)
- Click on Huawei Technologies
- Show Chinese + English names, USCC
- Highlight risk flags: Entity List, NS-CMIC, Military-Civil Fusion
- Show ownership breakdown (Huawei Investment & Holding 98.99%, Ren Zhengfei 1.01%)
- Show key executives
- Click on HiSilicon subsidiary → show inherited risk

### 3. Network Graph Demo (1 minute)
- Open network view for Huawei
- Show force-directed graph with color-coded nodes
- Point out red-bordered sanctioned entities
- Expand a node to show more connections
- Toggle "Show ownership only" filter
- Click "Trace BIS 50%" to highlight capture chain

### 4. BIS 50% Rule Demo (1 minute)
- Go to BIS 50% Tracer
- Search for an AVIC subsidiary
- Show the ownership chain visualization
- Explain the calculation: "AVIC (Entity List) owns 100% of AVIC International, which owns 52% of this entity. Since each hop is ≥50%, the restriction propagates."
- Show aggregate ownership example if available

### 5. Organization Screener Demo (30 seconds)
- Open screener
- Filter by Industry: Semiconductors
- Filter by Risk Flag: Entity List
- Show results with SMIC, HiSilicon, etc.
- Click "Export CSV"

### 6. Chat Demo (30 seconds)
- Ask: "Who are Huawei's major subsidiaries?"
- Ask: "Is SMIC connected to the Chinese military?"
- Ask: "Show me semiconductor companies captured by BIS 50%"
- Show that answers are grounded in the graph data

### 7. Closing Points
- "This is real data from the Consolidated Screening List and OFAC"
- "The BIS 50% computation follows the actual regulatory logic"
- "The Chinese language support is production-ready"
- "The architecture scales to 14M+ entities with Neo4j"

---

## Success Criteria

The POC is successful if it demonstrates:

1. **Real data**: Actual Entity List companies with real Chinese names, USSCs, and ownership structures

2. **Working BIS 50% computation**: Correctly traces ownership chains and identifies captured entities

3. **Chinese language support**: Displays and searches 华为技术有限公司 alongside "Huawei Technologies"

4. **Interactive graph visualization**: Explore, expand, filter, and trace paths through ownership networks

5. **Risk propagation**: Shows inherited risk flowing through ownership chains

6. **AI integration**: Natural language questions answered from the knowledge graph

7. **Clean, professional UI**: Looks like a real product, not a hackathon project

---

## Next Steps After POC

If joining WireScreen, these would be the natural extensions:

1. **Data expansion**: Add NECIPS scraping, more OpenCorporates coverage, SEC EDGAR parsing

2. **Entity resolution**: Build ML-based matching for Chinese name variants

3. **Real-time monitoring**: Watchlists with alerts on ownership changes

4. **Batch screening**: CSV upload for compliance teams

5. **API productization**: Rate limiting, auth, documentation

6. **Performance optimization**: Graph projections, query caching, Elasticsearch integration

7. **Security**: SOC 2 compliance, RBAC, audit logging

---

## WOW FEATURE 1: Entity Evolution Timeline

### Why This Matters

WireScreen's CEO David Barboza explicitly talks about "tracing DeepSeek's evolution as a company" — seeing how it was built over time, tracking investments, and understanding corporate restructuring. This is the exact capability that catches sanctions evasion:

- Companies rename themselves after being listed (SMIC subsidiaries, Huawei affiliates)
- Ownership structures shift to obscure connections
- Shell companies appear and disappear
- Executive shuffling moves key people between clean and dirty entities

### Data Model Extension

```cypher
// Add temporal properties to all relationships
(:Company)-[:OWNS {
  percentage: FLOAT,
  start_date: DATE,      // When ownership began
  end_date: DATE,        // When ownership ended (null = current)
  source: STRING,
  filing_date: DATE      // When this was disclosed
}]->(:Company)

// Corporate Events node for tracking changes
(:CorporateEvent {
  id: STRING,
  event_type: STRING,    // 'name_change', 'restructure', 'merger', 'spin_off', 'dissolution', 'sanctions_listing', 'ownership_change'
  date: DATE,
  description: STRING,
  old_value: STRING,     // e.g., old name
  new_value: STRING,     // e.g., new name
  source: STRING,
  source_url: STRING
})

// Link events to entities
(:Company)-[:EXPERIENCED]->(CorporateEvent)

// Name history for tracking aliases
(:Company)-[:PREVIOUSLY_KNOWN_AS {
  name: STRING,
  name_type: STRING,     // 'legal', 'trade', 'brand'
  start_date: DATE,
  end_date: DATE
}]->(:NameRecord)
```

### API Endpoints

```python
@app.get("/entity/{entity_id}/timeline")
async def get_entity_timeline(entity_id: str):
    """
    Get chronological timeline of all events affecting an entity.
    Returns ownership changes, name changes, sanctions listings, etc.
    """
    query = """
    MATCH (e {id: $id})
    
    // Get direct events
    OPTIONAL MATCH (e)-[:EXPERIENCED]->(event:CorporateEvent)
    
    // Get ownership changes
    OPTIONAL MATCH (owner)-[r:OWNS]->(e)
    WHERE r.start_date IS NOT NULL OR r.end_date IS NOT NULL
    
    // Get sanctions events
    OPTIONAL MATCH (e)-[s:SANCTIONED_AS]->(sanction:SanctionEntry)
    
    WITH e, 
         collect(DISTINCT event) AS events,
         collect(DISTINCT {
           type: 'ownership_change',
           owner: owner.name_en,
           percentage: r.percentage,
           start: r.start_date,
           end: r.end_date
         }) AS ownership_changes,
         collect(DISTINCT {
           type: 'sanctions_listing',
           list: sanction.list_name,
           date: s.date_listed
         }) AS sanctions
    
    RETURN e, events, ownership_changes, sanctions
    """
    # ... implementation
```

### Frontend Component: EntityTimeline.tsx

```tsx
// Vertical timeline showing corporate evolution
interface TimelineEvent {
  date: string;
  type: 'name_change' | 'ownership_change' | 'sanctions_listing' | 'restructure' | 'founding';
  title: string;
  description: string;
  significance: 'high' | 'medium' | 'low';
  source?: string;
}

// Visual design:
// ┌─────────────────────────────────────────────────┐
// │ Entity Evolution Timeline                       │
// ├─────────────────────────────────────────────────┤
// │                                                 │
// │  ● 2023-07-17 — HIGH RISK                      │
// │  │ Added to BIS Entity List                    │
// │  │ "Added for contributions to China's         │
// │  │  military modernization efforts"            │
// │  │                                             │
// │  ● 2023-03-01                                  │
// │  │ Name Change                                 │
// │  │ "Beijing Smartchip → Beijing Eswin"         │
// │  │ ⚠️ Name change occurred 4 months before    │
// │  │    Entity List designation                  │
// │  │                                             │
// │  ● 2022-11-15                                  │
// │  │ Ownership Restructure                       │
// │  │ "YMTC reduced stake from 51% to 29%"        │
// │  │                                             │
// │  ● 2019-06-20                                  │
// │  │ Company Founded                             │
// │  │ "Registered in Beijing, Initial capital     │
// │  │  RMB 500M from YMTC"                        │
// │                                                 │
// └─────────────────────────────────────────────────┘
```

### Evasion Pattern Detection

The timeline enables automatic detection of suspicious patterns:

```python
def detect_evasion_patterns(entity_id: str) -> List[dict]:
    """
    Analyze entity timeline for potential sanctions evasion indicators.
    """
    patterns = []
    
    # Pattern 1: Name change shortly before/after sanctions listing
    name_changes = get_name_changes(entity_id)
    sanctions_dates = get_sanctions_dates(entity_id)
    for name_change in name_changes:
        for sanctions_date in sanctions_dates:
            days_apart = abs((name_change.date - sanctions_date).days)
            if days_apart < 180:
                patterns.append({
                    "pattern": "NAME_CHANGE_NEAR_SANCTIONS",
                    "severity": "high",
                    "description": f"Name changed from '{name_change.old_name}' to '{name_change.new_name}' within {days_apart} days of sanctions listing",
                    "date": name_change.date
                })
    
    # Pattern 2: Ownership restructure to reduce stake below 50%
    ownership_changes = get_ownership_changes(entity_id)
    for change in ownership_changes:
        if change.old_percentage >= 50 and change.new_percentage < 50:
            patterns.append({
                "pattern": "OWNERSHIP_BELOW_50_THRESHOLD",
                "severity": "high",
                "description": f"{change.owner} reduced stake from {change.old_percentage}% to {change.new_percentage}% — may be attempting to avoid BIS 50% Rule capture",
                "date": change.date
            })
    
    # Pattern 3: Rapid subsidiary creation after parent listing
    # Pattern 4: Executive moves to newly-created entity
    # Pattern 5: Address change to new jurisdiction
    
    return patterns
```

---

## WOW FEATURE 2: Risk Narrative Generator

### Why This Matters

WireScreen was founded by a **two-time Pulitzer Prize-winning investigative journalist**. Their value isn't just data — it's the ability to tell a story about WHY an entity is risky. Compliance teams need to explain risk to executives and boards in plain English, not just show a graph.

This feature auto-generates investigative-style narratives like:

> **HiSilicon Technologies Co., Ltd. presents significant export control risk.**
>
> HiSilicon is a wholly-owned subsidiary of Huawei Technologies, which was added to the BIS Entity List on May 16, 2019 (84 FR 22961) for activities contrary to U.S. national security interests. 
>
> Under the BIS 50% Rule (effective September 2025), HiSilicon is automatically captured because Huawei owns 100% of its equity. This means any transaction with HiSilicon requires the same export license as a transaction with Huawei itself — regardless of whether HiSilicon appears on the Entity List by name.
>
> Additionally, HiSilicon was independently added to the Entity List on the same date as its parent, confirming BIS's assessment of the entity's role in Huawei's operations.
>
> **Key Risk Factors:**
> - Direct Entity List designation (May 16, 2019)
> - 100% owned by Huawei Technologies (Entity List)
> - Semiconductor design company — strategic sector
> - Products include Kirin chipsets used in Huawei devices

### Implementation

```python
from anthropic import Anthropic

def generate_risk_narrative(entity_id: str) -> str:
    """
    Generate an investigative-style narrative explaining why an entity is risky.
    Uses LLM to synthesize graph data into readable prose.
    """
    
    # Gather all relevant data from the graph
    entity = get_entity_profile(entity_id)
    ownership_chain = get_ownership_chain(entity_id)
    sanctions = get_sanctions_matches(entity_id)
    bis50_status = compute_bis50_status(entity_id)
    timeline = get_entity_timeline(entity_id)
    related_entities = get_related_flagged_entities(entity_id)
    
    # Build structured context for the LLM
    context = f"""
    Entity: {entity.name_en} ({entity.name_cn})
    USCC: {entity.uscc}
    Jurisdiction: {entity.jurisdiction}
    Industry: {entity.industry}
    Status: {entity.status}
    
    RISK FLAGS: {', '.join(entity.risk_flags)}
    
    DIRECT SANCTIONS:
    {format_sanctions(sanctions)}
    
    OWNERSHIP STRUCTURE:
    {format_ownership(ownership_chain)}
    
    BIS 50% RULE STATUS:
    Captured: {bis50_status.captured}
    Reason: {bis50_status.reason}
    Chain: {format_chain(bis50_status.chain)}
    
    KEY EVENTS:
    {format_timeline(timeline)}
    
    CONNECTED FLAGGED ENTITIES:
    {format_related(related_entities)}
    """
    
    client = Anthropic()
    
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        system="""You are an expert export control compliance analyst writing a risk assessment narrative.

Write in the style of an investigative journalist — clear, factual, well-sourced.
Every claim must be grounded in the data provided. Do not speculate.
Explain the regulatory implications in plain English.
Structure: Lead with the bottom line, then explain the evidence, then list key risk factors.
Use specific dates, percentages, and legal citations where available.
Be concise but thorough — aim for 200-400 words.""",
        messages=[{
            "role": "user",
            "content": f"Generate a risk narrative for this entity:\n\n{context}"
        }]
    )
    
    return response.content[0].text
```

### Frontend Component: RiskNarrative.tsx

```tsx
// Risk narrative display with source citations
interface RiskNarrativeProps {
  entityId: string;
}

// Visual design:
// ┌─────────────────────────────────────────────────┐
// │ 📋 Risk Assessment                    [Export]  │
// ├─────────────────────────────────────────────────┤
// │                                                 │
// │ HiSilicon Technologies Co., Ltd. presents      │
// │ significant export control risk.               │
// │                                                 │
// │ HiSilicon is a wholly-owned subsidiary of      │
// │ Huawei Technologies[1], which was added to the │
// │ BIS Entity List on May 16, 2019[2] for         │
// │ activities contrary to U.S. national security. │
// │                                                 │
// │ Under the BIS 50% Rule[3], HiSilicon is        │
// │ automatically captured because Huawei owns     │
// │ 100% of its equity...                          │
// │                                                 │
// │ ─────────────────────────────────────────────  │
// │ Key Risk Factors:                              │
// │ • Direct Entity List designation (2019-05-16) │
// │ • 100% owned by Huawei (Entity List)          │
// │ • Semiconductor design — strategic sector      │
// │                                                 │
// │ ─────────────────────────────────────────────  │
// │ Sources:                                       │
// │ [1] NECIPS Filing 2023-04-15                  │
// │ [2] 84 FR 22961                               │
// │ [3] 15 CFR 744.11(a)(2)                       │
// └─────────────────────────────────────────────────┘
```

### Batch Report Generation

For enterprise use, generate PDF reports for due diligence:

```python
@app.post("/reports/due-diligence")
async def generate_due_diligence_report(entity_ids: List[str]):
    """
    Generate a comprehensive due diligence PDF report for multiple entities.
    """
    report_sections = []
    
    for entity_id in entity_ids:
        entity = get_entity_profile(entity_id)
        narrative = generate_risk_narrative(entity_id)
        network = get_entity_network(entity_id, hops=2)
        timeline = get_entity_timeline(entity_id)
        
        report_sections.append({
            "entity": entity,
            "narrative": narrative,
            "network_graph": render_network_to_image(network),
            "timeline": timeline,
            "ownership_tree": render_ownership_tree(entity_id)
        })
    
    pdf = render_pdf_report(report_sections)
    return FileResponse(pdf, filename=f"due_diligence_{date.today()}.pdf")
```

---

## Expanded Entity Dataset

### Core Entities (45+ entities across key sectors)

The manual research file should include comprehensive data on these high-profile entities, organized by strategic sector:

### Telecommunications & 5G

| Entity | Chinese Name | USCC | Risk Flags | Notes |
|--------|-------------|------|------------|-------|
| Huawei Technologies | 华为技术有限公司 | 914403001922038216 | Entity List, NS-CMIC, MCF | Core case study — 100+ subsidiaries |
| Huawei Investment & Holding | 华为投资控股有限公司 | 91440300708461136T | BIS 50% Captured | Employee shareholding vehicle, owns 98.99% of Huawei Tech |
| HiSilicon Technologies | 海思半导体有限公司 | 91440300708409955J | Entity List, BIS 50% | Fabless semiconductor, 100% Huawei subsidiary |
| Huawei Device Co. | 华为终端有限公司 | 91440300MA5CUGMD5D | BIS 50% Captured | Consumer electronics arm |
| Huawei Cloud Computing | 华为云计算技术有限公司 | 91140100MA0KR3U88A | BIS 50% Captured | Cloud services |
| ZTE Corporation | 中兴通讯股份有限公司 | 91440300192544069A | Entity List (2018, removed), Settlement | Major Huawei competitor, resolved 2018 |
| China Mobile | 中国移动通信集团有限公司 | 91110000100011012D | NS-CMIC, CMC List | State-owned telecom, DeepSeek data recipient |
| China Telecom | 中国电信集团有限公司 | 91110000100000741M | NS-CMIC, CMC List | State-owned telecom |
| China Unicom | 中国联合网络通信集团有限公司 | 91110000100006155Q | NS-CMIC | State-owned telecom |

### Semiconductors

| Entity | Chinese Name | USCC | Risk Flags | Notes |
|--------|-------------|------|------------|-------|
| SMIC | 中芯国际集成电路制造有限公司 | 91310000677322415Y | Entity List, MEU, NS-CMIC | Largest China foundry |
| SMIC Beijing | 中芯北方集成电路制造（北京）有限公司 | 91110000MA0080TH5L | BIS 50% Captured | 300mm fab |
| SMIC Shanghai | 中芯南方集成电路制造有限公司 | 91310000MA1FLK6J72 | BIS 50% Captured | Advanced node fab |
| YMTC | 长江存储科技有限责任公司 | 91420100MA4KN5TB8E | Entity List | 3D NAND memory |
| CXMT | 长鑫存储技术有限公司 | 91340100MA2NUQJDXA | Entity List | DRAM manufacturer |
| Fujian Jinhua | 福建省晋华集成电路有限公司 | 91350500MA31U1NB65 | Entity List (2018) | DRAM, first major listing |
| Shanghai Micro Electronics | 上海微电子装备（集团）股份有限公司 | 91310000607239733Q | Entity List | Lithography equipment |
| Naura Technology | 北方华创科技集团股份有限公司 | 91110000633197242N | Entity List | Semiconductor equipment |
| ACM Research Shanghai | 盛美上海半导体设备股份有限公司 | 91310000598736117B | Watch list | Cleaning equipment, US parent |

### AI & Surveillance

| Entity | Chinese Name | USCC | Risk Flags | Notes |
|--------|-------------|------|------------|-------|
| Hikvision | 杭州海康威视数字技术股份有限公司 | 91330100733796106P | Entity List, CMC List, Xinjiang | CETC subsidiary, surveillance |
| Dahua Technology | 浙江大华技术股份有限公司 | 91330000734288727H | Entity List, Xinjiang | Surveillance equipment |
| SenseTime | 商汤科技开发有限公司 | 91110108MA01KWNA2F | NS-CMIC, Entity List | Facial recognition AI |
| Megvii Technology | 北京旷视科技有限公司 | 91110108551812771T | Entity List | Face++ technology |
| iFlytek | 科大讯飞股份有限公司 | 913400007094809498 | Entity List | Voice recognition AI |
| CloudWalk Technology | 云从科技集团股份有限公司 | 91440101MA59ERA95B | Entity List, NS-CMIC | Facial recognition |
| Yitu Technology | 依图网络科技有限公司 | 91310000310528867A | Entity List, NS-CMIC | AI unicorn |
| DeepSeek | 杭州深度求索人工智能基础技术研究有限公司 | [To research] | Under investigation | High-Flyer connection |
| High-Flyer Capital | 宁波幻方量化投资管理合伙企业 | [To research] | Watch list | DeepSeek parent, quant fund |

### Aerospace & Defense (AVIC Ecosystem)

| Entity | Chinese Name | USCC | Risk Flags | Notes |
|--------|-------------|------|------------|-------|
| AVIC | 中国航空工业集团有限公司 | 91110000100006821L | Entity List, MEU, NS-CMIC, Central SOE | Parent of 100+ subsidiaries |
| AVIC Aircraft | 中航西安飞机工业集团股份有限公司 | 91610000220513273N | BIS 50% Captured | Military aircraft |
| AVIC Shenyang | 中航沈飞股份有限公司 | 9121010612413986XQ | BIS 50% Captured | Fighter jets |
| AVIC Helicopter | 中航直升机股份有限公司 | 91360000158269886P | BIS 50% Captured | Military helicopters |
| AVIC International | 中国航空技术国际控股有限公司 | [HK listed] | BIS 50% Captured | International trading arm |
| Hongdu Aviation | 江西洪都航空工业股份有限公司 | 913600007053453282 | BIS 50% Captured, CMC List | Trainer aircraft |
| AECC | 中国航空发动机集团有限公司 | 91110000MA002GYT4X | Entity List, MEU, Central SOE | Jet engines, spun off from AVIC |
| COMAC | 中国商用飞机有限责任公司 | 91310000664839tried | MEU, Central SOE | C919 commercial aircraft |

### Defense Electronics (CETC Ecosystem)

| Entity | Chinese Name | USCC | Risk Flags | Notes |
|--------|-------------|------|------------|-------|
| CETC | 中国电子科技集团有限公司 | 91110000100007986L | Entity List, MEU, NS-CMIC, Central SOE | Defense electronics parent |
| CETC 14th Institute | 中国电子科技集团公司第十四研究所 | 91320100466006417D | Entity List, MEU | Radar systems |
| CETC 38th Institute | 中国电子科技集团公司第三十八研究所 | 91340100150224741A | Entity List | Electronic warfare |
| CETC 54th Institute | 中国电子科技集团公司第五十四研究所 | 91130100104434917B | Entity List | Communications |
| Hikvision (CETC sub) | [See above] | [See above] | Entity List, CMC List | 42% owned by CETC |
| CETC Nanjing Panda | 南京熊猫电子股份有限公司 | 91320000134795386Q | BIS 50% Captured | Communications equipment |

### Weapons & Ordnance (NORINCO Ecosystem)

| Entity | Chinese Name | USCC | Risk Flags | Notes |
|--------|-------------|------|------------|-------|
| NORINCO | 中国兵器工业集团有限公司 | 91110000100000025L | Entity List, MEU, NS-CMIC, Central SOE | Weapons manufacturer |
| NORINCO International | 北方工业公司 | 91110000100001188G | SDN, Entity List | Arms trading |
| Inner Mongolia First Machinery | 内蒙古第一机械集团股份有限公司 | 91150100115abortr | CMC List | Tank manufacturer |
| China North Vehicle | 中国北方车辆研究所 | [Research institute] | MEU | Armored vehicles |

### Space & Missiles (CASC/CASIC)

| Entity | Chinese Name | USCC | Risk Flags | Notes |
|--------|-------------|------|------------|-------|
| CASC | 中国航天科技集团有限公司 | 91110000100001091U | Entity List, MEU, NS-CMIC, Central SOE | Space & ICBMs |
| CASIC | 中国航天科工集团有限公司 | 91110000100001105M | Entity List, MEU, NS-CMIC, Central SOE | Cruise missiles |
| China Spacesat | 中国东方红卫星股份有限公司 | 91110000633051493L | BIS 50% Captured | Satellite manufacturing |
| CALT | 中国运载火箭技术研究院 | [Research institute] | Entity List | Launch vehicles |
| Rainbow UAV | 彩虹无人机科技有限公司 | [To research] | MEU | Combat drones |

### Shipbuilding

| Entity | Chinese Name | USCC | Risk Flags | Notes |
|--------|-------------|------|------------|-------|
| CSSC | 中国船舶集团有限公司 | 91110000100000019Q | Entity List, MEU, NS-CMIC, Central SOE | Merged CSIC + CSSC |
| Dalian Shipbuilding | 大连船舶重工集团有限公司 | 91210200241847584X | BIS 50% Captured | Aircraft carriers |
| Jiangnan Shipyard | 江南造船（集团）有限责任公司 | 91310000132213858T | BIS 50% Captured | Destroyers |

### Nuclear

| Entity | Chinese Name | USCC | Risk Flags | Notes |
|--------|-------------|------|------------|-------|
| CNNC | 中国核工业集团有限公司 | 91110000100001653D | Entity List, MEU, Central SOE | Nuclear weapons & power |
| CGN | 中国广核集团有限公司 | 91440300192241036E | Entity List | Nuclear power |
| CGNPC | 中广核电力股份有限公司 | 91440300071646920K | BIS 50% Captured | Listed subsidiary |

### Tech Giants (Dual-Use Concerns)

| Entity | Chinese Name | USCC | Risk Flags | Notes |
|--------|-------------|------|------------|-------|
| ByteDance | 北京字节跳动科技有限公司 | 91110108551346566Q | Watch list | TikTok parent, data concerns |
| Tencent | 腾讯控股有限公司 | [HK listed] | CMC List (Jan 2025) | Gaming, WeChat — contested listing |
| Alibaba Group | 阿里巴巴集团控股有限公司 | [Cayman/HK] | Watch list | E-commerce, cloud |
| Baidu | 百度在线网络技术（北京）有限公司 | 91110108717743469K | Watch list | AI, autonomous vehicles |
| DJI | 深圳市大疆创新科技有限公司 | 91440300319049800H | Entity List, CMC List | Consumer & military drones |
| Inspur Group | 浪潮集团有限公司 | 91370000163562573L | Entity List | Server manufacturer |
| Sugon (Dawning) | 中科曙光信息产业股份有限公司 | 91110000101124025K | Entity List | Supercomputers |

### Key Individuals

| Person | Chinese Name | Role | Connected Entities | Notes |
|--------|-------------|------|-------------------|-------|
| Ren Zhengfei | 任正非 | Founder & CEO | Huawei | PLA veteran, owns 1.01% |
| Liang Wenfeng | 梁文锋 | Founder & CEO | DeepSeek, High-Flyer | Controls 84% of DeepSeek |
| Guo Ping | 郭平 | Rotating Chairman | Huawei | One of three rotating chairs |
| Eric Xu (Xu Zhijun) | 徐直军 | Rotating Chairman | Huawei | |
| Ken Hu (Hu Houkun) | 胡厚崑 | Rotating Chairman | Huawei | |
| Meng Wanzhou | 孟晚舟 | CFO | Huawei | Ren's daughter, detained in Canada 2018-2021 |
| Chen Tianshi | 陈天石 | CEO | Cambricon | AI chip unicorn founder |
| Tang Xiao'ou | 汤晓鸥 | Founder | SenseTime | Deceased 2023, CUHK professor |

### Government Bodies

| Entity | Chinese Name | Type | Notes |
|--------|-------------|------|-------|
| SASAC | 国务院国有资产监督管理委员会 | Central Gov | Oversees 97 central SOEs |
| MIIT | 工业和信息化部 | Ministry | Industry & IT regulation |
| SAMR | 国家市场监督管理总局 | Regulator | Corporate registration |
| SASTIND | 国家国防科技工业局 | Defense | Defense industry oversight |
| CMC | 中央军事委员会 | Military | Top military body |
| MSS | 国家安全部 | Intelligence | Ministry of State Security |
| CAS | 中国科学院 | Research | Chinese Academy of Sciences |

---

## Curated Entities JSON Structure

**File**: `data/manual/curated_entities.json`

```json
{
  "metadata": {
    "version": "1.0",
    "last_updated": "2025-02-04",
    "sources": [
      "BIS Entity List (Supplement No. 4 to Part 744)",
      "OFAC SDN List",
      "DoD Section 1260H List (January 2025)",
      "OFAC NS-CMIC List",
      "OpenCorporates",
      "SEC EDGAR Exhibit 21 Filings",
      "SASAC Central SOE List",
      "Manual Research (Wikipedia, Company Websites, News)"
    ]
  },
  "entities": [
    {
      "id": "huawei-001",
      "name_en": "Huawei Technologies Co., Ltd.",
      "name_cn": "华为技术有限公司",
      "name_aliases": [
        "Huawei",
        "华为",
        "HW Technologies"
      ],
      "uscc": "914403001922038216",
      "type": "company",
      "status": "Active",
      "registered_capital": "CNY 40,653,529,800",
      "registered_capital_usd": 5600000000,
      "founded": "1987-09-15",
      "jurisdiction": "Shenzhen, Guangdong, China",
      "address": "Huawei Base, Bantian, Longgang District, Shenzhen",
      "industry": "Telecommunications Equipment",
      "industry_code": "C3921",
      "employees": 207000,
      "description": "Global provider of ICT infrastructure, smart devices, and cloud services. Largest telecommunications equipment manufacturer in the world.",
      "website": "https://www.huawei.com",
      "risk_flags": [
        "entity_list",
        "ns_cmic",
        "military_civil_fusion",
        "cmc_list_1260h"
      ],
      "risk_score": 95,
      "sanctions": [
        {
          "list": "BIS Entity List",
          "date_listed": "2019-05-16",
          "program": "Entity List",
          "citation": "84 FR 22961",
          "reason": "Activities contrary to the national security or foreign policy interests of the United States",
          "status": "Active"
        },
        {
          "list": "NS-CMIC",
          "date_listed": "2021-06-03",
          "program": "EO 13959 / EO 14032",
          "reason": "Chinese Military-Industrial Complex Company",
          "status": "Active"
        },
        {
          "list": "DoD 1260H CMC List",
          "date_listed": "2020-06-24",
          "program": "Section 1260H NDAA",
          "reason": "Chinese Military Company",
          "status": "Active"
        }
      ],
      "timeline": [
        {
          "date": "1987-09-15",
          "event_type": "founding",
          "description": "Company founded by Ren Zhengfei with RMB 21,000 initial capital"
        },
        {
          "date": "2019-05-16",
          "event_type": "sanctions_listing",
          "description": "Added to BIS Entity List along with 68 affiliates",
          "significance": "high"
        },
        {
          "date": "2019-05-20",
          "event_type": "regulatory_action",
          "description": "Google suspends Huawei's Android license"
        },
        {
          "date": "2020-05-15",
          "event_type": "sanctions_expansion",
          "description": "BIS Foreign Direct Product Rule extended to Huawei"
        },
        {
          "date": "2020-08-17",
          "event_type": "sanctions_expansion",
          "description": "BIS expands FDPR, cuts off all chip supply"
        }
      ]
    },
    {
      "id": "hisilicon-001",
      "name_en": "HiSilicon Technologies Co., Ltd.",
      "name_cn": "海思半导体有限公司",
      "name_aliases": [
        "HiSilicon",
        "海思",
        "Huawei HiSilicon"
      ],
      "uscc": "91440300708409955J",
      "type": "company",
      "status": "Active",
      "registered_capital": "CNY 60,000,000",
      "founded": "2004-10-18",
      "jurisdiction": "Shenzhen, Guangdong, China",
      "industry": "Semiconductor Design",
      "industry_code": "C3962",
      "description": "Fabless semiconductor company, wholly-owned subsidiary of Huawei. Designs Kirin mobile processors, Ascend AI chips, and Kunpeng server processors.",
      "risk_flags": [
        "entity_list",
        "bis_50_captured",
        "strategic_sector"
      ],
      "risk_score": 95,
      "bis_50_status": {
        "captured": true,
        "reason": "100% owned by Huawei Technologies (Entity List)",
        "capture_chain": ["huawei-001"],
        "effective_ownership_pct": 100
      },
      "sanctions": [
        {
          "list": "BIS Entity List",
          "date_listed": "2019-05-16",
          "citation": "84 FR 22961"
        }
      ]
    },
    {
      "id": "deepseek-001",
      "name_en": "Hangzhou DeepSeek Artificial Intelligence Co., Ltd.",
      "name_cn": "杭州深度求索人工智能基础技术研究有限公司",
      "name_aliases": [
        "DeepSeek",
        "深度求索",
        "DeepSeek AI"
      ],
      "uscc": "[To be researched from NECIPS]",
      "type": "company",
      "status": "Active",
      "founded": "2023-07-17",
      "jurisdiction": "Hangzhou, Zhejiang, China",
      "address": "Same building complex as High-Flyer Capital",
      "industry": "Artificial Intelligence",
      "description": "AI startup developing large language models. Released DeepSeek R1 in January 2025, claimed to rival GPT-4 at fraction of cost. Under US Congressional investigation for potential export control violations and data security concerns.",
      "risk_flags": [
        "under_investigation",
        "potential_export_violation",
        "data_security_concern",
        "china_mobile_connection"
      ],
      "risk_score": 75,
      "congressional_investigation": {
        "committee": "House Select Committee on CCP",
        "date_initiated": "2025-04-16",
        "allegations": [
          "Data funneled to China Mobile (designated CMC)",
          "Potential use of restricted Nvidia chips (H100)",
          "Model distillation from US AI models without authorization"
        ]
      },
      "timeline": [
        {
          "date": "2023-07-17",
          "event_type": "founding",
          "description": "Company registered in Hangzhou"
        },
        {
          "date": "2023-05-01",
          "event_type": "product_launch",
          "description": "Released DeepSeek Coder, first open-source model"
        },
        {
          "date": "2025-01-20",
          "event_type": "product_launch",
          "description": "Released DeepSeek R1, caused $600B Nvidia market cap drop",
          "significance": "high"
        },
        {
          "date": "2025-02-01",
          "event_type": "political_meeting",
          "description": "Founder Liang Wenfeng met with Xi Jinping"
        },
        {
          "date": "2025-04-16",
          "event_type": "investigation",
          "description": "House Select Committee releases report, sends letter to Nvidia",
          "significance": "high"
        }
      ]
    },
    {
      "id": "highflyer-001",
      "name_en": "High-Flyer Capital Management",
      "name_cn": "宁波幻方量化投资管理合伙企业",
      "name_aliases": [
        "High-Flyer Quant",
        "幻方量化",
        "Ningbo Cheng'en"
      ],
      "type": "company",
      "status": "Active",
      "founded": "2015",
      "jurisdiction": "Ningbo, Zhejiang, China",
      "industry": "Quantitative Trading / Asset Management",
      "description": "Quantitative hedge fund that provided initial $420M+ investment into DeepSeek. Owns Firefly supercomputing infrastructure with 10,000+ Nvidia A100 GPUs. Liang Wenfeng controls 85% stake.",
      "risk_flags": [
        "deepseek_parent",
        "potential_chip_accumulation",
        "ai_infrastructure"
      ],
      "risk_score": 65
    },
    {
      "id": "smic-001",
      "name_en": "Semiconductor Manufacturing International Corporation",
      "name_cn": "中芯国际集成电路制造有限公司",
      "name_aliases": [
        "SMIC",
        "中芯国际"
      ],
      "uscc": "91310000677322415Y",
      "type": "company",
      "status": "Active",
      "registered_capital": "USD 5,643,492,200",
      "founded": "2000-04-03",
      "jurisdiction": "Shanghai, China",
      "industry": "Semiconductor Manufacturing",
      "description": "Largest semiconductor foundry in mainland China. Allegedly produced 7nm chips for Huawei despite US export controls.",
      "risk_flags": [
        "entity_list",
        "meu_list",
        "ns_cmic",
        "potential_fdpr_violation"
      ],
      "risk_score": 95,
      "sanctions": [
        {
          "list": "BIS Entity List",
          "date_listed": "2020-12-18",
          "citation": "85 FR 83418",
          "reason": "Risk of diversion to military end use"
        },
        {
          "list": "Military End User List",
          "date_listed": "2020-12-18"
        },
        {
          "list": "NS-CMIC",
          "date_listed": "2020-12-03"
        }
      ],
      "huawei_connection": {
        "description": "Allegedly produced 7nm Kirin 9000s chip found in Huawei Mate 60 Pro (August 2023)",
        "source": "TechInsights teardown analysis"
      }
    },
    {
      "id": "avic-001",
      "name_en": "Aviation Industry Corporation of China, Ltd.",
      "name_cn": "中国航空工业集团有限公司",
      "name_aliases": [
        "AVIC",
        "中航工业",
        "China Aviation"
      ],
      "uscc": "91110000100006821L",
      "type": "company",
      "status": "Active",
      "registered_capital": "CNY 164,200,000,000",
      "founded": "2008-11-06",
      "jurisdiction": "Beijing, China",
      "industry": "Aerospace & Defense",
      "description": "Chinese state-owned aerospace and defense conglomerate. One of the 'backbone' military-industrial groups. Produces military aircraft including J-20 stealth fighter.",
      "risk_flags": [
        "entity_list",
        "meu_list",
        "ns_cmic",
        "cmc_list_1260h",
        "central_soe",
        "defense_industrial_base",
        "military_civil_fusion"
      ],
      "risk_score": 100,
      "state_ownership": {
        "owner": "SASAC",
        "percentage": 100,
        "type": "Central SOE"
      },
      "subsidiary_count": 100,
      "sanctions": [
        {
          "list": "BIS Entity List",
          "reason": "Military end use concerns"
        },
        {
          "list": "Military End User List"
        },
        {
          "list": "NS-CMIC"
        },
        {
          "list": "DoD 1260H CMC List"
        }
      ]
    },
    {
      "id": "cetc-001",
      "name_en": "China Electronics Technology Group Corporation",
      "name_cn": "中国电子科技集团有限公司",
      "name_aliases": [
        "CETC",
        "中国电科"
      ],
      "uscc": "91110000100007986L",
      "type": "company",
      "status": "Active",
      "jurisdiction": "Beijing, China",
      "industry": "Defense Electronics",
      "description": "State-owned defense electronics conglomerate. Controls Hikvision (42% stake). Won most AI-related PLA contracts per CSET research. 50+ research institutes.",
      "risk_flags": [
        "entity_list",
        "meu_list",
        "ns_cmic",
        "cmc_list_1260h",
        "central_soe",
        "hikvision_parent",
        "pla_contractor"
      ],
      "risk_score": 100,
      "state_ownership": {
        "owner": "SASAC",
        "percentage": 100,
        "type": "Central SOE"
      }
    },
    {
      "id": "hikvision-001",
      "name_en": "Hangzhou Hikvision Digital Technology Co., Ltd.",
      "name_cn": "杭州海康威视数字技术股份有限公司",
      "name_aliases": [
        "Hikvision",
        "海康威视"
      ],
      "uscc": "91330100733796106P",
      "type": "company",
      "status": "Active",
      "jurisdiction": "Hangzhou, Zhejiang, China",
      "industry": "Video Surveillance",
      "description": "World's largest video surveillance equipment manufacturer. 42% owned by CETC. Products used in Xinjiang detention facilities.",
      "risk_flags": [
        "entity_list",
        "cmc_list_1260h",
        "xinjiang_surveillance",
        "uyghur_human_rights"
      ],
      "risk_score": 95,
      "cetc_ownership": {
        "percentage": 42,
        "note": "CETC is largest shareholder via CETHIK Group"
      },
      "sanctions": [
        {
          "list": "BIS Entity List",
          "date_listed": "2019-10-07",
          "reason": "Implicated in human rights violations in Xinjiang"
        },
        {
          "list": "DoD 1260H CMC List"
        }
      ],
      "human_rights_concerns": [
        "Surveillance equipment deployed in Xinjiang internment camps",
        "Facial recognition systems targeting Uyghur population",
        "Contracts with Xinjiang Public Security Bureau"
      ]
    }
  ],
  "relationships": [
    {
      "id": "rel-001",
      "from": "huawei-union-001",
      "to": "huawei-001",
      "type": "OWNS",
      "percentage": 98.99,
      "start_date": "2019-01-01",
      "source": "NECIPS filing"
    },
    {
      "id": "rel-002",
      "from": "ren-zhengfei-001",
      "to": "huawei-001",
      "type": "OWNS",
      "percentage": 1.01,
      "source": "NECIPS filing"
    },
    {
      "id": "rel-003",
      "from": "huawei-001",
      "to": "hisilicon-001",
      "type": "OWNS",
      "percentage": 100,
      "start_date": "2004-10-18",
      "source": "OpenCorporates"
    },
    {
      "id": "rel-004",
      "from": "liang-wenfeng-001",
      "to": "deepseek-001",
      "type": "OWNS",
      "percentage": 84,
      "source": "WireScreen research, House CCP Committee report"
    },
    {
      "id": "rel-005",
      "from": "liang-wenfeng-001",
      "to": "highflyer-001",
      "type": "OWNS",
      "percentage": 85,
      "source": "House CCP Committee report"
    },
    {
      "id": "rel-006",
      "from": "highflyer-001",
      "to": "deepseek-001",
      "type": "INVESTED_IN",
      "amount_usd": 420000000,
      "source": "House CCP Committee report"
    },
    {
      "id": "rel-007",
      "from": "sasac-001",
      "to": "avic-001",
      "type": "CONTROLS",
      "percentage": 100,
      "control_type": "state_ownership"
    },
    {
      "id": "rel-008",
      "from": "sasac-001",
      "to": "cetc-001",
      "type": "CONTROLS",
      "percentage": 100,
      "control_type": "state_ownership"
    },
    {
      "id": "rel-009",
      "from": "cetc-001",
      "to": "hikvision-001",
      "type": "OWNS",
      "percentage": 42,
      "note": "Via CETHIK Group subsidiary"
    }
  ]
}
```

---

## Updated Build Time Estimate

With the expanded scope:

| Component | Original | With Wow Features |
|-----------|----------|-------------------|
| Data ingestion scripts | 4-6 hours | 6-8 hours |
| Neo4j schema + data loading | 3-4 hours | 5-6 hours |
| FastAPI endpoints | 4-6 hours | 8-10 hours |
| React app structure + routing | 2-3 hours | 2-3 hours |
| Entity profile page | 4-6 hours | 6-8 hours |
| Network graph visualization | 6-8 hours | 6-8 hours |
| BIS 50% tracer | 4-6 hours | 4-6 hours |
| Organization screener | 3-4 hours | 3-4 hours |
| Chat interface + LangChain | 4-6 hours | 4-6 hours |
| **Entity Timeline (WOW 1)** | - | 6-8 hours |
| **Risk Narrative Generator (WOW 2)** | - | 4-6 hours |
| Styling + polish | 4-6 hours | 6-8 hours |
| **Total** | **38-55 hours** | **55-80 hours** |

The expanded POC is 2-3 weeks of focused effort, but the wow features are what separate "solid technical demo" from "holy shit, this person gets our product."

