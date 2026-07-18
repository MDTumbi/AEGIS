# VoltStream & HydroFlow: Smart Utility Grid Monitor

An interactive, hardware-in-the-loop Cyber-Physical System (CPS) simulating and monitoring real-time smart household energy and water consumption. The system leverages an **unsupervised Machine Learning model (Isolation Forest)** at the edge to detect anomalous telemetry, combined with a **rules-based diagnostic engine** to diagnose specific grid and hydraulic faults in real-time.

Telemetry is streamed directly from a physical **Arduino Uno prototype** over a USB serial connection, processed through a FastAPI backend, and displayed on a futuristic glassmorphism web dashboard.

---

## 🔌 Hardware vs. Static Mode

> [!IMPORTANT]
> **Active Streaming vs. Static View**
> * **Hardware-Connected Mode**: When the physical Arduino Uno circuit is plugged in and `backend/serial_bridge.py` is running, the dashboard is **fully dynamic**. The gauges update every 2 seconds, and the live Chart.js graphs scroll in real time.
> * **Static / Frozen Mode**: If the Arduino Uno is not connected to the computer, no new telemetry will stream. The dashboard will load in a **static state**, displaying historical logs from the local SQLite database, but the graphs and gauges will remain frozen until the serial bridge is active.

---

## 🚀 Key Features

1. **Hardware-in-the-Loop Simulation**: Uses physical potentiometers connected to an Arduino Uno's analog inputs to simulate active power draw, water flow rate, and line voltage. The physical circuit wiring schematic is available at [circuit_schematic.md](./circuit_schematic.md) with a visual layout at [arduino_schematic.jpg](./arduino_schematic.jpg). 
2. **Edge AI Anomaly Detection**: Trains an unsupervised `IsolationForest` model on standard daily usage profiles (morning/evening load peaks, climate-control variations). Classifies anomalies in real-time without requiring pre-labeled training datasets.
3. **Diagnostic Reasoning**: Interprets multi-dimensional anomalies to identify the root cause (e.g., *Appliance Short Circuit*, *Grid Voltage Surge*, *Off-Hours Water Leak*, *Pipe Burst*).
4. **Physical Haptic Feedback**: Transmits severity classifications back to the Arduino. A physical piezo buzzer alerts the user with warning beeps (`'W'`) or critical alarms (`'C'`).
5. **Futuristic Glassmorphism UI**: High-fidelity dark mode dashboard with live-scrolling multi-axis charts, system health integrity gauges, and real-time event logs.
6. **SQLite Time-Series Database**: Automatically logs all historical telemetry, classification results, and root-cause diagnoses locally.

---

## 📁 Project Structure

```text
smart-grid-monitor/
├── backend/
│   ├── anomaly_detector.py    # Unsupervised Isolation Forest & diagnostic rules
│   ├── main.py                # FastAPI app, SQLite connection, WebSocket server
│   ├── serial_bridge.py       # Auto-reconnecting serial-to-HTTP USB data bridge
│   └── telemetry.db           # SQLite database (created on startup)
├── frontend/
│   ├── index.html             # Glassmorphic layout structure
│   ├── style.css              # Neon dark-theme styling & responsive layout
│   └── app.js                 # WebSocket client & real-time charting controller
├── arduino_schematic.jpg      # Visual breadboard circuit wiring diagram
├── circuit_schematic.md       # Complete component pinout mapping & connections table
├── hardware_integration_plan.md # C++ sketch code & calibration specifications
└── README.md                  # Project documentation & execution details
```

---

## 🛠️ Installation & Setup

### 1. Set Up the Environment
Open a terminal in the project root directory (`smart-grid-monitor/`) and run the following command to create the virtual environment and install dependencies:
```bash
# Verify Python & uv installation
uv --version

# Create virtual environment
uv venv

# Install packages
uv pip install fastapi uvicorn pandas scikit-learn websockets pyserial requests
```

### 2. Start the FastAPI Server
Navigate into the `backend` folder and run the uvicorn development server:
```bash
cd backend
..\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### 3. Open the UI
Open your web browser and go to:
👉 **[http://127.0.0.1:8000/](http://127.0.0.1:8000/)**

### 4. Connect the Hardware (Active Streaming)
Connect your Arduino Uno circuit to the computer via USB, verify it is mapped to `COM5` (or adjust in `serial_bridge.py`), and launch the bridge:
```bash
cd backend
..\.venv\Scripts\python.exe serial_bridge.py
```

---

## 🔬 How to Test (The Physical Fault Lab)

Once the serial bridge is active, you can twist the physical knobs on your breadboard to simulate real-world grid faults:

1. **Simulate a Pipe Leak**: Twist the **Water Potentiometer** to exceed `7.0 L/min`:
   * **Dashboard**: The Water card will immediately change from `Normal` to **`Unusual Flow`** in orange with a glowing amber shadow.
   * **Diagnostics**: The log table and diagnostics alert will show: `Unusual Water Flow - Unexpected water flow rate detected outside normal high-usage hours`.
   * **Buzzer**: The physical buzzer will start emitting warning beeps.
2. **Simulate an Appliance Short-Circuit**: Twist the **Power Potentiometer** to exceed `10.0 kW`:
   * **Dashboard**: The Electricity card status badge shifts to **`Overload`** in red.
   * **Diagnostics**: The alert shifts to a critical red box: `Power Surge / Short Circuit - Active power consumption spiked, exceeding standard capacity limit`.
   * **Buzzer**: The buzzer will sound a fast, continuous alarm.
3. **Simulate Grid Instability**: Twist the **Voltage Potentiometer** below `195V` or above `250V`:
   * **Dashboard**: The Voltage card transitions to **`Undervoltage`** or **`Overvoltage`** with red glowing borders.

---

## 💡 System Limitations & Future Scope

This project functions as a prototype/proof-of-concept for cyber-physical utility grids. Here are key engineering areas flagged for production upgrades:

*   **Diagnostic Rules**: The current diagnostic reasoning engine uses basic-level static rules and heuristics (such as boundary thresholds for voltage, power, and flow). In a production environment, this should be upgraded to a fuzzy-logic decision matrix or a supervised multi-label classifier (like Random Forest or XGBoost) trained on actual grid fault logs.
*   **Machine Learning Model**: The Isolation Forest anomaly detector is trained on a synthetic, baseline pattern of standard household usage profiles. The model's accuracy, false-positive rates, and robustness can be significantly improved by:
    *   Training it on months of diverse, real-world smart meter data (capturing seasonal load changes, holidays, and varied appliance signatures).
    *   Employing autoencoders or LSTM recurrent neural networks to better model sequential time-series patterns.
    *   Conducting hyperparameter optimization (e.g., contamination factor tuning) to adapt to different household baseline envelopes.

---

## 📝 Add This to Your Resume!

Since this is a unique Cyber-Physical System (CPS) project, here is how you can write about it on your resume to impress interviewers:

> ### **VoltStream & HydroFlow: Smart Utility Grid Monitor & Anomaly Detector**
> * **Hardware-in-the-Loop Simulation**: Integrated physical sensors and analog potentiometers with an Arduino Uno microcontroller, streaming real-time utility telemetry (Voltage, Active Power, Water Flow) to a local workstation over a custom USB serial bridge.
> * **Unsupervised AI Anomaly Detection**: Built and trained an unsupervised `IsolationForest` model on daily utility profiles to automatically classify multi-dimensional telemetry as normal or anomalous at the edge.
> * **Root-Cause Diagnostics Classifier**: Implemented a rules-based diagnostic overlay engine that categorizes anomalies into specific hardware faults (e.g. pipe leaks, grid brownouts, appliance short-circuits) with detailed actionable descriptions.
> * **Real-Time Visualization & Alerts**: Created a WebSocket-powered dark-mode glassmorphic dashboard with live scrolling multi-axis Chart.js graphs, system health gauges, and physical buzzer alarm feedback based on AI classification.
