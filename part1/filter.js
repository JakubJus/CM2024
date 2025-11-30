// Variables for 1A
var F = 0;
var FOld = 0;
var yFirst = 0;
var oldYFirst = 0;
var ySecond = 0;
var oldYSecond = 0;

// Variabels for measuring the cadence
var seq = 0;
var NumberOfSamples = 0;
var date = new Date();
var timestamp = date.getTime();
var oldTimestamp = timestamp;

// Variables for 1B
var accRoll = 0;
var gyroRoll = 0;
var comRoll = 0;

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
    * To plot a graph u can use the function bellow:    
      * plotOnRedLine(XAccOld);
      * plotOnGreenLine(XAccNew);
      * plotOnBlueLine([varible]);
    * The value of the variable should be inbetween -100 and 100 to fit the canvas
  */
 alfa = 0.9
 F = alfa * F + (1-alfa)*yAccNew
 plotOnRedLine(yAccNew)
 plotOnGreenLine(F)
 console.log(F)


  // Start writing your code below this line 
  // 1A Cadence


  // 1A.1 - Calculate the combinde Acceleration 
  // The function to use is Math.sqrt() and Math.pow(g, 2) 
  

                //Fill in the blank with your code


  
  // 1A.2  - EWMA Exponential Weighted Moving Average

     // let alfa = 0.5; // try different alfa values and observe the result



               //Fill in the blank with your code




  // 1A.3 - Add an additional EWMA filter with both an alfa and beta value

    // alfa = 0.1
    // let beta = 0.01 // try different alfa and beta values


              //Fill in the blank with your code




  // 1A.4 Calculate the cadence frequency
  // There is a variable cadence that you can use to make a EWMA filter of the cadence

    // NumberOfSamples = NumberOfSamples + 1;
    // if(1>2){
    // console.log(           +'sec between cadence');
    // NumberOfSamples = 0;
 // }




  // 1A In depth assignment(optional)
  // Detect if Polar verity sensor is continually shaken for more than 1 second


          //Fill in the blank with your code



  // 1B Rotation
  // 1B.1 Calculate the roll from the Accelerometer on the Polar verity and display the result


  //Fill in the blank with your code
  //plotOnBlueLine(accRoll);




  // 1B.2 Calculate the roll from the Gyroscope on the Polar verity and display the result 



  //Fill in the blank with your code
  // plotOnRedLine(gyroRoll);





  // 1B.3 Apply a Complimenter filter that fuses the Acceleromter and Gyro data, display and compare the result.




  //Fill in the blank with your code
  //plotOnGreenLine(comRoll);




  // 1B In depth assignment(optional)
  // Write a code that calculates pitch and yaw that also takes the magnetometer for the yaw into account 
  // Or change the complementary filter to a kalman filter
}
