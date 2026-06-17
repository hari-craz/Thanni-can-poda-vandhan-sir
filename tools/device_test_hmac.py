"""
Simple host-side integration test script to simulate an ESP32 device.

Usage:
  python tools/device_test_hmac.py \
    --url https://api.hydronix.local/v2/data \
    --api-key DEVICE_API_KEY \
    --secret DEVICE_API_SECRET

The script computes HMAC-SHA256 signature using the signing string format:
  METHOD\nPATH\nTIMESTAMP\nNONCE\nBODY_SHA256

It sends headers: X-API-Key, X-Timestamp, X-Nonce, X-Signature

This is intentionally dependency-light (stdlib + requests).
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import secrets
import time
from urllib.parse import urlparse

import requests


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def compute_hmac_hex(secret: str, message: str) -> str:
    key = secret.encode("utf-8")
    msg = message.encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def build_signing_string(method: str, path: str, timestamp: str, nonce: str, body: bytes) -> str:
    body_hash = sha256_hex(body) if body else sha256_hex(b"")
    components = [method.upper(), path, timestamp, nonce, body_hash]
    return "\n".join(components)


def send_signed_request(url: str, api_key: str, api_secret: str, payload: dict):
    parsed = urlparse(url)
    path = parsed.path or "/"
    if parsed.query:
        path += "?" + parsed.query

    body = json.dumps(payload, separators=(',', ':'), sort_keys=True).encode("utf-8")
    timestamp = str(int(time.time()))
    nonce = secrets.token_hex(12)
    signing_string = build_signing_string("POST", path, timestamp, nonce, body)
    signature = compute_hmac_hex(api_secret, signing_string)

    headers = {
        "Content-Type": "application/json",
        "X-API-Key": api_key,
        "X-Timestamp": timestamp,
        "X-Nonce": nonce,
        "X-Signature": signature,
    }

    print("Sending signed request to:", url)
    print("Signing string:")
    print(signing_string)
    print("Signature:", signature)

    resp = requests.post(url, headers=headers, data=body, timeout=10)
    try:
        print("Status:", resp.status_code)
        print("Response:", resp.text)
    finally:
        resp.close()


def main():
    parser = argparse.ArgumentParser(description="Device HMAC test client")
    parser.add_argument("--url", required=True)
    parser.add_argument("--api-key", required=True)
    parser.add_argument("--secret", required=True)
    parser.add_argument("--device-id", default="HYDRO_001")
    args = parser.parse_args()

    payload = {
        "device_id": args.device_id,
        "ph": 7.2,
        "turbidity": 3.1,
        "tds": 120,
        "temperature": 25.0,
        "flow_rate": 10.5,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "seq_no": 1,
    }

    send_signed_request(args.url, args.api_key, args.secret, payload)


if __name__ == "__main__":
    main()
