// Variables for 1A
var F = 0;
var FOld = 0;
var yFirst = 0;
var oldYFirst = 0;
var ySecond = 0;
var oldYSecond = 0;
var g = 9.81;
var cadence = 0;
var diffTime = 0;
//var threshold = 20;
//var timeShakeFirst = 0;
//var timeShakeCurrent = 0;

// Variabels for measuring the cadence
var seq = 0;
var NumberOfSamples = 0;
var date = new Date();
var timestamp = performance.now();
var oldTimestamp = performance.now();

// Threshold and timeout variables
var stationaryThreshold = 0.5;
var isStationary = false;

// Variables for 1B
var accRoll = 0;
var gyroRoll = 0;
var oldGyroRoll = 0;
var comRoll = 0;
var oldComRoll = 0;

function filter(accDataPoint, gyroDataPoint) {
  // Raw data
  let xAccNew = accDataPoint.data.x;
  let yAccNew = accDataPoint.data.y;
  let zAccNew = accDataPoint.data.z;
  let xGyroNew = gyroDataPoint.data.x;
  let yGyroNew = gyroDataPoint.data.y;
  let zGyroNew = gyroDataPoint.data.z;

  // The sampling time is set under the function findPeriodCharacteristic to 52Hz
  let dT = 1 / 52

  /* Tips: 
    * To print on the console use console.log() 
    * To plot a graph u can use the function below:    
      * plotOnRedLine(XAccOld);
      * plotOnGreenLine(XAccNew);
      * plotOnBlueLine([varible]);
    * The value of the variable should be in between -100 and 100 to fit the canvas
  */

  // 1A Cadence


  // 1A.1 - Calculate the combined Acceleration 

  F = Math.sqrt(Math.pow(xAccNew, 2) + Math.pow(yAccNew, 2) + Math.pow(zAccNew, 2)) - g
  plotOnBlueLine(F)

  // 1A.2  - EWMA Exponential Weighted Moving Average

  let alfa = 0.9; // try different alfa values and observe the result
  yFirst= alfa * oldYFirst + (1 - alfa) * F
  oldYFirst = yFirst
  plotOnRedLine(yFirst)

  // 1A.3 - Add an additional EWMA filter with both an alfa and beta value

  alfa = 0.85
  let beta = 0.95 // try different alfa and beta values

  if (F > FOld) {
    ySecond = alfa * oldYSecond + (1 - alfa) * F
  } else {
    ySecond = beta * oldYSecond + (1 - beta) * F
  }
  plotOnGreenLine(ySecond)

  // 1A.4 Calculate the cadence frequency

  if (yFirst > ySecond && oldYFirst < oldYSecond) {
    timestamp = performance.now()
    diffTime = timestamp - oldTimestamp

    if ((diffTime/1000) > 0.25) {
      cadence = 60 / (diffTime/1000)

      if (cadence < 5) {
        cadence = 0
      }

      console.log(diffTime/1000 + " sec between cadence");
      console.log("Cadence= " + cadence);

      oldTimestamp = timestamp 
      updateCadenceDisplay(cadence);
    }
    
  }

  oldYFirst = yFirst
  FOld = F
  oldYSecond = ySecond


  // 1A In depth assignment(optional)
  // Detect if Polar verity sensor is continually shaken for more than 1 second

  // 1B Rotation
  // 1B.1 Calculate the roll from the Accelerometer on the Polar verity and display the result

  if (yAccNew !== 0 && zAccNew !== 0) {
    accRoll = Math.atan(xAccNew/(Math.sqrt(Math.pow(yAccNew, 2) + Math.pow(zAccNew, 2)))) * 180 / Math.PI
  }

  //plotOnBlueLine(accRoll/2);


  // 1B.2 Calculate the roll from the Gyroscope on the Polar verity and display the result 

  gyroRoll = oldGyroRoll + dT * yGyroNew
  //plotOnRedLine(gyroRoll/100);

  oldGyroRoll = gyroRoll;

  // 1B.3 Apply a Complimenter filter that fuses the Acceleromter and Gyro data, display and compare the result.
  
  comRoll= 0.35 * (oldComRoll + dT * gyroRoll) + (1 - 0.35) * accRoll

  //plotOnGreenLine(comRoll/2);

  // 1B In depth assignment(optional)
  // Write a code that calculates pitch and yaw that also takes the magnetometer for the yaw into account 
  // Or change the complementary filter to a kalman filter
  
  
}

// Function to update the cadence counter in the html page
function updateCadenceDisplay(cadence) {
  const cadenceText = document.getElementById('cadenceText');
  if (cadenceText) {
    cadenceText.textContent = `Cadence: ${cadence.toFixed(0)} steps/min`;
  }
}
