import serial
import requests
import time

# Configure COM port (Change 'COM3' to match your Arduino's serial port on Windows, e.g. COM3, COM4, etc.)
SERIAL_PORT = 'COM5' 
BAUD_RATE = 9600
API_URL = 'http://127.0.0.1:8000/api/telemetry'

def get_serial_connection():
    while True:
        print(f"Connecting to Arduino on {SERIAL_PORT}...")
        try:
            ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1.5)
            time.sleep(2) # Wait for Arduino to reboot
            print("Connection established! Listening for telemetry...")
            return ser
        except Exception as e:
            print(f"Error opening serial port: {e}")
            print("Retrying connection in 3 seconds...")
            time.sleep(3)

# Initial connection
ser = get_serial_connection()

while True:
    try:
        if not ser.is_open:
            raise serial.SerialException("Serial port is closed")
            
        if ser.in_waiting > 0:
            # Read first line
            line = ser.readline().decode('utf-8').strip()
            # Flush older queued lines in the serial buffer to get the absolute latest telemetry frame
            while ser.in_waiting > 0:
                latest_line = ser.readline().decode('utf-8').strip()
                if latest_line:
                    line = latest_line
                    
            # Expecting 5 values: POWER,WATER,VOLTAGE,TEMPERATURE,HUMIDITY
            parts = line.split(',')
            if len(parts) == 5:
                payload = {
                    "power": float(parts[0]),
                    "water": float(parts[1]),
                    "voltage": float(parts[2]),
                    "temperature": float(parts[3]),
                    "humidity": float(parts[4])
                }
                # Send HTTP POST to FastAPI
                response = requests.post(API_URL, json=payload)
                
                if response.status_code == 200:
                    res_data = response.json()
                    severity = res_data.get("severity", "info")
                    
                    # Write feedback code to Arduino to ring/stop the physical Buzzer
                    if severity == "critical":
                        ser.write(b'C')
                    elif severity == "warning":
                        ser.write(b'W')
                    else:
                        ser.write(b'N')
                        
                    print(f"Arduino Telemetry -> Power: {payload['power']}kW, Water: {payload['water']}L/m, Volt: {payload['voltage']}V | AI Severity: {severity}")
                else:
                    print(f"Server Error: {response.status_code}")
    except (serial.SerialException, OSError, PermissionError) as e:
        print(f"Serial connection lost or error: {e}")
        try:
            ser.close()
        except:
            pass
        print("Re-establishing connection...")
        ser = get_serial_connection()
    except Exception as e:
        print(f"Serial Bridge Loop Error: {e}")
        time.sleep(1)
    time.sleep(0.01)
