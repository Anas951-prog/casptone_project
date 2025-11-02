#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"
#include "DHT.h"

#define WIFI_SSID "STICK-O"
#define WIFI_PASSWORD "pakbol123"
#define API_KEY "AIzaSyA9l7i04To0ft2412h9gXQf2FmzfhIwd0g"
#define DATABASE_URL "https://casptoneproject-3443c-default-rtdb.asia-southeast1.firebasedatabase.app/"

const uint8_t FAN_RELAY_PIN   = 5;  // Fan Relay GPIO
const uint8_t LIGHT_RELAY_PIN = 23; // Light Bulb Relay GPIO
const uint8_t DHT22_PIN       = 4;  // DHT22 Sensor GPIO
const uint8_t MQ137_PIN       = 39; // MQ-137 Ammonia Sensor GPIO (Analog Pin)
const uint8_t DHT_TYPE        = DHT22;

const int TEMP_THRESHOLD_HIGH = 29; // If temp >= this: Fan ON, Light OFF
const int TEMP_THRESHOLD_LOW  = 28; // If temp <= this: Light ON, Fan OFF (if ammonia is low)

const int AMMONIA_THRESHOLD_HIGH = 1500; // If value is >= this, Fan turns ON
const int AMMONIA_THRESHOLD_LOW  = 1450; // If value is <= this, Fan can turn OFF

// Timers
const unsigned long CONTROL_LOOP_INTERVAL  = 2000; // Read sensors & run logic
const unsigned long FIREBASE_SEND_INTERVAL = 5000; // Send data to Firebase

// Firebase Database Paths
const char* PATH_TEMP    = "Sensor/temperature";
const char* PATH_HUMID   = "Sensor/humidity";
const char* PATH_AMMONIA = "Sensor/ammonia_value";
const char* PATH_FAN     = "Sensor/fan_on";
const char* PATH_LIGHT   = "Sensor/light_on";

// Firebase Objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;
bool signupOK = false;

// Sensor Objects
DHT dht(DHT22_PIN, DHT_TYPE);

// Sensor State Variables
float temperature    = 0.0;
float humidity       = 0.0;
int   ammoniaValue   = 0;
bool  dhtReadSuccess = false; // Flag for sensor status

// Device State Variables
bool fanRelayState   = false; // Fan state: false=OFF, true=ON
bool lightRelayState = false; // Light state: false=OFF, true=ON

// Timers
unsigned long controlLoopPrevMillis  = 0;
unsigned long firebaseSendPrevMillis = 0;

// Callback function for Firebase token status
void tokenStatusCallback(TokenInfo info) {
  if (info.status == token_status_error) {
    Serial.printf("Token error: %s\n", info.error.message.c_str());
  }
}

// Initializes Wi-Fi connection
void initWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print("."); delay(300);
  }
  Serial.println();
  Serial.print("Connected with IP: ");
  Serial.println(WiFi.localIP());
  Serial.println();
}

// Initializes Firebase connection and authentication
void initFirebase() {
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase signUp OK");
    signupOK = true;
  } else {
    Serial.printf("%s\n", config.signer.signupError.message.c_str());
  }
  
  config.token_status_callback = tokenStatusCallback;
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void setup() {
  Serial.begin(115200);

  // Initialize Hardware
  dht.begin();
  pinMode(FAN_RELAY_PIN, OUTPUT);
  pinMode(LIGHT_RELAY_PIN, OUTPUT);
  digitalWrite(FAN_RELAY_PIN, HIGH);   // Start with Fan OFF (Active LOW relay)
  digitalWrite(LIGHT_RELAY_PIN, HIGH); // Start with Light OFF (Active LOW relay)
  pinMode(MQ137_PIN, INPUT);

  // Initialize Connections
  initWiFi();
  initFirebase();
  
  Serial.println("ESP32 System Initialized. Mode: FULL AUTO (DHT22 + MQ-137)");
}

void loop() {
  unsigned long currentMillis = millis();

  // Task 1: Run the main control loop (sensors & logic)
  if (currentMillis - controlLoopPrevMillis >= CONTROL_LOOP_INTERVAL) {
    controlLoopPrevMillis = currentMillis;
    readSensors();
    runAutomaticControls();
  }

  // Task 2: Send data to Firebase
  if (currentMillis - firebaseSendPrevMillis >= FIREBASE_SEND_INTERVAL) {
    firebaseSendPrevMillis = currentMillis;
    sendDataToFirebase();
  }
}

// Reads all sensors and updates global state variables.
void readSensors() {
  // Read DHT22
  float newT = dht.readTemperature();
  float newH = dht.readHumidity();

  if (isnan(newT) || isnan(newH)) {
    dhtReadSuccess = false;
    Serial.println("Failed to read from DHT sensor!");
  } else {
    dhtReadSuccess = true;
    temperature = newT;
    humidity = newH;
  }

  // Read MQ-137
  ammoniaValue = analogRead(MQ137_PIN);
}

// Runs the logic for all automatic devices.
void runAutomaticControls() {
  // Fan logic can run regardless, but temp check will fail safely if DHT is down
  updateFanState(); 

  // Light logic is temperature-dependent, so only run if DHT is OK
  if (dhtReadSuccess) {
    updateLightState();
  } else {
    Serial.println("Skipping light control (DHT read failed).");
  }
}

// Updates the Fan relay based on Temp OR Ammonia.
void updateFanState() {
  Serial.print("Fan Auto Mode - Ammonia: ");
  Serial.println(ammoniaValue);

  // Check ON conditions
  bool highAmmonia = (ammoniaValue >= AMMONIA_THRESHOLD_HIGH);
  bool highTemp = (dhtReadSuccess && (temperature >= TEMP_THRESHOLD_HIGH));
  
  if (highAmmonia || highTemp) {
    const char* reason = highAmmonia ? "AUTO: Fan ON (high ammonia)" : "AUTO: Fan ON (high temp)";
    updateRelay(FAN_RELAY_PIN, fanRelayState, true, reason, "");
  }

  // Check OFF conditions
  // Fan only turns OFF if *both* ammonia is low AND temp is low.
  bool lowAmmonia = (ammoniaValue <= AMMONIA_THRESHOLD_LOW);
  bool lowTemp = (dhtReadSuccess && (temperature <= TEMP_THRESHOLD_LOW)); 
  
  if (lowAmmonia && lowTemp) {
     updateRelay(FAN_RELAY_PIN, fanRelayState, false, "", "AUTO: Fan OFF (ammonia/temp low)");
  }
  // Note: If DHT fails, 'lowTemp' is false, so fan stays ON (fail-safe).
}

// Updates the Light relay based on Temperature.
void updateLightState() {
  Serial.print("Light Auto Mode - Temp: ");
  Serial.print(temperature);
  Serial.println(" *C");
  
  if (temperature <= TEMP_THRESHOLD_LOW) {
    updateRelay(LIGHT_RELAY_PIN, lightRelayState, true, "AUTO: Light ON (temp low)", "");
  } else if (temperature >= TEMP_THRESHOLD_HIGH) {
    updateRelay(LIGHT_RELAY_PIN, lightRelayState, false, "", "AUTO: Light OFF (temp high)");
  }
}

// Helper Functions
// Controls a relay (Active LOW) only if the state changes.
void updateRelay(uint8_t pin, bool &currentState, bool newState, const char* onMessage, const char* offMessage) {
  if (newState != currentState) { // Only act if state changes
    currentState = newState;
    if (newState == true) { // Turn ON
      digitalWrite(pin, LOW); // Active LOW
      Serial.println(onMessage);
    } else { // Turn OFF
      digitalWrite(pin, HIGH);
      Serial.println(offMessage);
    }
  }
}

// Sends all sensor data to Firebase.
void sendDataToFirebase() {
  if (!Firebase.ready() || !signupOK) {
    Serial.println("Firebase not ready, skipping send.");
    return;
  }
  
  Serial.println("---------------------------------");
  Serial.println("Sending data to Firebase...");
  
  // Use helper functions to send data and log success/failure
  sendFirebaseData(PATH_TEMP, temperature);
  sendFirebaseData(PATH_HUMID, humidity);
  sendFirebaseData(PATH_AMMONIA, ammoniaValue);
  sendFirebaseData(PATH_FAN, fanRelayState);
  sendFirebaseData(PATH_LIGHT, lightRelayState);
  
  Serial.println("---------------------------------");
}

// Helper function to send a float to Firebase and log the result.
void sendFirebaseData(const char* path, float value) {
  if (Firebase.RTDB.setFloat(&fbdo, path, value)) {
    Serial.print("  > OK: "); Serial.print(path); Serial.print(" = "); Serial.println(value);
  } else {
    Serial.print("  > FAILED: "); Serial.println(path);
  }
}

// Helper function to send an int to Firebase and log the result.
void sendFirebaseData(const char* path, int value) {
  if (Firebase.RTDB.setInt(&fbdo, path, value)) {
    Serial.print("  > OK: "); Serial.print(path); Serial.print(" = "); Serial.println(value);
  } else {
    Serial.print("  > FAILED: "); Serial.println(path);
  }
}

// Helper function to send a bool to Firebase and log the result.
void sendFirebaseData(const char* path, bool value) {
  if (Firebase.RTDB.setBool(&fbdo, path, value)) {
    Serial.print("  > OK: "); Serial.print(path); Serial.print(" = "); Serial.println(value ? "true" : "false");
  } else {
    Serial.print("  > FAILED: "); Serial.println(path);
  }
}