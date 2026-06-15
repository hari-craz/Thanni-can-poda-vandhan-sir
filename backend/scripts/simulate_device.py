#!/usr/bin/env python3
"""
Hydronix Device Simulator
Simulates an ESP32 water quality sensor streaming telemetry to the FastAPI backend.
Handles authentication setup, device provisioning/key rotation, and data streaming.
"""
import time
import random
import json
import argparse
from datetime import datetime
import urllib.request
import urllib.parse
from urllib.error import HTTPError, URLError

def parse_args():
    parser = argparse.ArgumentParser(description="Hydronix Device Telemetry Simulator")
    parser.add_argument("--url", default="http://localhost:8000", help="FastAPI Backend Base URL")
    parser.add_argument("--device", default="HYDRO_001", help="Device ID to simulate")
    parser.add_argument("--interval", type=int, default=5, help="Transmission interval in seconds")
    parser.add_argument("--admin-user", default="admin", help="Admin username for provisioning")
    parser.add_argument("--admin-pass", default="admin", help="Admin password for provisioning")
    return parser.parse_args()

def make_request(url, method="GET", headers=None, data=None):
    """Utility to perform HTTP requests using standard library urllib."""
    headers = headers or {}
    req = urllib.request.Request(url, method=method)
    for k, v in headers.items():
        req.add_header(k, v)
        
    req_data = None
    if data:
        if headers.get("Content-Type") == "application/x-www-form-urlencoded":
            req_data = urllib.parse.urlencode(data).encode("utf-8")
        else:
            req_data = json.dumps(data).encode("utf-8")
            if "Content-Type" not in headers:
                req.add_header("Content-Type", "application/json")
                
    try:
        with urllib.request.urlopen(req, data=req_data, timeout=10) as response:
            status = response.status
            res_body = response.read().decode("utf-8")
            return status, json.loads(res_body) if res_body else None
    except HTTPError as e:
        err_body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_body)
        except Exception:
            return e.code, {"detail": err_body}
    except URLError as e:
        return 0, {"detail": f"Network Connection Error: {e.reason}"}
    except Exception as e:
        return 0, {"detail": str(e)}

def get_admin_token(base_url, username, password):
    """Logs in to retrieve an admin JWT token for provisioning."""
    login_url = f"{base_url}/auth/login"
    payload = {
        "username": username,
        "password": password
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    print(f"[*] Authenticating with backend as '{username}'...")
    status, res = make_request(login_url, method="POST", headers=headers, data=payload)
    if status == 200:
        print("[+] Admin authentication successful.")
        return res["access_token"]
    else:
        print(f"[-] Auth failed (Status {status}): {res.get('detail')}")
        return None

def setup_device_key(base_url, device_id, token):
    """
    Checks if device exists, provisions it if not, or rotates the key if it exists.
    Returns the valid API key.
    """
    headers = {"Authorization": f"Bearer {token}"}
    
    # 1. Check if device exists
    check_url = f"{base_url}/devices/{device_id}"
    status, res = make_request(check_url, method="GET", headers=headers)
    
    if status == 200:
        print(f"[*] Device {device_id} already exists. Rotating API Key to obtain a new one...")
        rotate_url = f"{base_url}/devices/{device_id}/keys/rotate"
        r_status, r_res = make_request(rotate_url, method="POST", headers=headers)
        if r_status == 200:
            print(f"[+] Key rotated successfully.")
            return r_res["new_key"]
        else:
            print(f"[-] Key rotation failed (Status {r_status}): {r_res.get('detail')}")
            return None
    elif status == 404:
        print(f"[*] Device {device_id} not found. Provisioning new device...")
        prov_url = f"{base_url}/devices/provision"
        payload = {
            "device_id": device_id,
            "name": f"Simulated {device_id} Sensor",
            "location": "Main Storage Tank Alpha"
        }
        p_status, p_res = make_request(prov_url, method="POST", headers=headers, data=payload)
        if p_status == 200:
            print(f"[+] Provisioned device {device_id} successfully.")
            return p_res["api_key"]
        else:
            print(f"[-] Provisioning failed (Status {p_status}): {p_res.get('detail')}")
            return None
    else:
        print(f"[-] Failed to fetch device status (Status {status}): {res.get('detail')}")
        return None

def main():
    args = parse_args()
    print("=" * 60)
    print("                HYDRONIX DEVICE SIMULATOR")
    print("=" * 60)
    print(f"Backend URL: {args.url}")
    print(f"Device ID  : {args.device}")
    print(f"Interval   : {args.interval}s")
    print("-" * 60)
    
    # Get Auth Token
    token = get_admin_token(args.url, args.admin_user, args.admin_pass)
    if not token:
        print("[-] Exiting due to authentication failure.")
        return
        
    # Get or Rotate API Key
    api_key = setup_device_key(args.url, args.device, token)
    if not api_key:
        print("[-] Exiting due to provisioning failure.")
        return
        
    print(f"[+] Telemetry loop started. API Key: {api_key[:15]}...")
    
    seq_no = 0
    device_reset_count = 0
    
    # Normal readings base parameters
    ph_base = 7.35
    turb_base = 1.8
    tds_base = 190.0
    temp_base = 22.4
    flow_base = 12.0
    
    last_values = {}
    
    step = 0
    while True:
        try:
            # Fluctuate readings slightly with random walk
            ph = round(ph_base + random.uniform(-0.15, 0.15), 2)
            turbidity = round(max(0.1, turb_base + random.uniform(-0.3, 0.3)), 2)
            tds = round(max(10.0, tds_base + random.uniform(-10.0, 10.0)), 1)
            temperature = round(temp_base + random.uniform(-0.4, 0.4), 1)
            flow_rate = round(max(0.0, flow_base + random.uniform(-1.0, 1.0)), 2)
            
            # Inject anomaly every 15 steps for visual dashboard testing
            step += 1
            is_anomaly = False
            anomaly_description = ""
            
            if step > 0 and step % 15 == 0:
                is_anomaly = True
                anomaly_type = random.choice(["ph_high", "turbidity_high", "tds_high", "sensor_stuck", "no_flow"])
                if anomaly_type == "ph_high":
                    ph = 9.85
                    anomaly_description = "pH High (9.85)"
                elif anomaly_type == "turbidity_high":
                    turbidity = 7.4
                    anomaly_description = "Turbidity High (7.4 NTU)"
                elif anomaly_type == "tds_high":
                    tds = 480.0
                    anomaly_description = "TDS High (480 ppm)"
                elif anomaly_type == "sensor_stuck":
                    ph = last_values.get("ph", ph)
                    turbidity = last_values.get("turbidity", turbidity)
                    tds = last_values.get("tds", tds)
                    temperature = last_values.get("temperature", temperature)
                    flow_rate = last_values.get("flow_rate", flow_rate)
                    anomaly_description = "Stuck Sensor Values"
                elif anomaly_type == "no_flow":
                    flow_rate = 0.0
                    anomaly_description = "No Flow Rate (0.0 L/min)"
            
            # Save latest values
            last_values = {
                "ph": ph,
                "turbidity": turbidity,
                "tds": tds,
                "temperature": temperature,
                "flow_rate": flow_rate
            }
            
            # Prepare payload
            timestamp = datetime.utcnow().isoformat() + "Z"
            payload = {
                "device_id": args.device,
                "ph": ph,
                "turbidity": turbidity,
                "tds": tds,
                "temperature": temperature,
                "flow_rate": flow_rate,
                "timestamp": timestamp,
                "seq_no": seq_no,
                "device_reset_count": device_reset_count,
                "raw_ph": ph + 0.05
            }
            
            headers = {
                "X-API-Key": api_key,
                "Content-Type": "application/json"
            }
            
            # Send POST
            ingest_url = f"{args.url}/data"
            status, res = make_request(ingest_url, method="POST", headers=headers, data=payload)
            
            time_str = datetime.now().strftime('%H:%M:%S')
            if status == 200:
                anomaly_tag = f" [ANOMALY: {anomaly_description}]" if is_anomaly else ""
                print(f"[{time_str}] Seq {seq_no} sent: pH={ph:.2f}, Turbidity={turbidity:.2f} NTU, TDS={tds:.1f} ppm, Temp={temperature:.1f}°C, Flow={flow_rate:.2f} L/min{anomaly_tag} -> Accepted: {res.get('accepted')}")
                seq_no += 1
            else:
                print(f"[{time_str}] Ingestion Error (Status {status}): {res.get('detail')}")
                # If key was invalidated, try to re-authenticate and rotate key again
                if status == 401:
                    print("[*] API Key unauthorized. Attempting re-authentication...")
                    token = get_admin_token(args.url, args.admin_user, args.admin_pass)
                    if token:
                        new_key = setup_device_key(args.url, args.device, token)
                        if new_key:
                            api_key = new_key
                            print("[+] API Key updated.")
            
        except KeyboardInterrupt:
            print("\n[*] Telemetry simulator stopped by user.")
            break
        except Exception as e:
            print(f"[-] Telemetry Loop Exception: {e}")
            
        time.sleep(args.interval)

if __name__ == "__main__":
    main()
