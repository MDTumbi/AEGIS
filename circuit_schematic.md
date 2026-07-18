# VoltStream & HydroFlow: Arduino Uno Prototype Circuit Schematic

This document contains the wiring schematic and connection pinouts for the physical prototype. It is formatted for inclusion in your report, portfolio, or presentation.

---

## 📷 Circuit Schematic Diagram

![Arduino Circuit Schematic Diagram](./arduino_schematic.jpg)

---

## 🔌 Connection Map & Pinout Table

All components operate on safe **5V DC power** provided directly by the Arduino Uno's USB connection.

| Component | Component Pin | Arduino Uno Pin | Wire Color (Rec.) | Description / Function |
| :--- | :--- | :--- | :--- | :--- |
| **Potentiometer 1** (Power) | Left Pin<br>Middle Pin (Wiper)<br>Right Pin | **GND**<br>**A0**<br>**5V** | Black<br>Yellow<br>Red | Simulates electrical active power draw (0 – 12.0 kW) |
| **Potentiometer 2** (Water) | Left Pin<br>Middle Pin (Wiper)<br>Right Pin | **GND**<br>**A1**<br>**5V** | Black<br>Blue<br>Red | Simulates hydraulic water flow rate (0 – 30.0 L/min) |
| **Potentiometer 3** (Voltage)| Left Pin<br>Middle Pin (Wiper)<br>Right Pin | **GND**<br>**A2**<br>**5V** | Black<br>Green<br>Red | Simulates utility grid line voltage (160 – 280 V) |
| **DHT11 Sensor** (Weather) | VCC<br>DATA / OUT<br>GND | **5V**<br>**Digital 2**<br>**GND** | Red<br>Orange<br>Black | Measures ambient room temperature and relative humidity |
| **Piezo Buzzer** (Alarm) | Positive Pin (+)<br>Negative Pin (-) | **Digital 8**<br>**GND** | Purple<br>Black | Emits diagnostic alarm beeps ('C' = Critical, 'W' = Warning) |

---

## 📐 System Logic Flowchart

```mermaid
graph TD
    subgraph Physical Hardware Node
        P1[Potentiometer 1: Power] -->|Analog 0-5V| Arduino[Arduino Uno MCU]
        P2[Potentiometer 2: Water] -->|Analog 0-5V| Arduino
        P3[Potentiometer 3: Voltage] -->|Analog 0-5V| Arduino
        DHT[DHT11 Sensor: Temp/Hum] -->|Digital Pin 2| Arduino
        Buzzer[Piezo Buzzer Alarm] <---|Digital Pin 8| Arduino
    end

    subgraph USB Pipeline
        Arduino -->|CSV Telemetry| PC[Python Serial Bridge]
        PC -->|Buzzer Commands: C, W, N| Arduino
    end

    subgraph Analytics Core
        PC -->|HTTP POST JSON| FastAPI[FastAPI Server]
        FastAPI -->|WebSocket Stream| Dashboard[HTML/CSS/JS UI]
        FastAPI -->|Outlier Classification| ML[Isolation Forest ML Engine]
        ML -->|Severity Response| FastAPI
    end
```
