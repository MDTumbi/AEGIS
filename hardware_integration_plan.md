# VoltStream & HydroFlow: Low-Budget Arduino Uno USB Prototype (100% Safe)

This plan outlines how to build a physical, interactive hardware prototype using an **Arduino Uno**, **3 cheap potentiometers** (rotary knobs), a **DHT11 temperature/humidity sensor**, and an **active piezo buzzer** alarm.

This design operates entirely on **5V USB power** (no dangerous 230V mains wiring) and uses a **Python Serial Bridge** to feed data into our weather-correlated FastAPI machine learning server and trigger the physical buzzer alarm.

---

## 🏗️ Interactive Prototype Architecture

Instead of Wi-Fi shields or high-voltage sensors, the Arduino reads safe low-voltage analog inputs (rotary dials representing Power, Water, and Voltage), measures actual room temperature/humidity, and streams them over the USB cable.

```mermaid
graph TD
    subgraph Physical Controller (Safe 5V DC)
        A1[Knob 1: Electricity Power] -->|Analog Voltage 0-5V| B[Arduino Uno]
        A2[Knob 2: Water Flow Rate] -->|Analog Voltage 0-5V| B
        A3[Knob 3: Grid Voltage] -->|Analog Voltage 0-5V| B
        A4[DHT11 Sensor: Temp & Humidity] -->|Digital Input Pin 2| B
        B -->|5V Digital Out Pin 8| H[Piezo Buzzer Alarm]
    end

    subgraph USB Connection
        B -->|Serial: POWER,WATER,VOLTAGE,TEMP,HUMIDITY| C[USB Cable]
        C -->|Command Feedback: 'C', 'W', 'N'| B
    end

    subgraph Host Computer
        C -->|COM Port| D[Python Serial Bridge Script]
        D -->|HTTP POST JSON| E[FastAPI Server]
        E -->|SQLite Log| F[(sqlite3 Database)]
        E -->|WebSocket Push| G[Glassmorphic Dashboard]
        E -->|Returns Diagnostic Severity| D
    end
```

---

## 🛠️ Bill of Materials (BOM)

If you already have an Arduino Uno, the extra components cost less than **₹150 ($1.80)** in total:

| Component | Description | Est. Cost (INR) | Purpose |
| :--- | :--- | :--- | :--- |
| **Arduino Uno** | Microcontroller development board + USB Cable. | ₹350 (or Free if owned) | Reads sensors, communicates with Python, and controls buzzer. |
| **3x Potentiometers** | 10k Ohm rotary variable resistors. | ₹15 - ₹20 each | Acts as physical control knobs to adjust Power, Water, and Voltage. |
| **DHT11 Sensor** | 3-pin Temperature & Humidity sensor module. | ₹70 - ₹80 | Provides real room temperature and humidity readings. |
| **Active 5V Buzzer** | Active Piezo Buzzer (high/low trigger). | ₹15 | Physical alarm sounder for warnings and critical alerts. |
| **Breadboard & Wires** | Mini breadboard and male-to-male jumper wires. | ₹50 | Easy solderless wiring of all components. |

---

## 🔌 Breadboard Wiring Diagram

Connect the components to the Arduino pins as follows:

### 1. Potentiometers (Control Knobs)
*   **Pin 1 (Left pin)**: Connect all to Arduino **GND**.
*   **Pin 3 (Right pin)**: Connect all to Arduino **5V**.
*   **Pin 2 (Middle - Wiper)**: Connect each to its respective Analog pin:
    *   Knob 1 (Power Dial) $\rightarrow$ **A0**
    *   Knob 2 (Water Dial) $\rightarrow$ **A1**
    *   Knob 3 (Voltage Dial) $\rightarrow$ **A2**

### 2. DHT11 Sensor (Temperature & Humidity)
*   **VCC** (Power pin) $\rightarrow$ Arduino **5V**
*   **GND** (Ground pin) $\rightarrow$ Arduino **GND**
*   **DATA** (Signal pin) $\rightarrow$ Digital Pin **2** (Install the `DHT sensor library` in Arduino IDE).

### 3. Active Piezo Buzzer
*   **Long pin (+)** $\rightarrow$ Digital Pin **8**
*   **Short pin (-)** $\rightarrow$ Arduino **GND**

---

## 💾 1. Arduino Sketch (`prototype_firmware.ino`)

Upload this code using the Arduino IDE. Open **Library Manager** in Arduino IDE and install **"DHT sensor library" by Adafruit** before uploading.

```cpp
#include <DHT.h>

#define DHTPIN 2
#define DHTTYPE DHT11
#define BUZZER_PIN 8

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600); 
  dht.begin();
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW); // Start with buzzer off
}

void loop() {
  // 1. Read Knobs
  int powerRaw = analogRead(A0);
  int waterRaw = analogRead(A1);
  int voltageRaw = analogRead(A2);

  // Map to realistic ranges
  float power = (powerRaw / 1023.0) * 12.0;    // 0 to 12.0 kW
  float water = (waterRaw / 1023.0) * 30.0;    // 0 to 30.0 L/min
  float voltage = 160.0 + ((voltageRaw / 1023.0) * 120.0); // 160V to 280V

  // 2. Read DHT11 Weather Sensor
  float humidity = dht.readHumidity();
  float temp = dht.readTemperature();

  // If reading fails, default to sensible values
  if (isnan(humidity) || isnan(temp)) {
    temp = 24.0;
    humidity = 60.0;
  }

  // 3. Print CSV Payload to Serial: POWER,WATER,VOLTAGE,TEMPERATURE,HUMIDITY
  Serial.print(power, 2);
  Serial.print(",");
  Serial.print(water, 2);
  Serial.print(",");
  Serial.print(voltage, 1);
  Serial.print(",");
  Serial.print(temp, 1);
  Serial.print(",");
  Serial.println(humidity, 1);

  // 4. Check for incoming feedback commands from the Python Bridge
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    if (cmd == 'C') { // Critical alert
      // Rapid double beep
      digitalWrite(BUZZER_PIN, HIGH);
      delay(80);
      digitalWrite(BUZZER_PIN, LOW);
      delay(80);
      digitalWrite(BUZZER_PIN, HIGH);
      delay(80);
      digitalWrite(BUZZER_PIN, LOW);
    } 
    else if (cmd == 'W') { // Warning alert
      // Single slower beep
      digitalWrite(BUZZER_PIN, HIGH);
      delay(200);
      digitalWrite(BUZZER_PIN, LOW);
    } 
    else if (cmd == 'N') { // Normal state
      digitalWrite(BUZZER_PIN, LOW);
    }
  }

  delay(1000); // Telemetry updates every 1 second
}
```

---

## 🐍 2. Python Serial Bridge (`serial_bridge.py`)

Save this script as **`backend/serial_bridge.py`**. Run it using your virtual environment to route data from the USB port to the API.

```python
import serial
import requests
import time

# Configure COM port (Change to match your Arduino, e.g., 'COM3' or '/dev/ttyUSB0')
SERIAL_PORT = 'COM3' 
BAUD_RATE = 9600
API_URL = 'http://127.0.0.1:8000/api/telemetry'

print(f"Connecting to Arduino on {SERIAL_PORT}...")
try:
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1.5)
    time.sleep(2)  # Wait for Arduino boot-reset
    print("Connection established! Listening for telemetry...")
except Exception as e:
    print(f"Error opening serial port: {e}")
    print("Make sure your Arduino is plugged in and check the COM port number.")
    exit(1)

while True:
    try:
        if ser.in_waiting > 0:
            line = ser.readline().decode('utf-8').strip()
            parts = line.split(',')
            if len(parts) == 5:
                payload = {
                    "power": float(parts[0]),
                    "water": float(parts[1]),
                    "voltage": float(parts[2]),
                    "temperature": float(parts[3]),
                    "humidity": float(parts[4])
                }
                # POST payload to backend API
                response = requests.post(API_URL, json=payload)
                
                if response.status_code == 200:
                    res_data = response.json()
                    severity = res_data.get("severity", "info")
                    
                    # Write feedback byte back to the Arduino Uno to control the Buzzer
                    if severity == "critical":
                        ser.write(b'C')
                    elif severity == "warning":
                        ser.write(b'W')
                    else:
                        ser.write(b'N')
                        
                    print(f"Telemetry: {payload} -> Severities: {severity}")
                else:
                    print(f"Server error: {response.status_code}")
    except Exception as e:
        print(f"Serial Bridge Loop Error: {e}")
    time.sleep(0.1)
```

---

## 🧪 Interactive Portfolio Demo Guide

To show off your working prototype to judges or interviewers:
1.  Plug in the Arduino Uno and open your dashboard at `http://127.0.0.1:8000/`.
2.  Start the Python bridge: `python backend/serial_bridge.py`. The dashboard will switch automatically to **Physical System Time**.
3.  **Perform Live Weather Reactions**:
    *   Breathe onto the **DHT11 sensor**. The humidity and temperature values will rise immediately on the Glassmorphic Dashboard weather widget!
4.  **Perform Live Diagnostics & Physical Alarms**:
    *   **Normal State**: Set Power low (1 kW), Water low (0.5 L/m), and Voltage in the middle (230V). The dashboard will show green, and the buzzer will be silent.
    *   **Trigger a Leak Warning**: Turn the Water knob up (2.5 L/m). The dashboard flashes orange, and the physical buzzer will issue a single warning beep.
    *   **Trigger a Critical Fault**: Turn the Power knob all the way to 10 kW. The dashboard turns bright red, and the active piezo buzzer will issue a rapid double-beep alarm!
