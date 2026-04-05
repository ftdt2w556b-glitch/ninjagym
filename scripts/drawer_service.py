#!/usr/bin/env python3
"""NinjaGym Cash Drawer Service - polls Supabase, triggers drawer via RawBT"""
import time
import json
import urllib.request
import websocket

SUPABASE_URL = "https://bwyprymiykkquszkjkje.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3eXByeW1peWtrcXVzemtqa2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjM0NzQsImV4cCI6MjA5MDE5OTQ3NH0._-kSPcDHu2TWO8Uj2cTrk81ySUV6eCfY9VmLnFFyKbc"
RAWBT_WS = "ws://localhost:40213"
POLL_INTERVAL = 2
DRAWER_KICK = bytes([0x1B, 0x70, 0x00, 0x19, 0xFA])

last_id = 0

def fetch(path):
    req = urllib.request.Request(
        SUPABASE_URL + "/rest/v1/" + path,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": "Bearer " + SUPABASE_KEY
        }
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())

def open_drawer():
    try:
        ws = websocket.create_connection(RAWBT_WS, timeout=3)
        ws.send_binary(DRAWER_KICK)
        ws.close()
        print("Drawer opened OK")
    except Exception as e:
        print("Drawer error: " + str(e))

def main():
    global last_id
    print("NinjaGym Drawer Service started")
    try:
        rows = fetch("drawer_log?select=id&order=id.desc&limit=1")
        if rows:
            last_id = rows[0]["id"]
        print("Watching from ID " + str(last_id))
    except Exception as e:
        print("Warning: " + str(e))

    while True:
        try:
            rows = fetch("drawer_log?id=gt." + str(last_id) + "&select=id,reason&order=id.asc&limit=10")
            if rows:
                last_id = rows[-1]["id"]
                print("Opening drawer...")
                open_drawer()
        except Exception as e:
            print("Poll error: " + str(e))
        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
