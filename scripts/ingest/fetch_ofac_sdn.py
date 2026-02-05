"""
Fetch and parse OFAC SDN (Specially Designated Nationals) XML data.

The SDN list contains detailed information including ownership relationships
in the remarks field, which we parse to build our knowledge graph.

Source: https://www.treasury.gov/ofac/downloads/sdn.xml
"""

import json
import logging
import re
from pathlib import Path
from datetime import datetime
from typing import Optional

import httpx
from defusedxml import ElementTree as ET

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SDN_XML_URL = "https://www.treasury.gov/ofac/downloads/sdn.xml"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "data" / "raw"


def fetch_sdn_xml() -> bytes:
    """Fetch the SDN XML file."""
    logger.info(f"Fetching SDN XML from {SDN_XML_URL}...")

    with httpx.Client(timeout=60.0) as client:
        response = client.get(SDN_XML_URL)
        response.raise_for_status()

    logger.info(f"Downloaded {len(response.content)} bytes")
    return response.content


def parse_sdn_xml(xml_content: bytes) -> list[dict]:
    """
    Parse SDN XML and extract entity information.
    """
    root = ET.fromstring(xml_content)

    # Handle namespace
    ns = {"sdn": "http://tempuri.org/sdnList.xsd"}

    entities = []

    # Find all sdnEntry elements
    for entry in root.findall(".//sdnEntry", ns):
        try:
            entity = parse_sdn_entry(entry, ns)
            if entity:
                entities.append(entity)
        except Exception as e:
            uid = entry.findtext("uid", default="unknown", namespaces=ns)
            logger.warning(f"Error parsing entry {uid}: {e}")

    # If namespace didn't work, try without
    if not entities:
        for entry in root.findall(".//sdnEntry"):
            try:
                entity = parse_sdn_entry(entry, {})
                if entity:
                    entities.append(entity)
            except Exception as e:
                logger.warning(f"Error parsing entry: {e}")

    return entities


def parse_sdn_entry(entry, ns: dict) -> Optional[dict]:
    """Parse a single SDN entry."""

    def findtext(elem, path, default=""):
        if ns:
            return elem.findtext(path, default=default, namespaces=ns)
        return elem.findtext(path, default=default)

    def findall(elem, path):
        if ns:
            return elem.findall(path, ns)
        return elem.findall(path)

    uid = findtext(entry, "uid")
    sdn_type = findtext(entry, "sdnType")

    # Get name - structure differs for individuals vs entities
    if sdn_type == "Individual":
        first_name = findtext(entry, ".//firstName", "")
        last_name = findtext(entry, ".//lastName", "")
        name = f"{first_name} {last_name}".strip()
    else:
        name = findtext(entry, ".//lastName") or findtext(entry, ".//sdnName", "")

    # Parse programs
    programs = [p.text for p in findall(entry, ".//program") if p.text]

    # Parse remarks (contains ownership info)
    remarks = findtext(entry, "remarks", "")

    # Parse aliases (AKA names)
    aliases = []
    for aka in findall(entry, ".//aka"):
        aka_name = findtext(aka, "lastName") or findtext(aka, "firstName", "")
        if aka_name:
            aliases.append(aka_name)

    # Parse addresses
    addresses = []
    for addr in findall(entry, ".//address"):
        address = {
            "address1": findtext(addr, "address1", ""),
            "address2": findtext(addr, "address2", ""),
            "address3": findtext(addr, "address3", ""),
            "city": findtext(addr, "city", ""),
            "state": findtext(addr, "stateOrProvince", ""),
            "postal_code": findtext(addr, "postalCode", ""),
            "country": findtext(addr, "country", "")
        }
        # Only add if has meaningful content
        if any(v for v in address.values()):
            addresses.append(address)

    # Parse IDs
    ids = []
    for id_elem in findall(entry, ".//id"):
        id_info = {
            "type": findtext(id_elem, "idType", ""),
            "number": findtext(id_elem, "idNumber", ""),
            "country": findtext(id_elem, "idCountry", "")
        }
        if id_info["number"]:
            ids.append(id_info)

    # Parse nationalities
    nationalities = []
    for nat in findall(entry, ".//nationality"):
        country = findtext(nat, "country", "")
        if country:
            nationalities.append(country)

    return {
        "uid": uid,
        "name": name,
        "type": sdn_type,
        "programs": programs,
        "remarks": remarks,
        "aliases": aliases,
        "addresses": addresses,
        "ids": ids,
        "nationalities": nationalities
    }


def extract_ownership_from_remarks(remarks: str) -> list[dict]:
    """
    Parse ownership relationships from SDN remarks field.

    Common patterns:
    - "Subsidiary of X"
    - "Owned or controlled by X"
    - "Acting for or on behalf of X"
    - "X owns Y% of ..."
    """
    if not remarks:
        return []

    relationships = []

    # Pattern: "Subsidiary of X"
    subsidiary_matches = re.findall(
        r"[Ss]ubsidiary of ([^;\.]+?)(?:\s*[;\.]|$)",
        remarks
    )
    for match in subsidiary_matches:
        relationships.append({
            "type": "SUBSIDIARY_OF",
            "target": match.strip(),
            "source_text": remarks
        })

    # Pattern: "Owned or controlled by X"
    owned_matches = re.findall(
        r"[Oo]wned (?:or controlled |and controlled )?by ([^;\.]+?)(?:\s*[;\.]|$)",
        remarks
    )
    for match in owned_matches:
        relationships.append({
            "type": "OWNED_BY",
            "target": match.strip(),
            "source_text": remarks
        })

    # Pattern: "Acting for or on behalf of X"
    acting_matches = re.findall(
        r"[Aa]cting (?:for or )?on behalf of ([^;\.]+?)(?:\s*[;\.]|$)",
        remarks
    )
    for match in acting_matches:
        relationships.append({
            "type": "ACTING_FOR",
            "target": match.strip(),
            "source_text": remarks
        })

    # Pattern: "Controlled by X"
    controlled_matches = re.findall(
        r"[Cc]ontrolled by ([^;\.]+?)(?:\s*[;\.]|$)",
        remarks
    )
    for match in controlled_matches:
        if not any(r["target"] == match.strip() for r in relationships):
            relationships.append({
                "type": "CONTROLLED_BY",
                "target": match.strip(),
                "source_text": remarks
            })

    # Pattern: percentage ownership "owns X%"
    pct_matches = re.findall(
        r"([A-Z][^;\.]*?)\s+owns?\s+(\d+(?:\.\d+)?)\s*%",
        remarks,
        re.IGNORECASE
    )
    for owner, pct in pct_matches:
        relationships.append({
            "type": "OWNERSHIP_PERCENTAGE",
            "owner": owner.strip(),
            "percentage": float(pct),
            "source_text": remarks
        })

    return relationships


def filter_china_entities(entities: list[dict]) -> list[dict]:
    """Filter for China-related entities."""
    china_countries = {"CHINA", "HONG KONG", "MACAU", "TAIWAN", "CN", "HK", "MO", "TW"}

    china_entities = []
    for entity in entities:
        # Check addresses
        is_china = any(
            addr.get("country", "").upper() in china_countries
            for addr in entity.get("addresses", [])
        )

        # Check nationalities
        if not is_china:
            is_china = any(
                nat.upper() in china_countries
                for nat in entity.get("nationalities", [])
            )

        # Check remarks for China mentions
        if not is_china:
            remarks = entity.get("remarks", "").upper()
            is_china = any(c in remarks for c in china_countries)

        if is_china:
            china_entities.append(entity)

    return china_entities


def save_results(entities: list[dict], relationships: list[dict]):
    """Save parsed results to JSON files."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Save entities
    entities_path = OUTPUT_DIR / "ofac_sdn.json"
    entities_data = {
        "fetched_at": datetime.utcnow().isoformat(),
        "total_count": len(entities),
        "source": "OFAC SDN List",
        "source_url": SDN_XML_URL,
        "entries": entities
    }

    with open(entities_path, "w", encoding="utf-8") as f:
        json.dump(entities_data, f, indent=2, ensure_ascii=False)

    logger.info(f"Saved {len(entities)} entities to {entities_path}")

    # Save extracted relationships
    rels_path = OUTPUT_DIR / "sdn_relationships.json"
    rels_data = {
        "fetched_at": datetime.utcnow().isoformat(),
        "total_count": len(relationships),
        "relationships": relationships
    }

    with open(rels_path, "w", encoding="utf-8") as f:
        json.dump(rels_data, f, indent=2, ensure_ascii=False)

    logger.info(f"Saved {len(relationships)} relationships to {rels_path}")

    return entities_path, rels_path


def main():
    """Main entry point."""
    logger.info("Starting OFAC SDN fetch...")

    # Fetch XML
    xml_content = fetch_sdn_xml()

    # Parse all entities
    all_entities = parse_sdn_xml(xml_content)
    logger.info(f"Parsed {len(all_entities)} total SDN entries")

    # Filter for China-related
    china_entities = filter_china_entities(all_entities)
    logger.info(f"Found {len(china_entities)} China-related entities")

    # Extract relationships from remarks
    all_relationships = []
    for entity in china_entities:
        rels = extract_ownership_from_remarks(entity.get("remarks", ""))
        for rel in rels:
            rel["source_entity_uid"] = entity["uid"]
            rel["source_entity_name"] = entity["name"]
        all_relationships.extend(rels)

    logger.info(f"Extracted {len(all_relationships)} relationships from remarks")

    # Save results
    save_results(china_entities, all_relationships)

    # Print summary
    type_counts = {}
    for entity in china_entities:
        t = entity.get("type", "Unknown")
        type_counts[t] = type_counts.get(t, 0) + 1

    logger.info("China entities by type:")
    for t, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        logger.info(f"  {t}: {count}")


if __name__ == "__main__":
    main()
