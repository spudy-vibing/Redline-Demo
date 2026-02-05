"""
Chat API endpoint for natural language queries over the knowledge graph.
"""

import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.neo4j_service import get_neo4j_service

router = APIRouter(prefix="/api", tags=["chat"])


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    answer: str
    cypher_query: str | None = None
    sources: list[dict] = Field(default_factory=list)
    generated_by: str = "template"


# Schema description for the LLM
GRAPH_SCHEMA = """
Neo4j Graph Schema:

Node Labels:
- Company: id, name_en, name_cn, jurisdiction, industry, risk_score, risk_flags[], description, uscc, founded, status, bis_50_captured
- Person: id, name_en, name_cn, nationality, description, risk_flags[]
- GovernmentBody: id, name_en, name_cn, level, body_type, description
- SanctionEntry: id, list_name, program, date_listed, citation
- TimelineEvent: id, entity_id, date, event_type, title, description, source

Relationships:
- (Company|Person)-[:OWNS {percentage: float}]->(Company)
- (Person)-[:OFFICER_OF {role: string}]->(Company)
- (GovernmentBody)-[:CONTROLS {percentage: float}]->(Company)
- (Company|Person)-[:SANCTIONED_AS]->(SanctionEntry)
- (Company|Person)-[:HAS_EVENT]->(TimelineEvent)

Risk Flags (in risk_flags array):
- entity_list: BIS Entity List
- meu_list: Military End User List
- ns_cmic: Non-SDN Chinese Military-Industrial Complex
- cmc_1260h: Section 1260H Chinese Military Company
- xinjiang_uyghur: Xinjiang/Uyghur related
- military_civil_fusion: Military-Civil Fusion participant
- central_soe: Central state-owned enterprise
- defense_industrial_base: Defense industrial base company
- bis_50_captured: Captured by BIS 50% Rule

Common Entities:
- huawei-001: Huawei Technologies
- hisilicon-001: HiSilicon (Huawei subsidiary)
- smic-001: SMIC (semiconductor foundry)
- deepseek-001: DeepSeek (AI lab)
- avic-001: AVIC (aerospace/defense)
- cetc-001: CETC (defense electronics)
- hikvision-001: Hikvision (surveillance)
"""


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Natural language query over the knowledge graph.

    Converts questions to Cypher queries and returns grounded answers.
    Example questions:
    - "Who are Huawei's major subsidiaries?"
    - "Which companies are on the Entity List?"
    - "Is SMIC connected to the Chinese military?"
    - "Show me semiconductor companies captured by BIS 50%"
    """
    import os
    from anthropic import Anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY")

    if not api_key or api_key.startswith("sk-ant-your"):
        # No valid API key - use template responses
        return handle_template_response(request.message)

    try:
        client = Anthropic(api_key=api_key)
        service = get_neo4j_service()

        # Step 1: Generate Cypher query from natural language
        cypher_query = generate_cypher_query(client, request.message, request.history)

        # Step 2: Execute the query
        if cypher_query:
            try:
                results = execute_cypher_query(service, cypher_query)
            except Exception as e:
                results = {"error": str(e)}
        else:
            results = None

        # Step 3: Generate natural language response
        answer = generate_answer(client, request.message, cypher_query, results, request.history)

        # Extract sources from results
        sources = extract_sources(results) if results and "error" not in results else []

        return ChatResponse(
            answer=answer,
            cypher_query=cypher_query,
            sources=sources,
            generated_by="claude"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


def generate_cypher_query(client, question: str, history: list[ChatMessage]) -> str | None:
    """Use Claude to generate a Cypher query from natural language."""

    # Build conversation context
    history_text = ""
    if history:
        history_text = "\n\nConversation history:\n"
        for msg in history[-4:]:  # Last 4 messages for context
            history_text += f"{msg.role}: {msg.content}\n"

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=500,
        system=f"""You are an expert at converting natural language questions into Neo4j Cypher queries.

{GRAPH_SCHEMA}

Rules:
1. Generate ONLY a valid Cypher query - no explanations, no markdown
2. Use OPTIONAL MATCH for relationships that might not exist
3. Always limit results to 20 unless asked for more
4. Return relevant properties (id, name_en, name_cn, risk_flags, etc.)
5. If the question cannot be answered with a Cypher query (e.g., opinion questions), return exactly: NO_QUERY
6. For questions about subsidiaries, use: MATCH (parent)-[:OWNS]->(sub)
7. For questions about sanctions, check risk_flags array or SANCTIONED_AS relationships
8. For BIS 50% captured entities, check bis_50_captured property or 'bis_50_captured' in risk_flags""",
        messages=[{
            "role": "user",
            "content": f"{history_text}\n\nQuestion: {question}\n\nGenerate a Cypher query to answer this question:"
        }]
    )

    query = response.content[0].text.strip()

    # Remove markdown code blocks if present
    if query.startswith("```"):
        lines = query.split("\n")
        # Skip the first line (```cypher or similar) and last line (```)
        if lines[-1].strip() == "```":
            query = "\n".join(lines[1:-1])
        else:
            query = "\n".join(lines[1:])
        query = query.strip()

    if query == "NO_QUERY" or not query.upper().startswith(("MATCH", "OPTIONAL", "CALL", "WITH")):
        return None

    return query.strip()


def execute_cypher_query(service, query: str) -> dict:
    """Execute a Cypher query and return results."""
    with service.session() as session:
        result = session.run(query)
        records = [dict(record) for record in result]
        return {"records": records, "count": len(records)}


def generate_answer(client, question: str, cypher_query: str | None, results: dict | None, history: list[ChatMessage]) -> str:
    """Generate a natural language answer from query results."""

    # Build context
    if results and "error" in results:
        context = f"Query failed with error: {results['error']}"
    elif results and results.get("records"):
        # Serialize results for the LLM
        context = f"Query returned {results['count']} results:\n"
        for i, record in enumerate(results["records"][:10]):  # Limit to first 10
            context += f"\n{i+1}. {format_record(record)}"
        if results["count"] > 10:
            context += f"\n... and {results['count'] - 10} more results"
    elif cypher_query:
        context = "Query returned no results."
    else:
        context = "No database query was needed for this question."

    # Build history context
    history_text = ""
    if history:
        history_text = "\n\nConversation history:\n"
        for msg in history[-4:]:
            history_text += f"{msg.role}: {msg.content}\n"

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=800,
        system="""You are a helpful export control compliance analyst assistant.
Answer questions based on the provided database query results.
Be concise but informative. Use specific data from the results.
If results are empty, say so clearly.
Format entity names with both English and Chinese when available.
Mention risk flags and sanctions status when relevant.
Do not make up information not in the results.""",
        messages=[{
            "role": "user",
            "content": f"{history_text}\n\nQuestion: {question}\n\nDatabase results:\n{context}\n\nProvide a helpful answer:"
        }]
    )

    return response.content[0].text.strip()


def format_record(record: dict) -> str:
    """Format a database record for display."""
    parts = []

    # Handle different record structures
    for key, value in record.items():
        if value is None:
            continue
        if isinstance(value, dict):
            # Nested node properties
            name = value.get("name_en") or value.get("name_cn") or value.get("id", "Unknown")
            if value.get("name_cn") and value.get("name_en"):
                name = f"{value['name_en']} ({value['name_cn']})"
            parts.append(f"{key}: {name}")
            if value.get("risk_flags"):
                parts.append(f"  Risk flags: {', '.join(value['risk_flags'])}")
        elif isinstance(value, list):
            if len(value) > 0 and isinstance(value[0], str):
                parts.append(f"{key}: {', '.join(value)}")
            else:
                parts.append(f"{key}: {len(value)} items")
        else:
            parts.append(f"{key}: {value}")

    return " | ".join(parts) if parts else str(record)


def extract_sources(results: dict) -> list[dict]:
    """Extract entity sources from results."""
    sources = []
    seen_ids = set()

    if not results or "records" not in results:
        return sources

    for record in results["records"]:
        for key, value in record.items():
            if isinstance(value, dict) and "id" in value:
                entity_id = value["id"]
                if entity_id not in seen_ids:
                    seen_ids.add(entity_id)
                    sources.append({
                        "entity_id": entity_id,
                        "name": value.get("name_en") or value.get("name_cn", entity_id),
                        "type": "entity"
                    })

    return sources[:5]  # Limit to 5 sources


def handle_template_response(question: str) -> ChatResponse:
    """Handle common questions with template responses when no API key."""
    question_lower = question.lower()

    service = get_neo4j_service()

    # Pattern matching for common questions
    if "huawei" in question_lower and ("subsidiaries" in question_lower or "owns" in question_lower):
        query = """
        MATCH (h:Company {id: 'huawei-001'})-[:OWNS]->(sub:Company)
        RETURN sub.name_en AS name, sub.name_cn AS chinese_name,
               sub.industry AS industry, sub.risk_flags AS risk_flags
        """
        with service.session() as session:
            results = list(session.run(query))
            if results:
                subs = [f"• {r['name']} ({r['chinese_name']})" for r in results]
                answer = f"Huawei's subsidiaries include:\n" + "\n".join(subs)
            else:
                answer = "No subsidiaries found for Huawei in the database."
        return ChatResponse(answer=answer, cypher_query=query, generated_by="template")

    elif "entity list" in question_lower:
        query = """
        MATCH (c:Company)
        WHERE 'entity_list' IN c.risk_flags
        RETURN c.name_en AS name, c.name_cn AS chinese_name, c.industry AS industry
        LIMIT 20
        """
        with service.session() as session:
            results = list(session.run(query))
            if results:
                companies = [f"• {r['name']} ({r['chinese_name'] or 'N/A'})" for r in results]
                answer = f"Companies on the BIS Entity List ({len(results)} found):\n" + "\n".join(companies)
            else:
                answer = "No Entity List companies found in the database."
        return ChatResponse(answer=answer, cypher_query=query, generated_by="template")

    elif "bis 50" in question_lower or "50%" in question_lower:
        query = """
        MATCH (c:Company)
        WHERE c.bis_50_captured = true OR 'bis_50_captured' IN c.risk_flags
        RETURN c.name_en AS name, c.name_cn AS chinese_name, c.industry AS industry
        """
        with service.session() as session:
            results = list(session.run(query))
            if results:
                companies = [f"• {r['name']} ({r['chinese_name'] or 'N/A'})" for r in results]
                answer = f"Companies captured by BIS 50% Rule ({len(results)} found):\n" + "\n".join(companies)
            else:
                answer = "No companies currently flagged as BIS 50% captured."
        return ChatResponse(answer=answer, cypher_query=query, generated_by="template")

    elif "semiconductor" in question_lower or "chip" in question_lower:
        query = """
        MATCH (c:Company)
        WHERE c.industry CONTAINS 'Semiconductor'
        RETURN c.name_en AS name, c.name_cn AS chinese_name,
               c.risk_score AS risk_score, c.risk_flags AS flags
        ORDER BY c.risk_score DESC
        """
        with service.session() as session:
            results = list(session.run(query))
            if results:
                companies = [f"• {r['name']} (Risk: {r['risk_score']})" for r in results]
                answer = f"Semiconductor companies in the database:\n" + "\n".join(companies)
            else:
                answer = "No semiconductor companies found in the database."
        return ChatResponse(answer=answer, cypher_query=query, generated_by="template")

    elif "deepseek" in question_lower:
        query = """
        MATCH (d:Company {id: 'deepseek-001'})
        OPTIONAL MATCH (parent)-[:OWNS]->(d)
        OPTIONAL MATCH (d)-[:HAS_EVENT]->(e:TimelineEvent)
        RETURN d.name_en AS name, d.description AS description,
               d.risk_flags AS flags, parent.name_en AS parent_company,
               collect(e.title) AS events
        """
        with service.session() as session:
            result = session.run(query).single()
            if result:
                answer = f"DeepSeek ({result['name']}):\n"
                answer += f"• {result['description']}\n"
                answer += f"• Parent company: {result['parent_company'] or 'Unknown'}\n"
                answer += f"• Risk flags: {', '.join(result['flags'] or [])}\n"
                if result['events']:
                    answer += f"• Key events: {', '.join(result['events'][:3])}"
            else:
                answer = "DeepSeek not found in the database."
        return ChatResponse(answer=answer, cypher_query=query, generated_by="template")

    else:
        # Default response
        answer = """I can help you explore the WireScreen knowledge graph. Try asking:
• "Who are Huawei's subsidiaries?"
• "Which companies are on the Entity List?"
• "Show me semiconductor companies"
• "Which companies are captured by BIS 50%?"
• "Tell me about DeepSeek"

For full natural language understanding, please configure an Anthropic API key."""
        return ChatResponse(answer=answer, generated_by="template")
