import asyncio
import json
import sqlite3
import time
from datetime import datetime
import os
from typing import List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from anomaly_detector import UtilityAnomalyDetector

app = FastAPI(title="AEGIS: Anomaly Endpoint & Grid Integrity System API")

# Initialize detector
detector = UtilityAnomalyDetector()

# Database setup
DB_PATH = "telemetry.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT temperature FROM telemetry_history LIMIT 1")
    except sqlite3.OperationalError:
        cursor.execute("DROP TABLE IF EXISTS telemetry_history")
        
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS telemetry_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            hour REAL,
            day INTEGER,
            power REAL,
            water REAL,
            voltage REAL,
            temperature REAL,
            humidity REAL,
            is_anomalous INTEGER,
            cause TEXT,
            explanation TEXT,
            severity TEXT
        )
    """)
    conn.commit()
    conn.close()

init_db()

# WebSocket connections manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        print(f"[WS Manager] Broadcasting to {len(self.active_connections)} client(s)...")
        for connection in list(self.active_connections):
            try:
                await connection.send_text(json.dumps(message))
                print(f"[WS Manager] Broadcast sent to client successfully.")
            except Exception as e:
                print(f"[WS Manager Error] Failed to send message to client: {e}")
                self.disconnect(connection)

manager = ConnectionManager()

@app.get("/api/history")
def get_history(limit: int = 50):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT timestamp, hour, day, power, water, voltage, temperature, humidity, is_anomalous, cause, explanation, severity 
        FROM telemetry_history 
        ORDER BY id DESC 
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    
    # Parse rows into list of dicts (and reverse to get chronological order)
    history = []
    for r in reversed(rows):
        history.append({
            "timestamp": r[0],
            "simulated_hour": round(r[1], 2),
            "simulated_day": r[2],
            "power": r[3],
            "water": r[4],
            "voltage": r[5],
            "temperature": r[6],
            "humidity": r[7],
            "is_anomalous": bool(r[8]),
            "cause": r[9],
            "explanation": r[10],
            "severity": r[11]
        })
    return history

@app.post("/api/reset")
def reset_database():
    # Clear DB history
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM telemetry_history")
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Database history cleared successfully."}

class PhysicalTelemetry(BaseModel):
    power: float
    water: float
    voltage: float
    temperature: float = 24.0
    humidity: float = 60.0

@app.post("/api/telemetry")
async def receive_physical_telemetry(data: PhysicalTelemetry):
    now = datetime.now()
    hour = now.hour + now.minute / 60.0
    day = (now.weekday() + 1) % 7
    
    is_anomalous, cause, explanation, severity = detector.detect(
        int(hour), day, data.power, data.water, data.voltage, data.temperature, data.humidity
    )
    
    timestamp = datetime.now().isoformat()
    
    # Save to database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO telemetry_history 
        (timestamp, hour, day, power, water, voltage, temperature, humidity, is_anomalous, cause, explanation, severity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (timestamp, hour, day, data.power, data.water, data.voltage, data.temperature, data.humidity,
          1 if is_anomalous else 0, cause, explanation, severity))
    conn.commit()
    conn.close()
    
    # Broadcast payload to dashboard
    payload = {
        "timestamp": timestamp,
        "simulated_hour": round(hour, 2),
        "simulated_day": day,
        "power": data.power,
        "water": data.water,
        "voltage": data.voltage,
        "temperature": data.temperature,
        "humidity": data.humidity,
        "is_anomalous": is_anomalous,
        "cause": cause,
        "explanation": explanation,
        "severity": severity,
        "active_anomalies": [],
        "mode": "physical"
    }
    await manager.broadcast(payload)
    
    return {
        "status": "success",
        "is_anomalous": is_anomalous,
        "severity": severity
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep websocket connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Serve Frontend static files
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

@app.get("/")
def get_index():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return HTMLResponse("Frontend files not created yet. Please build the frontend.")

# Mount static folder
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
