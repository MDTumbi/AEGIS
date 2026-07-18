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

  delay(2000); // 2 second measurement delay
}
