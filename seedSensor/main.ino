#include "LSM6DS3.h"
#include "Wire.h"
#include <ArduinoBLE.h>

BLEService imuService("19B10000-E8F2-537E-4F6C-D104768A1214");

BLECharacteristic accCharacteristic(
    "19B10001-E8F2-537E-4F6C-D104768A1211",
    BLERead | BLENotify, 40);

BLECharacteristic gyroCharacteristic(
    "19B10002-E8F2-537E-4F6C-D104768A1212",
    BLERead | BLENotify, 40);

BLECharacteristic tempCharacteristic(
    "19B10003-E8F2-537E-4F6C-D104768A1213",
    BLERead | BLENotify, 20);

LSM6DS3 myIMU(I2C_MODE, 0x6A);

#define FREQUENCY_HZ 50
#define INTERVAL_MS (1000 / FREQUENCY_HZ)

unsigned long last_interval_ms = 0;
unsigned long ledTimer = 0;
bool ledState = LOW;

void setup() {
    pinMode(LED_BUILTIN, OUTPUT);
    BLE.begin();
    BLE.setLocalName("IMU_Device");
    BLE.setAdvertisedService(imuService);
    imuService.addCharacteristic(accCharacteristic);
    imuService.addCharacteristic(gyroCharacteristic);
    imuService.addCharacteristic(tempCharacteristic);
    BLE.addService(imuService);
    BLE.advertise();
    myIMU.begin();
}

void blinkFast() {
    if (millis() - ledTimer > 150) {
        ledTimer = millis();
        ledState = !ledState;
        digitalWrite(LED_BUILTIN, ledState);
    }
}

void blinkSlow() {
    if (millis() - ledTimer > 600) {
        ledTimer = millis();
        ledState = !ledState;
        digitalWrite(LED_BUILTIN, ledState);
    }
}

void loop() {
    BLEDevice central = BLE.central();

    if (!central) {
        blinkFast();
        return;
    }

    digitalWrite(LED_BUILTIN, HIGH);

    while (central.connected()) {
        blinkSlow();

        if (millis() - last_interval_ms >= INTERVAL_MS) {
            last_interval_ms = millis();

            float ax = myIMU.readFloatAccelX();
            float ay = myIMU.readFloatAccelY();
            float az = myIMU.readFloatAccelZ();

            float gx = myIMU.readFloatGyroX();
            float gy = myIMU.readFloatGyroY();
            float gz = myIMU.readFloatGyroZ();

            float t = myIMU.readTempC();

            String acc = String(ax) + "," + String(ay) + "," + String(az);
            String gyro = String(gx) + "," + String(gy) + "," + String(gz);
            String temp = String(t);

            accCharacteristic.writeValue(acc.c_str());
            gyroCharacteristic.writeValue(gyro.c_str());
            tempCharacteristic.writeValue(temp.c_str());
        }
    }

    digitalWrite(LED_BUILTIN, LOW);
}
