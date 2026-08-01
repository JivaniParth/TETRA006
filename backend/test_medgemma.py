#!/usr/bin/env python3
"""
Standalone Test Script for MedGemma Model Endpoint
--------------------------------------------------
Tests direct MedGemma inference via the vLLM / OpenAI-compatible
chat completions endpoint exactly as used by the backend system.

Replace MEDGEMMA_BASE_URL below with your Cloudflare Tunnel URL or local server URL.
Example:
    MEDGEMMA_BASE_URL = "https://your-cloudflare-tunnel-url.trycloudflare.com"
"""

import json
import time
import urllib.request
import urllib.error

# ==============================================================================
# CONFIGURATION - Direct URLs & Model Parameters
# ==============================================================================
# Replace with your Cloudflare tunnel URL or local endpoint (e.g. "https://xxxx.trycloudflare.com")
MEDGEMMA_BASE_URL = "https://europe-miscellaneous-webmaster-updating.trycloudflare.com"

# Endpoint path matches system implementation (medgemma_worker.py & report_ingestion.py)
COMPLETIONS_ENDPOINT = f"{MEDGEMMA_BASE_URL.rstrip('/')}/v1/chat/completions"
MODEL_NAME = "medgemma-4b"

# Sample prompt matching system clinical decision support query format
TEST_PROMPT = (
    "Patient is a 45-year-old male with a fasting blood glucose of 145 mg/dL "
    "and blood pressure of 138/88 mmHg. Provide a brief clinical assessment "
    "and risk evaluation for Type 2 Diabetes and Hypertension."
)

# ==============================================================================
# MEDGEMMA DIRECT INFERENCE TEST (NO FALLBACKS)
# ==============================================================================
def test_medgemma_direct():
    print("=" * 75)
    print("           MEDGEMMA DIRECT ENDPOINT & MODEL INFERENCE TEST")
    print("=" * 75)
    print(f"[+] Target Base URL : {MEDGEMMA_BASE_URL}")
    print(f"[+] Endpoint URL    : {COMPLETIONS_ENDPOINT}")
    print(f"[+] Model Name      : {MODEL_NAME}")
    print("-" * 75)

    # Payload structured exactly as in backend system (medgemma_worker.py)
    payload = {
        "model": MODEL_NAME,
        "messages": [
            {
                "role": "user",
                "content": TEST_PROMPT
            }
        ],
        "max_tokens": 1024,
        "temperature": 0.2
    }

    headers = {
        "Content-Type": "application/json"
    }

    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        COMPLETIONS_ENDPOINT,
        data=data_bytes,
        headers=headers,
        method="POST"
    )

    print("\n[1] Request Payload Sent:")
    print(json.dumps(payload, indent=2))
    print("-" * 75)

    start_time = time.time()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            elapsed = time.time() - start_time
            status_code = resp.getcode()
            raw_body = resp.read().decode("utf-8")

            print(f"\n[2] Response Received ({elapsed:.2f} seconds | HTTP {status_code}):")
            print("-" * 75)

            parsed_json = json.loads(raw_body)
            print("Full Raw Response JSON:")
            print(json.dumps(parsed_json, indent=2))
            print("-" * 75)

            # Extract generated response text using the exact backend accessor
            # response.json()["choices"][0]["message"]["content"]
            if "choices" in parsed_json and len(parsed_json["choices"]) > 0:
                generated_text = parsed_json["choices"][0]["message"]["content"]
                print("\n[3] Extracted Clinical Output:")
                print("=" * 75)
                print(generated_text.strip())
                print("=" * 75)
                print(f"\n[SUCCESS] MedGemma model response successfully parsed in {elapsed:.2f}s!")
            else:
                print("\n[!] Unexpected Response Structure: 'choices' field missing or empty.")

    except urllib.error.HTTPError as e:
        elapsed = time.time() - start_time
        print(f"\n[X] HTTP Error {e.code}: {e.reason}")
        error_body = e.read().decode("utf-8", errors="ignore")
        print(f"Server Error Details: {error_body}")
    except urllib.error.URLError as e:
        elapsed = time.time() - start_time
        print(f"\n[X] Connection Error ({elapsed:.2f}s): {e.reason}")
        print(f"[i] Could not reach endpoint: {COMPLETIONS_ENDPOINT}")
        print("    If using Cloudflare Tunnel, ensure your tunnel URL is active and updated in MEDGEMMA_BASE_URL.")
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"\n[X] Error: {e}")

if __name__ == "__main__":
    test_medgemma_direct()
