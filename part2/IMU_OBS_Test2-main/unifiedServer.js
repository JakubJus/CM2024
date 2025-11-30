const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.raw({ type: 'application/octet-stream' }));
app.use(express.static(path.join(__dirname, '/')));

let sensorData = [];
let nextIndex = 0;
let firstFetchTime = null;

// Endpoint to receive data from the sensor
app.post('/data', (req, res) => {
    sensorData.push({ data: req.body, timestamp: Date.now() });
    console.log("Data received and stored:", req.body);
    res.sendStatus(200);
});

// Endpoint to get the latest data
app.get('/data', (rq, res) => {
    res.setHeader('Content-Type', 'application/octet-stream');

    if (firstFetchTime === null) {
        firstFetchTime = Date.now();
        // Skip older data
        nextIndex = sensorData.findIndex(entry => entry.timestamp >= firstFetchTime);
        if (nextIndex === -1) nextIndex = sensorData.length; // if no data, set to end of array
    }
    
    if (nextIndex < sensorData.length) {
        const dataToSend = sensorData[nextIndex].data;
        console.log("Sending data:", dataToSend);
        nextIndex++;
        res.send(dataToSend);
    } else {
        res.send(Buffer.alloc(0));
    }
});

// Serve the HTML file for the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'visualize-data.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
})