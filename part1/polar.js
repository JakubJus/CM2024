// Variables to draw on canvases
var canvas, canvas2, canvas3, ctx, ctx2, ctx3, requestId;
var OutputString = "Output";
// Lists to store the acceleration data (we draw on canvas)
var xAcc = [];
var yAcc = [];
var zAcc = [];
// Lists to store the gyro data (we draw on canvas2)
var xGyro = [];
var yGyro = [];
var zGyro = [];
// Lists to store the filtered data (we draw on canvas3)
var rollAr = [];
var pitchAr = [];
var yawAr = [];

// Bluetooth variables
let targetDevice = null;
let sensorType = null; // 'polar' or 'seeed'

// Polar Sense UUIDs
const AccGyro_SERVICE = "fb005c80-02e7-f387-1cad-8acd2d8df0c8";
const AccGyro_PERDIO = "fb005c81-02e7-f387-1cad-8acd2d8df0c8";
const AccGyro_DATA = "fb005c82-02e7-f387-1cad-8acd2d8df0c8";

// Seeed IMU UUIDs
const SEEED_IMU_SERVICE = "19b10000-e8f2-537e-4f6c-d104768a1214";
const SEEED_ACC_CHAR = "19b10001-e8f2-537e-4f6c-d104768a1211";
const SEEED_GYRO_CHAR = "19b10002-e8f2-537e-4f6c-d104768a1212";
const SEEED_TEMP_CHAR = "19b10003-e8f2-537e-4f6c-d104768a1213";
class DataPoint {
    // Class for one datapoint
    constructor(timestamp, type, data) {
        this.timestamp = timestamp;
        this.type = type; // 'acceleration' or 'gyro'
        this.data = data; // x, y and z
    }
}

class DataQueue {
    // Class for the queue that synchronizes the acceleration and gyro data
    constructor() {
        this.queue = [];
        this.MAX_TIMESTAMP_DIFF = 20000000; // Maximum allowed timestamp difference for synchronization in ns
        this.MIN_QUEUE_SIZE = 25; // Minimum length of queue before data is processed
    }

    // function that adds a datapoint to the queue
    add(dataPoint) {
        // Insert the data point in a sorted manner based on timestamp
        let index = this.queue.findIndex(item => dataPoint.timestamp < item.timestamp);
        if (index === -1) {
            this.queue.push(dataPoint);
        } else {
            this.queue.splice(index, 0, dataPoint);
        }
    }

    // Function that processes the queue
    processQueue() {
        while (this.queue.length >= this.MIN_QUEUE_SIZE) {
            // We get the two data points in front of the queue
            const firstDataPoint = this.queue.shift();
            const secondDataPoint = this.queue[0];

            if (secondDataPoint.timestamp - firstDataPoint.timestamp < this.MAX_TIMESTAMP_DIFF) {
                // Here the timestamps are within our tolerance
                if (firstDataPoint.type !== secondDataPoint.type) {
                    let accDataPoint = firstDataPoint.type === 'acceleration' ? firstDataPoint : secondDataPoint;
                    let gyroDataPoint = firstDataPoint.type === 'gyro' ? firstDataPoint : secondDataPoint;
                    filter(accDataPoint, gyroDataPoint);
                    continue;
                }
            }
            // The data points did not match so we add a 'zero' data point with the 
            // same timestamp as the first data point
            if (firstDataPoint.type === 'acceleration') {
                // Here we add a 'zero' gyro data point
                let gyroDataPoint = new DataPoint(firstDataPoint.timestamp, 'gyro', { x: 0, y: 0, z: 0 });
                filter(firstDataPoint, gyroDataPoint)
            } else if (firstDataPoint.type === 'gyro') {
                // Here we add a 'zero' acceleration data point
                let accDataPoint = new DataPoint(firstDataPoint.timestamp, 'acceleration', { x: 0, y: 0, z: 0 });
                filter(accDataPoint, firstDataPoint)
            }
        }
    }
}

// Variable we use to put data packages into and process
const queue = new DataQueue();

// SEEED SENSOR HANDLERS
function onSeeedAccChanged(event) {
    let value = event.target.value;
    let decoder = new TextDecoder('utf-8');
    let csvString = decoder.decode(value);
    let values = csvString.split(',');

    if (values.length === 3) {
        let xAccNew = parseFloat(values[0]);
        let yAccNew = parseFloat(values[1]);
        let zAccNew = parseFloat(values[2]);
        let timestamp = Date.now() * 1000000; // Convert to nanoseconds

        uppdateAcc(xAccNew, yAccNew, zAccNew, timestamp);
    }
}

function onSeeedGyroChanged(event) {
    let value = event.target.value;
    let decoder = new TextDecoder('utf-8');
    let csvString = decoder.decode(value);
    let values = csvString.split(',');

    if (values.length === 3) {
        let xGyroNew = parseFloat(values[0]);
        let yGyroNew = parseFloat(values[1]);
        let zGyroNew = parseFloat(values[2]);
        let timestamp = Date.now() * 1000000;

        uppdateGyro(xGyroNew, yGyroNew, zGyroNew, timestamp);
    }
}

// POLAR SENSOR HANDLERS
function onDataChanged(event) {
    let value = event.target.value;
    let measId = value.getUint8(0);
    value = value.buffer ? value : new DataView(value);

    if (measId == 2) {
        updateAcc(value);
    } else if (measId == 5) {
        updateGyro(value);
    }
}

function uppdateAcc(xAccNew, yAccNew, zAccNew, timestamp) {
    // Adjustment for drawing
    let adjustX = 100 + (xAccNew * 8);
    let adjustY = 100 + (yAccNew * 8);
    let adjustZ = 100 + (zAccNew * 8);

    let accDataPoint = new DataPoint(timestamp, 'acceleration', { x: xAccNew, y: yAccNew, z: zAccNew });
    queue.add(accDataPoint);
    queue.processQueue();
    xAcc.shift();
    xAcc.push(adjustX);
    yAcc.shift();
    yAcc.push(adjustY);
    zAcc.shift();
    zAcc.push(adjustZ);
}

function uppdateGyro(xGyroNew, yGyroNew, zGyroNew, timestamp) {
    // Adjustment for drawing
    let adjustX = 100 + (xGyroNew / 100);
    let adjustY = 100 + (yGyroNew / 100);
    let adjustZ = 100 + (zGyroNew / 100);

    let gyroDataPoint = new DataPoint(timestamp, 'gyro', { x: xGyroNew, y: yGyroNew, z: zGyroNew });
    queue.add(gyroDataPoint);
    queue.processQueue();
    xGyro.shift();
    xGyro.push(adjustX);
    yGyro.shift();
    yGyro.push(adjustY);
    zGyro.shift();
    zGyro.push(adjustZ);
}

function updateGyro(value) {
    let xGyroNew = value.getInt16(10 + 2 * 0, true);
    let yGyroNew = value.getInt16(10 + 2 * 1, true);
    let zGyroNew = value.getInt16(10 + 2 * 2, true);

    let timestamp = Number(value.getBigUint64(1, true));

    uppdateGyro(xGyroNew, yGyroNew, zGyroNew, timestamp);

    let offset = 10 + 2 * 3;
    let sampleCount = value.getUint8(offset + 1);
    let indexDeltaStart = offset + 2;
    let deltaSize = value.getUint8(offset);
    let deltaBytesCount = Math.ceil((sampleCount * deltaSize) * 3 / 8);
    let indexDeltaStop = indexDeltaStart + deltaBytesCount;

    let deltaData = value.buffer.slice(indexDeltaStart, indexDeltaStop);
    let binDeltaData = bufferToReverseBinString(deltaData);

    for (let i = 0; i < sampleCount; i++) {
        let j = 0;
        let binSample = binDeltaData.slice(i * 3 * deltaSize);
        let channelSample = binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join("");
        let signedInt = bitStringToSignedInt(channelSample);
        xGyroNew = xGyroNew + (signedInt);
        j = 1
        binSample = binDeltaData.slice(i * 3 * deltaSize);
        channelSample = binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join("");
        signedInt = bitStringToSignedInt(channelSample);
        yGyroNew = yGyroNew + (signedInt);
        j = 2
        binSample = binDeltaData.slice(i * 3 * deltaSize);
        channelSample = binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join("");
        signedInt = bitStringToSignedInt(channelSample);
        zGyroNew = zGyroNew + (signedInt);
        let correctedTimestamp = timestamp + ((i + 1) * 1 / 52) * Math.pow(10, 9);
        uppdateGyro(xGyroNew, yGyroNew, zGyroNew, correctedTimestamp);
    }
}

function updateAcc(value) {
    let xAccNew = value.getInt16(10 + 2 * 0, true) * 0.24399999 * 0.00980665;
    let yAccNew = value.getInt16(10 + 2 * 1, true) * 0.24399999 * 0.00980665;
    let zAccNew = value.getInt16(10 + 2 * 2, true) * 0.24399999 * 0.00980665;

    let timestamp = Number(value.getBigUint64(1, true));
    uppdateAcc(xAccNew, yAccNew, zAccNew, timestamp);

    let offset = 10 + 2 * 3;
    let sampleCount = value.getUint8(offset + 1);
    let indexDeltaStart = offset + 2;
    let deltaSize = value.getUint8(offset);
    let deltaBytesCount = Math.ceil((sampleCount * deltaSize) * 3 / 8);

    let indexDeltaStop = indexDeltaStart + deltaBytesCount;
    let deltaData = value.buffer.slice(indexDeltaStart, indexDeltaStop);
    let test = value.buffer.slice(indexDeltaStart, Math.ceil(indexDeltaStart + deltaSize / 8));
    let binDeltaData = bufferToReverseBinString(deltaData);
    var uint8View = new Uint8Array(test);
    if (deltaSize == 12) {
        uint8View[1] = uint8View[1] ^ 15;
    }
    if (deltaSize == 6) {
        uint8View[0] = uint8View[0] ^ 63;
    }

    for (let i = 0; i < sampleCount; i++) {
        let j = 0;
        let binSample = binDeltaData.slice(i * 3 * deltaSize);
        let channelSample = binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join("");
        let signedInt = bitStringToSignedInt(channelSample);
        xAccNew = xAccNew + (signedInt * 0.24399999 * 0.01);
        j = 1
        binSample = binDeltaData.slice(i * 3 * deltaSize);
        channelSample = binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join("");
        signedInt = bitStringToSignedInt(channelSample);
        yAccNew = yAccNew + (signedInt * 0.24399999 * 0.01);
        j = 2
        binSample = binDeltaData.slice(i * 3 * deltaSize);
        channelSample = binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join("");
        signedInt = bitStringToSignedInt(channelSample);
        zAccNew = zAccNew + (signedInt * 0.24399999 * 0.01);
        let correctedTimestamp = timestamp + ((i + 1) * 1 / 52) * Math.pow(10, 9);
        uppdateAcc(xAccNew, yAccNew, zAccNew, correctedTimestamp);
    }
}

function init() {
    canvas = document.getElementById('AccCanvas');
    ctx = canvas.getContext('2d');
    canvas2 = document.getElementById('GyroCanvas');
    ctx2 = canvas2.getContext('2d');
    canvas3 = document.getElementById('SensorFusion');
    ctx3 = canvas3.getContext('2d');
    for (i = 0; i < 250; i++) {
        xAcc.push(100);
        yAcc.push(100);
        zAcc.push(100);
        xGyro.push(100);
        yGyro.push(100);
        zGyro.push(100);
        rollAr.push(100);
        pitchAr.push(100);
        yawAr.push(100);
    }
    console.log("init");
}

async function startBluetooth() {
    try {
        // Ask user to pick ANY device
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [AccGyro_SERVICE, SEEED_IMU_SERVICE]
        });

        targetDevice = device;
        const server = await device.gatt.connect();
        console.log("Connected to GATT server:", device.name);

        // POLAR DEVICE?
        try {
            const polarService = await server.getPrimaryService(AccGyro_SERVICE);
            console.log("Polar Verity Sense detected");
            sensorType = "polar";
            findDataCharacteristic(polarService);
            findPeriodCharacteristic(polarService);
            return;
        } catch (err) {
            console.log("No Polar service, checking for Seeed…");
        }

        // SEEED XIAO DEVICE?
        try {
            const seeedService = await server.getPrimaryService(SEEED_IMU_SERVICE);
            console.log("Seeed IMU detected");
            sensorType = "seeed";

            const accChar = await seeedService.getCharacteristic(SEEED_ACC_CHAR);
            const gyroChar = await seeedService.getCharacteristic(SEEED_GYRO_CHAR);

            await accChar.startNotifications();
            await gyroChar.startNotifications();

            accChar.addEventListener("characteristicvaluechanged", onSeeedAccChanged);
            gyroChar.addEventListener("characteristicvaluechanged", onSeeedGyroChanged);

            console.log("Seeed notifications started");
            return;

        } catch (err) {
            console.error("Neither sensor type matched", err);
        }

    } catch (error) {
        console.error("Bluetooth connection failed:", error);
    }
}


function findDataCharacteristic(service) {
    service.getCharacteristic(AccGyro_DATA)
        .then(characteristic => {
            return characteristic.startNotifications();
        })
        .then(characteristic => {
            characteristic.addEventListener('characteristicvaluechanged', onDataChanged);
            console.log("Polar notifications started");
        })
        .catch(error => {
            console.log(error);
        });
}

function plotOnRedLine(newValue) {
    rollAr.shift();
    rollAr.push(100 + newValue);
}

function plotOnBlueLine(newValue) {
    yawAr.shift();
    yawAr.push(100 + newValue);
}

function plotOnGreenLine(newValue) {
    pitchAr.shift();
    pitchAr.push(100 + newValue);
}

function findPeriodCharacteristic(service) {
    console.log("setData");
    service.getCharacteristic(AccGyro_PERDIO)
        .then(characteristic => {
            const valAcc = new Uint8Array([2, 2, 0, 1, 52, 0, 1, 1, 16, 0, 2, 1, 8, 0, 4, 1, 3]);
            characteristic.writeValueWithResponse(valAcc)
                .catch(async() => {
                    console.log("DOMException: GATT operation already in progress.")
                    await Promise.resolve();
                    this.delayPromise(1000);
                    characteristic.writeValue(valAcc);
                });

            setTimeout(function() {
                const valGyro = new Uint8Array([2, 5, 0, 1, 52, 0, 1, 1, 16, 0, 2, 1, 208, 7, 4, 1, 3]);
                characteristic.writeValueWithResponse(valGyro)
                    .catch(async() => {
                        console.log("DOMException: GATT operation already in progress.")
                        return Promise.resolve()
                            .then(() => this.delayPromise(1000))
                            .then(() => { characteristic.writeValue(valGyro); });
                    });
            }, 100);
        })
        .catch(error => {
            console.log(error);
        });
}

function delayPromise(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function start() {
    startBluetooth();
    requestId = requestAnimationFrame(animationLoop);
}

function stop() {
    if (requestId) {
        cancelAnimationFrame(requestId);
    }
    if (targetDevice == null) {
        console.log('The target device is null.');
        return;
    }
    targetDevice.gatt.disconnect();
    console.log('Disconnected');
}

function animationLoop(timestamp) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = "12px Arial";
    ctx.fillStyle = "#FF0000";
    ctx.fillText("Accelerometer X Y Z:", 5, 12);

    ctx.strokeStyle = "#FF0000";
    ctx.beginPath(0, 200 - xAcc[0]);
    for (foo = 0; foo < canvas.width; foo++) {
        ctx.lineTo(foo * 2, 200 - xAcc[foo]);
    }
    ctx.stroke();

    ctx.strokeStyle = "#00FF00";
    ctx.beginPath(0, 200 - yAcc[0]);
    for (foo = 0; foo < canvas.width; foo++) {
        ctx.lineTo(foo * 2, 200 - yAcc[foo]);
    }
    ctx.stroke();

    ctx.strokeStyle = "#0000FF";
    ctx.beginPath(0, 200 - zAcc[0]);
    for (foo = 0; foo < canvas.width; foo++) {
        ctx.lineTo(foo * 2, 200 - zAcc[foo]);
    }
    ctx.stroke();

    ctx2.clearRect(0, 0, canvas2.width, canvas2.height);

    ctx2.font = "12px Arial";
    ctx2.fillStyle = "#FF0000";
    ctx2.fillText('Gyro X Y Z: ', 5, 12);

    ctx2.strokeStyle = "#FF0000";
    ctx2.beginPath(0, 200 - xGyro[0]);
    for (foo = 0; foo < canvas2.width; foo++) {
        ctx2.lineTo(foo * 2, 200 - xGyro[foo]);
    }
    ctx2.stroke();

    ctx2.strokeStyle = "#00FF00";
    ctx2.beginPath(0, 200 - yGyro[0]);
    for (foo = 0; foo < canvas2.width; foo++) {
        ctx2.lineTo(foo * 2, 200 - yGyro[foo]);
    }
    ctx2.stroke();

    ctx2.strokeStyle = "#0000FF";
    ctx2.beginPath(0, 200 - zGyro[0]);
    for (foo = 0; foo < canvas2.width; foo++) {
        ctx2.lineTo(foo * 2, 200 - zGyro[foo]);
    }
    ctx2.stroke();

    ctx3.clearRect(0, 0, canvas3.width, canvas3.height);

    ctx3.font = "12px Arial";
    ctx3.fillStyle = "#FF0000";
    ctx3.fillText(OutputString, 5, 12);

    ctx3.strokeStyle = "#FF0000";
    ctx3.beginPath(0, 200 - rollAr[0]);
    for (foo = 0; foo < canvas3.width; foo++) {
        ctx3.lineTo(foo * 2, 200 - rollAr[foo]);
    }
    ctx3.stroke();

    ctx3.strokeStyle = "#00FF00";
    ctx3.beginPath(0, 200 - pitchAr[0]);
    for (foo = 0; foo < canvas3.width; foo++) {
        ctx3.lineTo(foo * 2, 200 - pitchAr[foo]);
    }
    ctx3.stroke();

    ctx3.strokeStyle = "#0000FF";
    ctx3.beginPath(0, 200 - yawAr[0]);
    for (foo = 0; foo < canvas3.width; foo++) {
        ctx3.lineTo(foo * 2, 200 - yawAr[foo]);
    }
    ctx3.stroke();

    requestId = requestAnimationFrame(animationLoop);
}

// convert buffer array to binary
function bufferToReverseBinString(buffer) {
    array = new Uint8Array(buffer);
    let bin = [];
    array.forEach(function(element) {
        let elementBin = (element >>> 0).toString(2);
        let elementBin8 = elementBin.padStart(8, '0');
        bin.push(elementBin8.split('').reverse().join(''));
    });
    return bin.join('');
}

function bitStringToSignedInt(binStr) {
    if (binStr.length > 64) throw new RangeError('parsing only supports ints up to 32 bits');
    return parseInt(binStr[0] === "1" ? binStr.padStart(32, "1") : binStr.padStart(32, "0"), 2) >> 0;
}

function saveToFile() {
    var file;
    var properties = { type: 'application/json' };
    var myObj = { accX: xAcc, accY: yAcc, accZ: zAcc, magX: xGyro, magY: yGyro, magZ: xGyro };
    var myJSON = JSON.stringify(myObj);
    try {
        file = new File(myJSON, "6DOF.json", properties);
    } catch (e) {
        file = new Blob([myJSON], { type: "application/json" });
    }
    var a = document.createElement('a');
    a.href = window.URL.createObjectURL(file);
    a.download = "6DOF.json";
    a.click();
}
window.addEventListener("load", () => {
    document.getElementById("startBtn").addEventListener("click", start);
    document.getElementById("stopBtn").addEventListener("click", stop);
    document.getElementById("saveBtn").addEventListener("click", saveToFile);
});