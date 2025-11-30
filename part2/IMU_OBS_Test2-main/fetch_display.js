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

var fetchIntervalID;
var continueFetching = true;

function init() {
    // Canvas initialization
    canvas = document.getElementById('AccCanvas');
    ctx = canvas.getContext('2d');
    canvas2 = document.getElementById('GyroCanvas');
    ctx2 = canvas2.getContext('2d');
    canvas3 = document.getElementById('SensorFusion');
    ctx3 = canvas3.getContext('2d');
    let heartRateElement = document.getElementById('heartRate');
    
    xAcc = Array(250).fill(100), yAcc = Array(250).fill(100), zAcc = Array(250).fill(100);
    xGyro = Array(250).fill(100), yGyro = Array(250).fill(100), zGyro = Array(250).fill(100);
    rollAr = Array(250).fill(100), pitchAr = Array(250).fill(100), yawAr = Array(250).fill(100);

    console.log("init");
}

function startAndDisplay() {
    class DataPoint {
        constructor(timestamp, type, data) {
            this.timestamp = timestamp;
            this.type = type;
            this.data = data;
        }
    }

    class DataQueue {
        constructor() {
            this.queue = [];
            this.MAX_TIMESTAMP_DIFF = 20000000;
            this.MIN_QUEUE_SIZE = 25;
        }

        add(dataPoint) {
            let index = this.queue.findIndex(item => dataPoint.timestamp < item.timestamp);
            if (index === -1) {
                this.queue.push(dataPoint);
            } else {
                this.queue.splice(index, 0, dataPoint);
            }
        }

        processQueue() {
            while (this.queue.length >= this.MIN_QUEUE_SIZE) {
                const firstDataPoint = this.queue.shift();
                const secondDataPoint = this.queue[0];

                if (secondDataPoint.timestamp - firstDataPoint.timestamp < this.MAX_TIMESTAMP_DIFF) {
                    if (firstDataPoint.type !== secondDataPoint.type) {
                        let accDataPoint = firstDataPoint.type === 'acceleration' ? firstDataPoint : secondDataPoint;
                        let gyroDataPoint = firstDataPoint.type === 'gyro' ? firstDataPoint : secondDataPoint;
                        filter(accDataPoint, gyroDataPoint);
                        continue;
                    }
                }

                if (firstDataPoint.type === 'acceleration') {
                    let gyroDataPoint = new DataPoint(firstDataPoint.timestamp, 'gyro', { x: 0, y: 0, z: 0});
                    filter(firstDataPoint, gyroDataPoint);
                } else if (firstDataPoint.type === 'gyro') {
                    let accDataPoint = new DataPoint(firstDataPoint.timestamp, 'acceleration', { x: 0, y: 0, z: 0});
                    filter(accDataPoint, firstDataPoint);
                }
            }
        }
    }

    const queue = new DataQueue();

    function onDataChanged(value, heartRate) {
        let measId = value.getUint8(0);
        value = value.buffer ? value : new DataView(value);

        if (measId == 2) {
            updateAcc(value);
        } else if (measId == 5) {
            updateGyro(value);
        }

        document.getElementById("heartRate").textContent = heartRate;
    }

    function uppdateAcc(xAccNew, yAccNew, zAccNew, timestamp) {
        //console.log("Updating Accelerometer:", xAccNew, yAccNew, zAccNew, timestamp);
        let adjustX = 100 + (xAccNew * 8);
        let adjustY = 100 + (yAccNew * 8);
        let adjustZ = 100 + (zAccNew * 8);

        let accDataPoint = new DataPoint(timestamp, 'acceleration', { x: xAccNew, y: yAccNew, z: zAccNew});
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
        //console.log("Updating Gyroscope:", xGyroNew, yGyroNew, zGyroNew, timestamp);
        let adjustX = 100 + (xGyroNew / 100);
        let adjustY = 100 + (yGyroNew / 100);
        let adjustZ = 100 + (zGyroNew / 100);

        let gyroDataPoint = new DataPoint(timestamp, 'gyro', { x: xGyroNew, y: yGyroNew, z: zGyroNew});
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

        uppdateGyro(xGyroNew, yGyroNew, zGyroNew, timestamp);

        let offset = 10 + 2 * 3;
        let sampleCount = value.getUint8(offset + 1);
        let deltaSize = value.getUint8(offset);
        let deltaBytesCount = Math.ceil((sampleCount * deltaSize) * 3 / 8);
        let indexDeltaStart = offset + 2;
        let binDeltaData = bufferToReverseBinString(value.buffer.slice(indexDeltaStart, indexDeltaStart + deltaBytesCount));

        for (let i = 0; i < sampleCount; i++) {
            let j = 0;
            let binSample = binDeltaData.slice(i * 3 * deltaSize);
            let signedInt = bitStringToSignedInt(binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join(""));
            xGyroNew = xGyroNew + signedInt;
            j = 1;
            signedInt = bitStringToSignedInt(binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join(""));
            yGyroNew = yGyroNew + signedInt;
            j = 2;
            signedInt = bitStringToSignedInt(binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join(""));
            zGyroNew = zGyroNew + signedInt;
            let correctedTimestamp = timestamp + ((i + 1) * 1/ 52) * Math.pow(10, 9);
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
        let deltaSize = value.getUint8(offset);
        let deltaBytesCount = Math.ceil((sampleCount * deltaSize) * 3 / 8);
        let binDeltaData = bufferToReverseBinString(value.buffer.slice(offset + 2, offset + 2 + deltaBytesCount));

        for (let i = 0; i < sampleCount; i++) {
            let j = 0;
            let binSample = binDeltaData.slice(i * 3 * deltaSize);
            let signedInt = bitStringToSignedInt(binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join(""));
            xAccNew = xAccNew + (signedInt * 0.24399999 * 0.01);
            j = 1;
            signedInt = bitStringToSignedInt(binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join(""));
            yAccNew = yAccNew + (signedInt * 0.24399999 * 0.01);
            j = 2;
            signedInt = bitStringToSignedInt(binSample.slice(j * deltaSize, (j + 1) * deltaSize).split("").reverse().join(""));
            zAccNew = zAccNew + (signedInt * 0.24399999 * 0.01);
            let correctedTimestamp = timestamp + ((i + 1) * 1 / 52) * Math.pow(10, 9);
            uppdateAcc(xAccNew, yAccNew, zAccNew, correctedTimestamp);
        }
    }

    async function fetchData() {
        if (!continueFetching) return;

        try {
            const response = await fetch('http://localhost:3000/data', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/octet-stream'
                }
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const arrayBuffer = await response.arrayBuffer();
            const dataView = new DataView(arrayBuffer);

            //Added part for HR
            const heartRate = dataView.getInt32(0, true);
            const sensorData = arrayBuffer.slice(4);
            const sensorDataView = new DataView(sensorData);

            onDataChanged(sensorDataView, heartRate);

        } catch (error) {
            console.error('Error fetching data:', error);
        }
    }

    function animationLoop(timestamp) {
        //console.log("xAcc:", xAcc);

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

    function start() {
        continueFetching = true;
        fetchIntervalID = setInterval(fetchData, 500); // Change here the time in ms of the fetching function call
        requestId = requestAnimationFrame(animationLoop);
    }

    start();
}

function stopFetching() {

    if (requestId) {
      cancelAnimationFrame(requestId);
    }

    if (fetchIntervalID) {
        clearInterval(fetchIntervalID);
    }

    continueFetching = false;
}

async function saveToFile() {
    var file;
    var properties = { type: 'application/json' }; // Specify the file's mime-type.
    var myObj = { accX: xAcc, accY: yAcc, accZ: zAcc, gyroX: xGyro, gyroY: yGyro, gyroZ: xGyro, poses: poseData };
    var myJSON = JSON.stringify(myObj);
    try {
      // Specify the filename using the File constructor, but ...
      file = new File(myJSON, "6DOF.json", properties);
    } catch (e) {
      // ... fall back to the Blob constructor if that isn't supported.
      file = new Blob([myJSON], { type: "application/json" });
    }
    var a = document.createElement('a');
    a.href = window.URL.createObjectURL(file);
    a.download = "6DOF.json";
    a.click();
  
}


// convert buffer array to binary
function bufferToReverseBinString(buffer) {
    array = new Uint8Array(buffer);
    let bin = [];
    array.forEach(function (element) {
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