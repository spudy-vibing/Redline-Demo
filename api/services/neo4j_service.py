"""
Neo4j service layer for querying the knowledge graph.
"""

import os
import logging
from contextlib import contextmanager
from typing import Optional

from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class Neo4jService:
    """Service for Neo4j graph database operations."""

    def __init__(self):
        self.uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.user = os.getenv("NEO4J_USER", "neo4j")
        self.password = os.getenv("NEO4J_PASSWORD", "wirescreen123")
        self._driver = None

    @property
    def driver(self):
        if self._driver is None:
            self._driver = GraphDatabase.driver(
                self.uri,
                auth=(self.user, self.password)
            )
        return self._driver

    def close(self):
        if self._driver:
            self._driver.close()
            self._driver = None

    @contextmanager
    def session(self):
        session = self.driver.session()
        try:
            yield session
        finally:
            session.close()

    def search_entities(
        self,
        query: str,
        limit: int = 20,
        entity_type: Optional[str] = None
    ) -> list[dict]:
        """
        Search entities by name (English, Chinese, or pinyin).
        """
        # Build label filter
        label_filter = ""
        if entity_type:
            label_map = {
                "company": "Company",
                "person": "Person",
                "government": "GovernmentBody"
            }
            label = label_map.get(entity_type.lower())
            if label:
                label_filter = f"AND '{label}' IN labels(n)"

        cypher = f"""
        MATCH (n)
        WHERE (n:Company OR n:Person OR n:GovernmentBody)
          AND (
            toLower(n.name_en) CONTAINS toLower($query)
            OR toLower(n.name_cn) CONTAINS toLower($query)
            OR toLower(coalesce(n.pinyin, '')) CONTAINS toLower($query)
          )
          {label_filter}
        RETURN n.id AS id,
               n.name_en AS name_en,
               n.name_cn AS name_cn,
               labels(n)[0] AS type,
               n.risk_flags AS risk_flags,
               n.jurisdiction AS jurisdiction,
               n.risk_score AS risk_score
        ORDER BY n.risk_score DESC NULLS LAST, n.name_en
        LIMIT $limit
        """

        with self.session() as session:
            result = session.run(cypher, query=query, limit=limit)
            return [dict(record) for record in result]

    def get_entity(self, entity_id: str) -> Optional[dict]:
        """Get full entity details by ID."""
        cypher = """
        MATCH (n {id: $entity_id})
        OPTIONAL MATCH (n)-[:SANCTIONED_AS]->(s:SanctionEntry)
        OPTIONAL MATCH (n)-[:HAS_EVENT]->(e:TimelineEvent)
        WITH n, collect(DISTINCT s) AS sanctions, collect(DISTINCT e) AS events
        RETURN n {
            .*,
            type: labels(n)[0],
            sanctions: [s IN sanctions | s {.*}],
            timeline_events: [e IN events | e {.*}]
        } AS entity
        """

        with self.session() as session:
            result = session.run(cypher, entity_id=entity_id)
            record = result.single()
            if record:
                return dict(record["entity"])
            return None

    def get_entity_network(
        self,
        entity_id: str,
        depth: int = 2
    ) -> dict:
        """
        Get network graph centered on an entity.

        Returns nodes and edges for visualization.
        """
        cypher = """
        MATCH (center {id: $entity_id})

        // Get connected nodes up to specified depth
        CALL {
            WITH center
            MATCH path = (center)-[r:OWNS|OFFICER_OF|CONTROLS|SUBSIDIARY_OF*1..$depth]-(connected)
            RETURN connected, relationships(path) AS rels
            UNION
            WITH center
            RETURN center AS connected, [] AS rels
        }

        WITH collect(DISTINCT connected) AS nodes,
             collect(DISTINCT rels) AS all_rels

        // Flatten relationships
        UNWIND all_rels AS rel_list
        UNWIND rel_list AS rel

        WITH nodes, collect(DISTINCT rel) AS edges

        RETURN
            [n IN nodes | {
                id: n.id,
                name: coalesce(n.name_en, n.name_cn, n.id),
                type: labels(n)[0],
                risk_flags: coalesce(n.risk_flags, []),
                bis_50_captured: coalesce(n.bis_50_captured, false),
                risk_score: n.risk_score
            }] AS nodes,
            [e IN edges | {
                source: startNode(e).id,
                target: endNode(e).id,
                type: type(e),
                percentage: e.percentage,
                role: e.role
            }] AS edges
        """

        with self.session() as session:
            result = session.run(cypher, entity_id=entity_id, depth=depth)
            record = result.single()
            if record:
                return {
                    "nodes": record["nodes"],
                    "edges": record["edges"],
                    "center_id": entity_id
                }
            return {"nodes": [], "edges": [], "center_id": entity_id}

    def get_bis50_analysis(self, entity_id: str) -> dict:
        """
        Analyze entity for BIS 50% rule capture.

        Returns ownership chains and capture determination.
        """
        # Check if directly on Entity List
        direct_check = """
        MATCH (n {id: $entity_id})
        RETURN n.risk_flags AS risk_flags,
               n.bis_50_captured AS bis_50_captured,
               n.bis_50_reason AS bis_50_reason
        """

        with self.session() as session:
            result = session.run(direct_check, entity_id=entity_id)
            record = result.single()

            if not record:
                return {
                    "entity_id": entity_id,
                    "captured": False,
                    "reason": "Entity not found"
                }

            risk_flags = record["risk_flags"] or []

            # If directly on Entity List
            if "entity_list" in risk_flags or "meu_list" in risk_flags:
                return {
                    "entity_id": entity_id,
                    "captured": True,
                    "reason": "Directly listed on Entity List/MEU List",
                    "is_direct_listing": True,
                    "ownership_chains": []
                }

            # If marked as BIS 50% captured
            if record["bis_50_captured"]:
                # Get the ownership chain
                chain_query = """
                MATCH (target {id: $entity_id})
                MATCH path = (seed:Company)-[:OWNS*1..5]->(target)
                WHERE ('entity_list' IN seed.risk_flags OR 'meu_list' IN seed.risk_flags)
                  AND ALL(rel IN relationships(path) WHERE rel.percentage >= 50)
                RETURN seed.id AS seed_id,
                       seed.name_en AS seed_name,
                       [n IN nodes(path) | {id: n.id, name: n.name_en}] AS chain,
                       [r IN relationships(path) | r.percentage] AS percentages,
                       reduce(pct = 100.0, r IN relationships(path) | pct * r.percentage / 100) AS effective_pct
                """

                result = session.run(chain_query, entity_id=entity_id)
                chains = []
                for rec in result:
                    chains.append({
                        "seed_id": rec["seed_id"],
                        "seed_name": rec["seed_name"],
                        "chain": rec["chain"],
                        "percentages": rec["percentages"],
                        "effective_percentage": rec["effective_pct"]
                    })

                return {
                    "entity_id": entity_id,
                    "captured": True,
                    "reason": record["bis_50_reason"],
                    "is_direct_listing": False,
                    "ownership_chains": chains
                }

            # Check aggregate ownership
            aggregate_query = """
            MATCH (target {id: $entity_id})
            MATCH (listed:Company)-[r:OWNS]->(target)
            WHERE 'entity_list' IN listed.risk_flags
               OR 'meu_list' IN listed.risk_flags
            WITH target, sum(r.percentage) AS total_listed_ownership,
                 collect({id: listed.id, name: listed.name_en, pct: r.percentage}) AS owners
            RETURN total_listed_ownership, owners
            """

            result = session.run(aggregate_query, entity_id=entity_id)
            record = result.single()

            if record and record["total_listed_ownership"] and record["total_listed_ownership"] >= 50:
                return {
                    "entity_id": entity_id,
                    "captured": True,
                    "reason": f"Aggregate ownership by listed parties: {record['total_listed_ownership']}%",
                    "is_direct_listing": False,
                    "aggregate_percentage": record["total_listed_ownership"],
                    "listed_owners": record["owners"]
                }

            return {
                "entity_id": entity_id,
                "captured": False,
                "reason": "Not captured by BIS 50% rule"
            }

    def screen_entities(self, names: list[str]) -> list[dict]:
        """
        Screen a list of entity names against the database.

        Returns matching entities with risk assessment.
        """
        results = []

        for name in names:
            # Search for matches
            matches = self.search_entities(name, limit=5)

            if matches:
                best_match = matches[0]

                # Determine risk level
                risk_flags = best_match.get("risk_flags") or []
                risk_score = best_match.get("risk_score") or 0

                if "entity_list" in risk_flags or "meu_list" in risk_flags:
                    risk_level = "critical"
                elif "ns_cmic" in risk_flags or "cmc_1260h" in risk_flags:
                    risk_level = "high"
                elif "bis_50_captured" in risk_flags:
                    risk_level = "high"
                elif risk_score >= 70:
                    risk_level = "medium"
                elif risk_score >= 40:
                    risk_level = "low"
                else:
                    risk_level = "clear"

                results.append({
                    "input_name": name,
                    "matched_entity": best_match,
                    "match_score": 1.0 if best_match["name_en"].lower() == name.lower() else 0.8,
                    "risk_level": risk_level,
                    "flags": risk_flags,
                    "bis_50_captured": "bis_50_captured" in risk_flags
                })
            else:
                results.append({
                    "input_name": name,
                    "matched_entity": None,
                    "match_score": 0.0,
                    "risk_level": "unknown",
                    "flags": [],
                    "bis_50_captured": False
                })

        return results

    def get_entity_timeline(self, entity_id: str) -> list[dict]:
        """Get timeline events for an entity."""
        cypher = """
        MATCH (n {id: $entity_id})-[:HAS_EVENT]->(e:TimelineEvent)
        RETURN e {.*} AS event
        ORDER BY e.date DESC
        """

        with self.session() as session:
            result = session.run(cypher, entity_id=entity_id)
            return [dict(record["event"]) for record in result]

    def get_ownership_tree(self, entity_id: str, direction: str = "down") -> dict:
        """
        Get ownership tree for an entity.

        direction: "down" for subsidiaries, "up" for parents
        """
        if direction == "down":
            cypher = """
            MATCH (root {id: $entity_id})
            OPTIONAL MATCH path = (root)-[:OWNS*1..5]->(child)
            WITH root, collect(path) AS paths
            RETURN root {
                .*,
                type: labels(root)[0]
            } AS root_node,
            [p IN paths |
                [n IN nodes(p)[1..] | n {.*, type: labels(n)[0]}]
            ] AS descendants
            """
        else:
            cypher = """
            MATCH (target {id: $entity_id})
            OPTIONAL MATCH path = (parent)-[:OWNS*1..5]->(target)
            WITH target, collect(path) AS paths
            RETURN target {
                .*,
                type: labels(target)[0]
            } AS root_node,
            [p IN paths |
                [n IN nodes(p)[..-1] | n {.*, type: labels(n)[0]}]
            ] AS ancestors
            """

        with self.session() as session:
            result = session.run(cypher, entity_id=entity_id)
            record = result.single()
            if record:
                return {
                    "root": dict(record["root_node"]) if record["root_node"] else None,
                    "related": record.get("descendants") or record.get("ancestors") or []
                }
            return {"root": None, "related": []}


# Singleton instance
_neo4j_service: Optional[Neo4jService] = None


def get_neo4j_service() -> Neo4jService:
    """Get or create Neo4j service singleton."""
    global _neo4j_service
    if _neo4j_service is None:
        _neo4j_service = Neo4jService()
    return _neo4j_service
