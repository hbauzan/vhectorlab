#!/usr/bin/env python3
"""
System Heartbeat and Diagnostic Runner for VHectorLab 3D.
Tests /health and /arithmetic endpoints locally using httpx or direct state.
"""

import logging
import sys

import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("heartbeat")


def run_heartbeat(base_url: str = "http://127.0.0.1:8000") -> bool:
    logger.info(f"Running System Heartbeat against {base_url}...")

    try:
        # 1. Health check
        health_resp = httpx.get(f"{base_url}/health", timeout=5.0)
        if health_resp.status_code != 200:
            logger.error(
                f"Health check failed with status {health_resp.status_code}: {health_resp.text}"
            )
            return False

        health_data = health_resp.json()
        logger.info(f"Health check OK: {health_data}")

        # 2. Arithmetic check (king - man + woman)
        payload = {"word_a": "king", "word_b": "man", "word_c": "woman", "top_k": 5}
        arith_resp = httpx.post(f"{base_url}/arithmetic", json=payload, timeout=15.0)
        if arith_resp.status_code != 200:
            logger.error(
                f"Arithmetic test failed with status {arith_resp.status_code}: {arith_resp.text}"
            )
            return False

        arith_data = arith_resp.json()
        results = arith_data.get("results", [])
        logger.info("Arithmetic test OK! Top results for 'king - man + woman':")
        for res in results:
            logger.info(f"  - {res['word']} (score: {res['score']:.4f})")

        return True
    except Exception as e:  # noqa: BLE001
        logger.error(f"Heartbeat connection error: {e}")
        return False


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
    success = run_heartbeat(url)
    sys.exit(0 if success else 1)
