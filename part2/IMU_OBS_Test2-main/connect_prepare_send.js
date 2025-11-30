// Polar Sense UUIDs
const AccGyro_SERVICE = "fb005c80-02e7-f387-1cad-8acd2d8df0c8";
const AccGyro_PERIOD = "fb005c81-02e7-f387-1cad-8acd2d8df0c8";
const AccGyro_DATA = "fb005c82-02e7-f387-1cad-8acd2d8df0c8";

// Seeed IMU UUIDs
const SEEED_IMU_SERVICE = "19B10000-E8F2-537E-4F6C-D104768A1214";
const SEEED_ACC_CHAR = "19B10001-E8F2-537E-4F6C-D104768A1211";
const SEEED_GYRO_CHAR = "19B10002-E8F2-537E-4F6C-D104768A1212";
const SEEED_TEMP_CHAR = "19B10003-E8F2-537E-4F6C-D104768A1213";

let targetDevice = null;
let heartRate = 0;
let globalServer = null;
let globalAccGyroService = null;
let globalHeartRateService = null;
let sensorType = null; // 'polar' or 'seeed'

function onDataChanged(event) {
    let value = event.target.value;
    prepareDataForServer(value);
}

function onSeeedAccChanged(event) {
    let value = event.target.value;
    let decoder = new TextDecoder('utf-8');
    let csvString = decoder.decode(value);
    let values = csvString.split(',');

    if (values.length === 3) {
        let accData = {
            x: parseFloat(values[0]),
            y: parseFloat(values[1]),
            z: parseFloat(values[2]),
            timestamp: Date.now() * 1000000 // Convert to nanoseconds
        };
        prepareSeeedDataForServer(accData, null);
    }
}

function onSeeedGyroChanged(event) {
    let value = event.target.value;
    let decoder = new TextDecoder('utf-8');
    let csvString = decoder.decode(value);
    let values = csvString.split(',');

    if (values.length === 3) {
        let gyroData = {
            x: parseFloat(values[0]),
            y: parseFloat(values[1]),
            z: parseFloat(values[2]),
            timestamp: Date.now() * 1000000
        };
        prepareSeeedDataForServer(null, gyroData);
    }
}

async function startBluetoothAndHRMonitoring() {
    try {
        const device = await navigator.bluetooth.requestDevice({
            filters: [
                { services: [AccGyro_SERVICE, 'heart_rate'] },
                { namePrefix: "Polar Sense" }
            ],
            optionalServices: [SEEED_IMU_SERVICE]
        });

        targetDevice = device;

        const server = await device.gatt.connect();
        console.log('Connected to GATT server');
        document.getElementById("status").textContent = 'Connected to GATT server';

        // Try Polar first
        try {
            const accGyroService = await server.getPrimaryService(AccGyro_SERVICE);
            console.log('Got Polar Acc/Gyro Service');
            document.getElementById("accGyroService").textContent = 'Got Polar Acc/Gyro Service';
            sensorType = 'polar';

            const heartRateService = await server.getPrimaryService('heart_rate');
            console.log('Got HR Service');
            document.getElementById("heartRateService").textContent = "Got HR Service";

            findDataCharacteristic(accGyroService);
            findPeriodCharacteristic(accGyroService);

            const heartRateCharacteristic = await heartRateService.getCharacteristic('heart_rate_measurement');
            console.log('Got HR Measurement Characteristic');

            await heartRateCharacteristic.startNotifications();
            console.log("Started HR notifications");
            document.getElementById("HRNotifications").textContent = "Started HR notifications";

            heartRateCharacteristic.addEventListener('characteristicvaluechanged', handleHeartRateNotification);
        } catch (error) {
            // Try Seeed if Polar fails
            console.log('Polar service not found, trying Seeed...');
            try {
                const seeedService = await server.getPrimaryService(SEEED_IMU_SERVICE);
                console.log('Got Seeed IMU Service');
                document.getElementById("accGyroService").textContent = 'Got Seeed IMU Service';
                sensorType = 'seeed';

                const accChar = await seeedService.getCharacteristic(SEEED_ACC_CHAR);
                const gyroChar = await seeedService.getCharacteristic(SEEED_GYRO_CHAR);

                await accChar.startNotifications();
                await gyroChar.startNotifications();
                console.log('Started Seeed notifications');
                document.getElementById("DataNotifications").textContent = "Started Seeed notifications";

                accChar.addEventListener('characteristicvaluechanged', onSeeedAccChanged);
                gyroChar.addEventListener('characteristicvaluechanged', onSeeedGyroChanged);

                // Seeed doesn't have HR, set to 0
                document.getElementById("heartRateService").textContent = "N/A (Seeed sensor)";
                document.getElementById("HRNotifications").textContent = "N/A (Seeed sensor)";
            } catch (seeedError) {
                console.error('Neither Polar nor Seeed service found:', seeedError);
                throw seeedError;
            }
        }

    } catch (error) {
        console.error('Error: ' + error);
        targetDevice = null;
    }
}

function handleHeartRateNotification(event) {
    const value = event.target.value;
    heartRate = value.getUint8(1);
    document.getElementById("heartRate").textContent = heartRate;
}

function findDataCharacteristic(service) {
    service.getCharacteristic(AccGyro_DATA)
        .then(characteristic => {
            return characteristic.startNotifications();
        })
        .then(characteristic => {
            characteristic.addEventListener('characteristicvaluechanged', onDataChanged);
            console.log("Notifications started");
            document.getElementById("DataNotifications").textContent = "Notifications started";
        })
        .catch(error => {
            console.log(error);
        });
}

function findPeriodCharacteristic(service) {
    console.log("setData");
    service.getCharacteristic(AccGyro_PERIOD)
        .then(characteristic => {
            const valAcc = new Uint8Array([2, 2, 0, 1, 52, 0, 1, 1, 16, 0, 2, 1, 8, 0, 4, 1, 3]);
            return characteristic.writeValueWithResponse(valAcc).then(() => {
                const valGyro = new Uint8Array([2, 5, 0, 1, 52, 0, 1, 1, 16, 0, 2, 1, 208, 7, 4, 1, 3]);
                return characteristic.writeValueWithResponse(valGyro);
            });
        })
        .catch(error => {
            console.log(error);
        });
}

let lastAccData = null;
let lastGyroData = null;

async function prepareSeeedDataForServer(accData, gyroData) {
    // Store the latest data
    if (accData) lastAccData = accData;
    if (gyroData) lastGyroData = gyroData;

    // Only send when we have both acc and gyro data
    if (!lastAccData || !lastGyroData) return;

    // Create a simplified packet format compatible with the existing server
    const hrBuffer = new ArrayBuffer(4);
    const hrView = new DataView(hrBuffer);
    hrView.setInt32(0, heartRate, true);

    // Create a pseudo-Polar format packet
    // measId (1) + timestamp (8) + acc data (6) + gyro data (6) + padding
    const dataBuffer = new ArrayBuffer(32);
    const dataView = new DataView(dataBuffer);

    // Accelerometer packet (measId = 2)
    dataView.setUint8(0, 2); // measId for acc
    dataView.setBigUint64(1, BigInt(lastAccData.timestamp), true);
    dataView.setInt16(10, Math.round(lastAccData.x / (0.24399999 * 0.00980665)), true);
    dataView.setInt16(12, Math.round(lastAccData.y / (0.24399999 * 0.00980665)), true);
    dataView.setInt16(14, Math.round(lastAccData.z / (0.24399999 * 0.00980665)), true);

    const combinedBuffer = new Uint8Array(hrBuffer.byteLength + dataBuffer.byteLength);
    combinedBuffer.set(new Uint8Array(hrBuffer), 0);
    combinedBuffer.set(new Uint8Array(dataBuffer), hrBuffer.byteLength);

    await sendDataToServer(combinedBuffer.buffer);

    // Send gyro packet
    const gyroBuffer = new ArrayBuffer(32);
    const gyroView = new DataView(gyroBuffer);

    gyroView.setUint8(0, 5); // measId for gyro
    gyroView.setBigUint64(1, BigInt(lastGyroData.timestamp), true);
    gyroView.setInt16(10, Math.round(lastGyroData.x), true);
    gyroView.setInt16(12, Math.round(lastGyroData.y), true);
    gyroView.setInt16(14, Math.round(lastGyroData.z), true);

    const combinedGyroBuffer = new Uint8Array(hrBuffer.byteLength + gyroBuffer.byteLength);
    combinedGyroBuffer.set(new Uint8Array(hrBuffer), 0);
    combinedGyroBuffer.set(new Uint8Array(gyroBuffer), hrBuffer.byteLength);

    await sendDataToServer(combinedGyroBuffer.buffer);
}

async function prepareDataForServer(value) {
    if (!(value instanceof DataView)) {
        throw new Error("Expected value to be an instance of DataView");
    }

    const hrBuffer = new ArrayBuffer(4);
    const hrView = new DataView(hrBuffer);
    hrView.setInt32(0, heartRate, true);

    const arrayBuffer = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);

    const combinedBuffer = new Uint8Array(hrBuffer.byteLength + arrayBuffer.byteLength);
    combinedBuffer.set(new Uint8Array(hrBuffer), 0);
    combinedBuffer.set(new Uint8Array(arrayBuffer), hrBuffer.byteLength);

    await sendDataToServer(combinedBuffer.buffer);
}

async function sendDataToServer(arrayBuffer) {
    try {
        const response = await fetch('http://localhost:3000/data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/octet-stream'
            },
            body: arrayBuffer
        });

        if (response.ok) {
            console.log("Data sent successfully");
            document.getElementById("DataToServer").textContent = "Data sent successfully";
        } else {
            console.error("Error sending data");
            document.getElementById("DataToServer").textContent = "Error sending data";
        }
    } catch (error) {
        console.error("Error sending data:", error);
    }
}

function start() {
    startBluetoothAndHRMonitoring();
}

function stop() {
    if (targetDevice == null) {
        console.log('The target device is null.');
        return;
    }

    targetDevice.gatt.disconnect();
    console.log('Disconnected');
    document.getElementById("status").textContent = 'Disconnected';
    document.getElementById("heartRate").textContent = '--';
    document.getElementById("accGyroService").textContent = '--';
    document.getElementById("heartRateService").textContent = '--';
    document.getElementById("HRNotifications").textContent = '--';
    document.getElementById("DataNotifications").textContent = '--';
    document.getElementById("DataToServer").textContent = '--';
}