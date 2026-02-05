"""
Load curated entities and relationships into Neo4j.

This script:
1. Creates schema constraints and indexes
2. Loads entities (Company, Person, GovernmentBody)
3. Creates relationships (OWNS, OFFICER_OF, CONTROLS)
4. Computes BIS 50% rule captures
"""

import json
import logging
import os
from pathlib import Path
from datetime import datetime

from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent.parent / "data" / "manual"


def get_driver():
    """Create Neo4j driver from environment variables."""
    uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "wirescreen123")

    return GraphDatabase.driver(uri, auth=(user, password))


def create_schema(driver):
    """Create constraints and indexes."""
    queries = [
        # Constraints for unique IDs
        "CREATE CONSTRAINT company_id IF NOT EXISTS FOR (c:Company) REQUIRE c.id IS UNIQUE",
        "CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE",
        "CREATE CONSTRAINT govt_id IF NOT EXISTS FOR (g:GovernmentBody) REQUIRE g.id IS UNIQUE",
        "CREATE CONSTRAINT sanction_id IF NOT EXISTS FOR (s:SanctionEntry) REQUIRE s.id IS UNIQUE",

        # Indexes for search
        "CREATE INDEX company_name_en IF NOT EXISTS FOR (c:Company) ON (c.name_en)",
        "CREATE INDEX company_name_cn IF NOT EXISTS FOR (c:Company) ON (c.name_cn)",
        "CREATE INDEX person_name_en IF NOT EXISTS FOR (p:Person) ON (p.name_en)",
        "CREATE INDEX person_name_cn IF NOT EXISTS FOR (p:Person) ON (p.name_cn)",

        # Indexes for filtering
        "CREATE INDEX company_risk_flags IF NOT EXISTS FOR (c:Company) ON (c.risk_flags)",
        "CREATE INDEX company_bis50 IF NOT EXISTS FOR (c:Company) ON (c.bis_50_captured)",
    ]

    with driver.session() as session:
        for query in queries:
            try:
                session.run(query)
                logger.info(f"Executed: {query[:60]}...")
            except Exception as e:
                logger.warning(f"Schema query failed (may already exist): {e}")


def clear_database(driver):
    """Clear all nodes and relationships (use with caution!)."""
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")
        logger.info("Cleared database")


def load_entity(session, entity: dict):
    """Load a single entity into Neo4j."""
    entity_type = entity.get("type", "company")

    if entity_type == "company":
        label = "Company"
    elif entity_type == "person":
        label = "Person"
    elif entity_type == "government":
        label = "GovernmentBody"
    else:
        label = "Company"

    # Build properties
    props = {
        "id": entity["id"],
        "name_en": entity.get("name_en", ""),
        "name_cn": entity.get("name_cn"),
        "description": entity.get("description"),
        "risk_flags": entity.get("risk_flags", []),
        "risk_score": entity.get("risk_score"),
    }

    # Add type-specific properties
    if entity_type == "company":
        props.update({
            "uscc": entity.get("uscc"),
            "status": entity.get("status"),
            "registered_capital": entity.get("registered_capital"),
            "founded": entity.get("founded"),
            "jurisdiction": entity.get("jurisdiction"),
            "industry": entity.get("industry"),
            "bis_50_captured": entity.get("bis_50_captured", False),
        })
    elif entity_type == "person":
        props.update({
            "pinyin": entity.get("pinyin"),
            "nationality": entity.get("nationality"),
            "is_pep": entity.get("is_pep", False),
        })
    elif entity_type == "government":
        props.update({
            "level": entity.get("level"),
            "body_type": entity.get("body_type"),
        })

    # Remove None values
    props = {k: v for k, v in props.items() if v is not None}

    query = f"""
    MERGE (n:{label} {{id: $id}})
    SET n += $props
    RETURN n.id
    """

    session.run(query, id=entity["id"], props=props)

    # Create sanction entries if present
    for sanction in entity.get("sanctions", []):
        sanction_id = f"sanction-{entity['id']}-{sanction.get('list_name', 'unknown').lower().replace(' ', '-')}"
        sanction_query = """
        MERGE (s:SanctionEntry {id: $sanction_id})
        SET s.list_name = $list_name,
            s.program = $program,
            s.date_listed = $date_listed,
            s.citation = $citation
        WITH s
        MATCH (e {id: $entity_id})
        MERGE (e)-[:SANCTIONED_AS]->(s)
        """
        session.run(
            sanction_query,
            sanction_id=sanction_id,
            entity_id=entity["id"],
            list_name=sanction.get("list_name"),
            program=sanction.get("program"),
            date_listed=sanction.get("date_listed"),
            citation=sanction.get("citation")
        )


def load_relationship(session, rel: dict):
    """Load a relationship into Neo4j."""
    rel_type = rel.get("type", "OWNS")
    from_id = rel.get("from")
    to_id = rel.get("to")

    if not from_id or not to_id:
        logger.warning(f"Invalid relationship: {rel}")
        return

    # Build relationship properties
    props = {}
    if rel.get("percentage") is not None:
        props["percentage"] = rel["percentage"]
    if rel.get("role"):
        props["role"] = rel["role"]
    if rel.get("start_date"):
        props["start_date"] = rel["start_date"]
    if rel.get("end_date"):
        props["end_date"] = rel["end_date"]
    if rel.get("control_type"):
        props["control_type"] = rel["control_type"]
    if rel.get("source"):
        props["source"] = rel["source"]

    # Create relationship
    query = f"""
    MATCH (from {{id: $from_id}})
    MATCH (to {{id: $to_id}})
    MERGE (from)-[r:{rel_type}]->(to)
    SET r += $props
    RETURN type(r)
    """

    session.run(query, from_id=from_id, to_id=to_id, props=props)


def load_timeline_event(session, event: dict):
    """Load a timeline event as a node connected to the entity."""
    event_id = f"event-{event['entity_id']}-{event['date']}-{event['event_type']}"

    query = """
    MERGE (e:TimelineEvent {id: $event_id})
    SET e.entity_id = $entity_id,
        e.date = $date,
        e.event_type = $event_type,
        e.title = $title,
        e.description = $description,
        e.source = $source
    WITH e
    MATCH (entity {id: $entity_id})
    MERGE (entity)-[:HAS_EVENT]->(e)
    """

    session.run(
        query,
        event_id=event_id,
        entity_id=event["entity_id"],
        date=event["date"],
        event_type=event["event_type"],
        title=event["title"],
        description=event.get("description", ""),
        source=event.get("source", "")
    )


def compute_bis50_captures(driver):
    """
    Compute BIS 50% rule captures.

    Marks entities as bis_50_captured if they are >=50% owned
    by Entity List or MEU List parties (directly or through chain).
    """
    query = """
    // Find entities that should be captured by BIS 50% rule
    MATCH (seed:Company)
    WHERE 'entity_list' IN seed.risk_flags
       OR 'meu_list' IN seed.risk_flags

    // Find downstream entities with >=50% ownership at each hop
    MATCH path = (seed)-[:OWNS*1..5]->(target:Company)
    WHERE ALL(rel IN relationships(path) WHERE rel.percentage >= 50)
      AND target <> seed
      AND NOT ('entity_list' IN target.risk_flags)

    WITH target, seed, path,
         [n IN nodes(path) | n.name_en] AS chain_names

    // Mark as captured
    SET target.bis_50_captured = true,
        target.bis_50_reason = 'Owned >=50% by ' + seed.name_en

    RETURN target.id AS captured_id,
           target.name_en AS captured_name,
           seed.name_en AS seed_name,
           chain_names
    """

    with driver.session() as session:
        result = session.run(query)
        captures = list(result)

        logger.info(f"Marked {len(captures)} entities as BIS 50% captured:")
        for record in captures:
            logger.info(f"  {record['captured_name']} <- {record['seed_name']}")

    return captures


def load_curated_data(driver):
    """Load curated entities from JSON file."""
    data_file = DATA_DIR / "curated_entities.json"

    if not data_file.exists():
        logger.error(f"Data file not found: {data_file}")
        return

    with open(data_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    entities = data.get("entities", [])
    relationships = data.get("relationships", [])
    timeline_events = data.get("timeline_events", [])

    logger.info(f"Loading {len(entities)} entities...")
    with driver.session() as session:
        for entity in entities:
            load_entity(session, entity)
            logger.debug(f"  Loaded: {entity.get('name_en', entity['id'])}")

    logger.info(f"Loading {len(relationships)} relationships...")
    with driver.session() as session:
        for rel in relationships:
            load_relationship(session, rel)

    logger.info(f"Loading {len(timeline_events)} timeline events...")
    with driver.session() as session:
        for event in timeline_events:
            load_timeline_event(session, event)


def main():
    """Main entry point."""
    logger.info("Starting Neo4j data load...")

    driver = get_driver()

    try:
        # Test connection
        with driver.session() as session:
            result = session.run("RETURN 1 AS test")
            result.single()
            logger.info("Connected to Neo4j successfully")

        # Create schema
        logger.info("Creating schema...")
        create_schema(driver)

        # Clear existing data (comment out to append)
        logger.info("Clearing existing data...")
        clear_database(driver)

        # Load curated data
        load_curated_data(driver)

        # Compute BIS 50% captures
        logger.info("Computing BIS 50% rule captures...")
        compute_bis50_captures(driver)

        logger.info("Data load complete!")

        # Print summary
        with driver.session() as session:
            result = session.run("""
                MATCH (n)
                RETURN labels(n)[0] AS label, count(*) AS count
                ORDER BY count DESC
            """)
            logger.info("Node counts:")
            for record in result:
                logger.info(f"  {record['label']}: {record['count']}")

            result = session.run("""
                MATCH ()-[r]->()
                RETURN type(r) AS type, count(*) AS count
                ORDER BY count DESC
            """)
            logger.info("Relationship counts:")
            for record in result:
                logger.info(f"  {record['type']}: {record['count']}")

    finally:
        driver.close()


if __name__ == "__main__":
    main()
