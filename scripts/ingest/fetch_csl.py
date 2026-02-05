"""
Fetch data from the US Consolidated Screening List (CSL).

The CSL aggregates 13+ export screening lists:
- BIS Entity List
- OFAC SDN (Specially Designated Nationals)
- Military End User (MEU) List
- Denied Persons List
- Unverified List
- NS-CMIC List
- And others

API: https://api.trade.gov/consolidated_screening_list/v1/search
"""

import json
import logging
from pathlib import Path
from datetime import datetime

import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

CSL_API_URL = "https://api.trade.gov/consolidated_screening_list/v1/search"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "data" / "raw"


def fetch_csl_china(countries: list[str] = None, page_size: int = 100) -> list[dict]:
    """
    Fetch China-related entries from the Consolidated Screening List.

    Args:
        countries: List of country codes to filter (default: CN, HK, MO)
        page_size: Number of results per page

    Returns:
        List of CSL entries
    """
    if countries is None:
        countries = ["CN", "HK", "MO"]

    all_results = []
    offset = 0

    with httpx.Client(timeout=30.0) as client:
        while True:
            params = {
                "countries": ",".join(countries),
                "size": page_size,
                "offset": offset
            }

            logger.info(f"Fetching CSL page at offset {offset}...")

            try:
                response = client.get(CSL_API_URL, params=params)
                response.raise_for_status()
                data = response.json()
            except httpx.HTTPError as e:
                logger.error(f"HTTP error fetching CSL: {e}")
                break
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
                break

            results = data.get("results", [])
            if not results:
                break

            all_results.extend(results)
            logger.info(f"Fetched {len(results)} entries (total: {len(all_results)})")

            # Check if we've gotten all results
            total = data.get("total", 0)
            if len(all_results) >= total:
                break

            offset += len(results)

    return all_results


def normalize_csl_entry(entry: dict) -> dict:
    """
    Normalize a CSL entry to our internal format.
    """
    return {
        "id": f"csl-{entry.get('id', '')}",
        "source": "CSL",
        "source_list": entry.get("source", ""),
        "name": entry.get("name", ""),
        "alt_names": entry.get("alt_names", []),
        "type": entry.get("type", ""),
        "addresses": entry.get("addresses", []),
        "ids": entry.get("ids", []),
        "programs": entry.get("programs", []),
        "federal_register_notice": entry.get("federal_register_notice", ""),
        "start_date": entry.get("start_date", ""),
        "end_date": entry.get("end_date", ""),
        "remarks": entry.get("remarks", ""),
        "countries": entry.get("countries", []),
        "source_information_url": entry.get("source_information_url", ""),
        "_raw": entry
    }


def save_results(results: list[dict], filename: str = "csl_china.json"):
    """Save results to JSON file."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / filename

    output_data = {
        "fetched_at": datetime.utcnow().isoformat(),
        "total_count": len(results),
        "source": "US Consolidated Screening List",
        "api_url": CSL_API_URL,
        "entries": results
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    logger.info(f"Saved {len(results)} entries to {output_path}")
    return output_path


def main():
    """Main entry point."""
    logger.info("Starting CSL fetch...")

    # Fetch raw data
    raw_entries = fetch_csl_china()
    logger.info(f"Fetched {len(raw_entries)} raw entries")

    # Normalize entries
    normalized = [normalize_csl_entry(e) for e in raw_entries]

    # Save to file
    output_path = save_results(normalized)

    # Print summary by source list
    source_counts = {}
    for entry in normalized:
        source = entry.get("source_list", "Unknown")
        source_counts[source] = source_counts.get(source, 0) + 1

    logger.info("Entries by source list:")
    for source, count in sorted(source_counts.items(), key=lambda x: -x[1]):
        logger.info(f"  {source}: {count}")

    return output_path


if __name__ == "__main__":
    main()
