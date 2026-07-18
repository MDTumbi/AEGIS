import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

class UtilityAnomalyDetector:
    def __init__(self):
        # We now train on 7 features: hour, day, electricity_power, water_flow, voltage, temperature, humidity
        self.model = IsolationForest(n_estimators=120, contamination=0.04, random_state=42)
        self.is_trained = False
        self.train_baseline()

    def train_baseline(self):
        """
        Generate synthetic 'normal' baseline data representing a typical home's correlation
        between time, temperature, humidity, water, and power usage (including AC and lights).
        """
        np.random.seed(42)
        n_samples = 3000
        
        hours = np.random.randint(0, 24, n_samples)
        days = np.random.randint(0, 7, n_samples)
        
        electricity = []
        water = []
        voltage = []
        temperatures = []
        humidities = []
        
        for hour in hours:
            # 1. Generate realistic weather values based on hour of the day
            # Temperature: hot in afternoon (1-4 PM), cool at night (3-5 AM)
            if 12 <= hour <= 17:
                temp = np.random.uniform(28.0, 38.0) # Hot afternoon
            elif 23 <= hour or hour <= 6:
                temp = np.random.uniform(18.0, 24.0) # Cool night
            else:
                temp = np.random.uniform(22.0, 30.0) # Mild morning/evening
                
            # Humidity: higher in morning/night, lower in afternoon heat
            if 12 <= hour <= 17:
                hum = np.random.uniform(35.0, 55.0)
            else:
                hum = np.random.uniform(55.0, 85.0)
                
            # 2. Electricity Baseline calculation (built from sub-loads)
            # A. Base Load (always-on devices like fridge, routers)
            if hour >= 23 or hour < 6:
                power = np.random.uniform(0.15, 0.35)
            else:
                power = np.random.uniform(0.35, 0.75)
                
            # B. Lighting Load (depends on sunset and wake hours)
            # Sunset is approx 6 PM (18:00) to sleep time 11 PM (23:00)
            # Wake time is 5 AM (05:00) to sunrise 6:30 AM (06:30)
            if (18 <= hour < 23) or (5 <= hour < 7):
                power += np.random.uniform(0.2, 0.5) # lights are ON
                
            # C. Appliance Load (morning peak 7 AM - 11 AM, and evening peak 5 PM - 11 PM)
            if (7 <= hour < 11) or (17 <= hour < 23):
                power += np.random.uniform(1.5, 3.5)
                
            # D. Climate Control (AC Load)
            # If temperature is hot (>29°C) OR humidity is high/sticky (>70%), AC turns on
            if temp > 29.0 or hum > 70.0:
                power += np.random.uniform(1.2, 2.2) # AC active load
                
            # Add random noise
            power += np.random.normal(0, 0.1)
            power = max(0.1, power)
            
            # 3. Water Baseline (high in morning/evening, low at night)
            if 7 <= hour <= 9 or 19 <= hour <= 21:
                w_base = np.random.uniform(1.0, 6.0) # Keep standard baseline below the 7.0 L/min warning threshold
                
            elif hour >= 23 or hour <= 5:
                w_base = np.random.uniform(0.0, 0.1)
            else:
                w_base = np.random.uniform(0.0, 2.5)
                
            # 4. Voltage normal variations (215V - 245V)
            v_base = np.random.normal(230.0, 3.5)
            
            electricity.append(power)
            water.append(w_base)
            voltage.append(v_base)
            temperatures.append(temp)
            humidities.append(hum)
            
        df = pd.DataFrame({
            'hour': hours,
            'day': days,
            'electricity_power': electricity,
            'water_flow': water,
            'voltage': voltage,
            'temperature': temperatures,
            'humidity': humidities
        })
        
        # Train model on the 5 core features (excluding temperature and humidity from ML triggers)
        self.model.fit(df[['hour', 'day', 'electricity_power', 'water_flow', 'voltage']])
        self.is_trained = True
        print("Anomaly Detector baseline model trained successfully on core usage patterns.")

    def detect(self, hour: int, day: int, power: float, water: float, volt: float, temp: float, hum: float):
        """
        Predict if a single reading is anomalous and diagnose the root cause.
        """
        if not self.is_trained:
            return False, "Normal", "Model not trained", "info"
            
        # Predict using Isolation Forest on 5 core features
        data = pd.DataFrame([[hour, day, power, water, volt]], 
                            columns=['hour', 'day', 'electricity_power', 'water_flow', 'voltage'])
        
        pred = self.model.predict(data[['hour', 'day', 'electricity_power', 'water_flow', 'voltage']])
        is_anomalous = bool(pred[0] == -1)
        
        cause = "Normal State"
        explanation = "The system is operating within normal parameters."
        severity = "info"
        
        # --- Safety Rule Engine Layer (Hard Overrides) ---
        # 1. Voltage limits
        if volt > 250.0:
            is_anomalous = True
            cause = "Grid Overvoltage / Surge"
            explanation = f"Voltage spike detected ({volt:.1f}V), exceeding safe grid operating limit of 250V. High risk of damaging connected appliances."
            severity = "critical"
        elif volt < 195.0:
            is_anomalous = True
            cause = "Grid Undervoltage / Brownout"
            explanation = f"Voltage drop detected ({volt:.1f}V), dipping below standard 195V limit. Grid instability or heavy line overload."
            severity = "warning"
            
        # 2. Water flow limits
        elif water > 18.0:
            is_anomalous = True
            cause = "High-Flow Water Leak / Pipe Burst"
            explanation = f"Abnormal water flow rate of {water:.1f} L/min detected. Possible pipe rupture, major leak, or open high-flow tap."
            severity = "critical"
        elif water > 7.0:
            is_anomalous = True
            cause = "Unusual High Water Flow"
            explanation = f"Water flow rate exceeded standard warning limit ({water:.1f} L/min > 7.0 L/min). Indicates high usage or potential pipe leak."
            severity = "warning"
            
        # 3. Active power limits
        elif power > 10.0:
            is_anomalous = True
            cause = "Power Surge / Short Circuit"
            explanation = f"Active power consumption spiked to {power:.2f} kW, exceeding standard household capacity limits (10kW). Indicates potential overload or short-circuit."
            severity = "critical"
            
        # --- ML Outlier & Contextual Rules Layer ---
        elif is_anomalous:
            # Fallback diagnostics for anomalies flagged by Isolation Forest
            cause = "Unusual Activity Pattern"
            explanation = "Telemetry deviates significantly from the typical historical baseline."
            severity = "warning"
            
            # Refined ML diagnostics based on specific sensor deviations
            if power < 0.05 and (6 <= hour <= 22):
                cause = "Unusual Low Power Draw"
                explanation = f"Active power consumption is extremely low ({power:.2f} kW) during peak hours. Indicates potential sensor disconnection, breaker trip, or system shutoff."
                severity = "warning"
            elif power > 7.0 and (6 <= hour <= 22):
                cause = "Unusual High Power Draw"
                explanation = f"Active power consumption is extremely high ({power:.2f} kW) for standard household usage. Risk of triggering breaker overload."
                severity = "warning"

            elif water > 3.0 and not ((7 <= hour <= 9) or (19 <= hour <= 21)):
                cause = "Unusual Water Flow"
                explanation = f"Unexpected water flow rate of {water:.1f} L/min detected outside normal high-usage hours. Indicates running tap or slow leak."
                severity = "warning"
            elif (volt < 210.0 or volt > 245.0):
                cause = "Voltage Fluctuation"
                explanation = f"Line voltage is fluctuating at {volt:.1f} V, which is outside the typical stable grid range (210V - 245V)."
                severity = "warning"
            
            # Contextual nighttime rules
            if (hour >= 23 or hour <= 4):
                if water > 5.0:
                    cause = "Sustained Off-Hours Water Flow"
                    explanation = f"Continuous water flow of {water:.1f} L/min detected at {hour:02d}:00 during typical sleeping hours. Suggests a slow pipe leak, toilet leak, or unclosed faucet."
                    severity = "warning"
                elif power > 3.0:
                    is_hot_weather = (temp > 29.0 or hum > 70.0)
                    is_normal_weather = (22.0 <= temp <= 29.0 and 50.0 <= hum <= 70.0)
                    
                    if is_hot_weather or is_normal_weather:
                        is_anomalous = False
                        cause = "Normal State"
                        explanation = f"The system is operating within normal parameters. Higher electricity draw ({power:.2f} kW) is expected under hot/normal weather conditions ({temp:.1f}°C, {hum:.1f}%) for AC or refrigerator load."
                        severity = "info"
                    else:
                        cause = "AC / Heavy Appliance Left On"
                        explanation = f"High electricity draw ({power:.2f} kW) detected at {hour:02d}:00 during sleep hours under cool outdoor conditions ({temp:.1f}°C, {hum:.1f}%). Heavy appliances (like AC or geysers) may have been left running unnecessarily."
                        severity = "warning"
                
        return is_anomalous, cause, explanation, severity
