//Valeurs de règlages:
var tempsValPos = (180*60*1000); //temps de validité de la position //180 minutes
var intervEnvDonnee = (90*60*1000); //90 minutes
var difLoc = 0.0001; //difference de localisation a dépasser pour envoi des données à la montre
var difCorr_eotd = 0.1; //différence de valeur de correction de l'equation du temps pour envoi 

var latitude;
var longitude;
// Test location:
//latitude  = 46.5;
//longitude = 6.2;
var applicationStarting = true;
var offsetTZ;
var timeZone;
var corr_eotd;
var lastLatitude;
var lastLongitude;
var last_corr_eotd;
var lastSend;
// There are two cases when data is sent to watch:
// 1. On application startup. If location service is not available cached location is used.
// 2. Periodic update. Data is sent only if location is available and location has changed considerably

function requestLocationAsync() {
    navigator.geolocation.getCurrentPosition(
        locationSuccess,
        locationError,
        {
            enableHighAccuracy : true,
            timeout: 10000, 
            maximumAge: tempsValPos //90 minutes ou //Infinity
        }
    );    
}

Pebble.addEventListener("ready",  //démarrage de l'appli
    function(e) {
        console.log("JS starting...");
            
        latitude  = localStorage.getItem("latitude");
        longitude = localStorage.getItem("longitude");
        console.log("Retrieved from localStorage: latitude=" + latitude + ", longitude=" + longitude);
        
        // Call first time when starting:
        requestLocationAsync();    
        // Schedule periodic position poll every X minutes:
        //setInterval(function() {requestLocationAsync();offsetTimeZone();time_Zone();sendToWatch();}, intervEnvDonnee);
        setInterval(function() {requestLocationAsync();}, intervEnvDonnee);
}
);

Pebble.addEventListener('appmessage',  //réception d'une demande de la montre
    function(e) {
        console.log('Received appmessage: ' + JSON.stringify(e.payload));
        applicationStarting = true;  // pour l'envoi des données dans tous les cas
        requestLocationAsync(); 
    }
);

function offsetTimeZone(){offsetTZ = new Date().getTimezoneOffset() * 60;}  

//http://www.onlineaspect.com/2007/06/08/auto-detect-a-time-zone-with-javascript/
function time_Zone(){  
    var rightNow = new Date();
    var jan1 = new Date(rightNow.getFullYear(), 0, 1, 0, 0, 0, 0);
    var temp = jan1.toGMTString();
    var jan2 = new Date(temp.substring(0, temp.lastIndexOf(" ")-1));
    timeZone = (jan1 - jan2) / (1000);
}

function sendToWatch() {
        //corr_eotd = correction_eot();
        console.log("  latitude = " + latitude);
        console.log("  longitude = " + longitude);
      /*if (Math.abs(latitude - lastLatitude) > 0.0001 || Math.abs(longitude - lastLongitude) > 0.0001) { */
      Pebble.sendAppMessage( 
      { 
         "latitude"       : latitude * 1000000,
         "longitude"      : longitude * 1000000,
         "timezoneOffset" : offsetTZ,
         "time_zone"      : timeZone,
         "corr_eot"       : corr_eotd * 1000000,
      },
      
      function(e) { console.log("Successfully delivered message with transactionId="   + e.data.transactionId); },
      function(e) { console.log("Unsuccessfully delivered message with transactionId=" + e.data.transactionId);}
  );
  lastSend = Date.now();
  /*
      }
        Pebble.sendAppMessage( 
      { 
         "timezoneOffset" : offsetTZ,
         "time_zone"      : timeZone,
         "eot"            : eotd * 1000000,
      },
      
      function(e) { console.log("Successfully delivered message with transactionId="   + e.data.transactionId); },
      function(e) { console.log("Unsuccessfully delivered message with transactionId=" + e.data.transactionId);}
    );
    */
}


function locationSuccess(position) {
    lastLatitude  = latitude;
    lastLongitude = longitude;
    last_corr_eotd = corr_eotd;
    
    latitude  = position.coords.latitude;
    longitude = position.coords.longitude;
    console.log("Got position: lat " + latitude + ", long " + longitude);
    
    localStorage.setItem("latitude",  latitude);
    localStorage.setItem("longitude", longitude);
  
    corr_eotd = correction_eot();

    if (applicationStarting) {
        offsetTimeZone();
        time_Zone();  
        sendToWatch();    
        applicationStarting = false;
      
    }// else if (Math.abs(latitude - lastLatitude) > 0.01 || Math.abs(longitude - lastLongitude) > 0.01) { // if location change is significant
      else if (Math.abs(latitude - lastLatitude) > difLoc || Math.abs(longitude - lastLongitude) > difLoc || Math.abs(corr_eotd - last_corr_eotd) > difCorr_eotd && (lastSend + intervEnvDonnee) < Date.now()) { // if location change is significant
        offsetTimeZone();
        time_Zone();  
        sendToWatch();
        
    }
}

function locationError(error) {
    console.log("navigator.geolocation.getCurrentPosition() returned error " + error.code);
    switch(error.code) {
        case error.PERMISSION_DENIED:
            console.log("  Permission denied.");
            break;
        case error.POSITION_UNAVAILABLE:
            console.log("  Position unavailable.");
            break;
        case error.TIMEOUT:
            console.log("  Timeout.");
            break;
        case error.UNKNOWN_ERROR:
            console.log("  Unknown error.");
            break;
    }    
  
    corr_eotd = correction_eot();
  
    if (applicationStarting) {
        // use last cached location if available
        offsetTimeZone();
        time_Zone();  
        sendToWatch();
        applicationStarting = false;
      
    }else if (Math.abs(corr_eotd - last_corr_eotd) > difCorr_eotd && (lastSend + intervEnvDonnee) < Date.now()){
        offsetTimeZone();
        time_Zone();  
        sendToWatch();
    }
}

function correction_eot(){
    /*
bbb = 367 * The_Year - 730531.5
ccc = int((7 * int(The_Year + (The_Month + 9) / 12)) / 4)
ddd = int(275 * The_Month / 9) + The_Day
D2000 = bbb - ccc + ddd + (The_Hour + The_Minute / 60 + The_Second / 3600) / 24
Cycle = int(D2000 / 365.25)
Theta = 0.0172024 * (D2000 - 365.25 * Cycle)
Average = 0.00526
Amp1 = 7.36303 - Cycle * 9e-05
Amp2 = 9.92465 - Cycle * 0.00014
Phi1 = 3.07892 + Cycle * -0.00019
Phi2 = -1.38995 + Cycle * 0.00013

EoT1 = Amp1 * sin(1 * (Theta + Phi1))
EoT2 = Amp2 * sin(2 * (Theta + Phi2))
EoT3 = 0.3173 * sin(3 * (Theta - 0.94686))
EoT4 = 0.21922 * sin(4 * (Theta - 0.60716))

EoT = Average + EoT1 + EoT2 + EoT3 + EoT4
*/
  var j1970;
  var d2000;
  var cycle;
  var theta;
  var average;
  var amp1;
  var amp2;
  var phi1;
  var phi2;
  var eot1;
  var eot2;
  var eot3;
  var eot4;

  j1970 = ((Date.now() / 1000) / (3600*24));//+ (new Date().getTimezoneOffset()*60)) / (3600.0*24.0);
  d2000 = j1970 - 11322.5;
  cycle = Math.floor(d2000 / 365.25);
  theta = 0.0172024 * (d2000 - 365.25 * cycle);
  average = 0.00526;
  amp1 = 7.36303 - cycle * 9.0e-05;
  amp2 = 9.92465 - cycle * 0.00014;
  phi1 = 3.07892 + cycle * -0.00019;
  phi2 = -1.38995 + cycle * 0.00013;
  //Calcul de l'équation du temps
  eot1 = amp1 * Math.sin(1.0 * (theta + phi1));
  eot2 = amp2 * Math.sin(2.0 * (theta + phi2));
  eot3 = 0.3173* Math.sin(3.0 * (theta - 0.94686));
  eot4 = 0.21922 * Math.sin(4.0 * (theta - 0.60716));
  var eotd = average + eot1 + eot2 + eot3 + eot4;
  var eotd_precis = Sunpos();
  return (eotd_precis - eotd);
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// ***********************************************************
// CONVERTS RADIANS TO DEGREES
function degrees(xx) {return (180.0 * xx / Math.PI);}

// ************************************************************
// CONVERTS DEGREES TO RADIANS 
function radians(xx) {return (Math.PI * xx / 180.0);}

// ************************************************************
// GET ECLIPTIC LONGITUDE OF SUN UsinG VSOP THEORY
// BIG FORMULA !
// Reference: Astronomical Algorithms 2nd Edition 1998 by Jean Meeus - Page 166,
// which uses pages 217 - 219 & Appendix III
function Get_Ecliptic_Longitude(TT_cent) {
	var tau = TT_cent / 10.0;
	var L0 = 0 ;
	var L1 = 0 ;
	var L2 = 0 ;
	var L3 = 0 ;
	var L4 = 0 ;
	var L5 = 0 ;
    L0 =      175347046 ;
	L0 = L0 +   3341656 * Math.cos(4.6692568 +   6283.07585 * tau) ;
	L0 = L0 +     34894 * Math.cos(4.6261    +  12566.15170 * tau) ;
	L0 = L0 +      3497 * Math.cos(2.7441    +   5753.38490 * tau) ;
	L0 = L0 +      3418 * Math.cos(2.8289    +      3.52310 * tau) ;
	L0 = L0 +      3136 * Math.cos(3.6277    +  77713.77150 * tau) ;
	L0 = L0 +      2676 * Math.cos(4.4181    +   7860.41940 * tau) ;
	L0 = L0 +      2343 * Math.cos(6.1352    +   3930.20970 * tau) ;
	L0 = L0 +      1324 * Math.cos(0.7425    +  11506.76980 * tau) ;
	L0 = L0 +      1273 * Math.cos(2.0371    +    529.69100 * tau) ;
	L0 = L0 +      1199 * Math.cos(1.1096    +   1577.34350 * tau) ;
	L0 = L0 +       990 * Math.cos(5.233     +   5884.92700 * tau) ;
	L0 = L0 +       902 * Math.cos(2.045     +     26.29800 * tau) ;
	L0 = L0 +       857 * Math.cos(3.508     +    398.14900 * tau) ;
	L0 = L0 +       780 * Math.cos(1.179     +   5223.69400 * tau) ;
	L0 = L0 +       753 * Math.cos(2.533     +   5507.55300 * tau) ;
	L0 = L0 +       505 * Math.cos(4.583     +  18849.22800 * tau) ;
	L0 = L0 +       492 * Math.cos(4.205     +    775.52300 * tau) ;
	L0 = L0 +       357 * Math.cos(2.92      +      0.06700 * tau) ;
	L0 = L0 +       317 * Math.cos(5.849     +  11790.62900 * tau) ;
	L0 = L0 +       284 * Math.cos(1.899     +    796.29800 * tau) ;
	L0 = L0 +       271 * Math.cos(0.315     +  10977.07900 * tau) ;
	L0 = L0 +       243 * Math.cos(0.345     +   5486.77800 * tau) ;
	L0 = L0 +       206 * Math.cos(4.806     +   2544.31400 * tau) ;
	L0 = L0 +       205 * Math.cos(1.869     +   5573.14300 * tau) ;
	L0 = L0 +       202 * Math.cos(2.458     +   6069.77700 * tau) ;
	L0 = L0 +       156 * Math.cos(0.833     +    213.29900 * tau) ;
	L0 = L0 +       132 * Math.cos(3.411     +   2942.46300 * tau) ;
	L0 = L0 +       126 * Math.cos(1.083     +     20.77500 * tau) ;
	L0 = L0 +       115 * Math.cos(0.645     +      0.98000 * tau) ;
	L0 = L0 +       103 * Math.cos(0.636     +   4694.00300 * tau) ;
	L0 = L0 +       102 * Math.cos(0.976     +  15720.83900 * tau) ;
	L0 = L0 +       102 * Math.cos(4.267     +      7.11400 * tau) ;
	L0 = L0 +        99 * Math.cos(6.21      +   2146.17000 * tau) ;
	L0 = L0 +        98 * Math.cos(0.68      +    155.42000 * tau) ;
	L0 = L0 +        86 * Math.cos(5.98      + 161000.69000 * tau) ;
	L0 = L0 +        85 * Math.cos(1.3       +   6275.96000 * tau) ;
	L0 = L0 +        85 * Math.cos(3.67      +  71430.70000 * tau) ;
	L0 = L0 +        80 * Math.cos(1.81      +  17260.15000 * tau) ;
	L0 = L0 +        79 * Math.cos(3.04      +  12036.46000 * tau) ;
	L0 = L0 +        75 * Math.cos(1.76      +   5088.63000 * tau) ;
	L0 = L0 +        74 * Math.cos(3.50      +   3154.69000 * tau) ;
	L0 = L0 +        74 * Math.cos(4.68      +    801.82000 * tau) ;
	L0 = L0 +        70 * Math.cos(0.83      +   9437.76000 * tau) ;
	L0 = L0 +        62 * Math.cos(3.98      +   8827.39000 * tau) ;
	L0 = L0 +        61 * Math.cos(1.82      +   7084.90000 * tau) ;
	L0 = L0 +        57 * Math.cos(2.78      +   6286.60000 * tau) ;
	L0 = L0 +        56 * Math.cos(4.39      +  14143.50000 * tau) ;
	L0 = L0 +        56 * Math.cos(3.47      +   6279.55000 * tau) ;
	L0 = L0 +        52 * Math.cos(0.19      +  12139.55000 * tau) ;
	L0 = L0 +        52 * Math.cos(1.33      +   1748.02000 * tau) ;
	L0 = L0 +        51 * Math.cos(0.28      +   5856.48000 * tau) ;
	L0 = L0 +        49 * Math.cos(0.49      +   1194.45000 * tau) ;
	L0 = L0 +        41 * Math.cos(5.37      +   8429.24000 * tau) ;
	L0 = L0 +        41 * Math.cos(2.40      +  19651.05000 * tau) ;
	L0 = L0 +        39 * Math.cos(6.17      +  10447.39000 * tau) ;
	L0 = L0 +        37 * Math.cos(6.04      +  10213.29000 * tau) ;
	L0 = L0 +        37 * Math.cos(2.57      +   1059.38000 * tau) ;
	L0 = L0 +        36 * Math.cos(1.71      +   2352.87000 * tau) ;
	L0 = L0 +        36 * Math.cos(1.78      +   6812.77000 * tau) ;
	L0 = L0 +        33 * Math.cos(0.59      +  17789.85000 * tau) ;
	L0 = L0 +        30 * Math.cos(0.44      +  83996.85000 * tau) ;
	L0 = L0 +        30 * Math.cos(2.74      +   1349.87000 * tau) ;
	L0 = L0 +        25 * Math.cos(3.16      +   4690.48000 * tau) ;
	
	L1 =   628331966747 ;
	L1 = L1 +    206059 * Math.cos(2.678235  +  6283.07585  * tau) ;
	L1 = L1 +      4303 * Math.cos(2.6351    + 12566.1517   * tau) ;
	L1 = L1 +       425 * Math.cos(1.59      +     3.523    * tau) ;
	L1 = L1 +       119 * Math.cos(5.796     +    26.298    * tau) ;
	L1 = L1 +       109 * Math.cos(2.966     +  1577.344    * tau) ;
	L1 = L1 +        93 * Math.cos(2.59      + 18849.23     * tau) ;
	L1 = L1 +        72 * Math.cos(1.14      +   529.69     * tau) ;
	L1 = L1 +        68 * Math.cos(1.87      +   398.15     * tau) ;
	L1 = L1 +        67 * Math.cos(4.41      +  5507.55     * tau) ;
	L1 = L1 +        59 * Math.cos(2.89      +  5223.69     * tau) ;
	L1 = L1 +        56 * Math.cos(2.17      +   155.42     * tau) ;
	L1 = L1 +        45 * Math.cos(0.40      +   796.3      * tau) ;
	L1 = L1 +        36 * Math.cos(0.47      +   775.52     * tau) ;
	L1 = L1 +        29 * Math.cos(2.65      +     7.11     * tau) ;
	L1 = L1 +        21 * Math.cos(5.34      +     0.98     * tau) ;
	L1 = L1 +        19 * Math.cos(1.85      +  5486.78     * tau) ;
	L1 = L1 +        19 * Math.cos(4.97      +   213.3      * tau) ;
	L1 = L1 +        17 * Math.cos(2.99      +  6275.96     * tau) ;
	L1 = L1 +        16 * Math.cos(0.03      +  2544.31     * tau) ;
	L1 = L1 +        16 * Math.cos(1.43      +  2146.17     * tau) ;
	L1 = L1 +        15 * Math.cos(1.21      + 10977.08     * tau) ;
	L1 = L1 +        12 * Math.cos(2.83      + 1748.02      * tau) ;
	L1 = L1 +        12 * Math.cos(3.26      + 5088.63      * tau) ;
	L1 = L1 +        12 * Math.cos(5.27      + 1194.45      * tau) ;
	L1 = L1 +        12 * Math.cos(2.08      + 4694         * tau) ;
	L1 = L1 +        11 * Math.cos(0.77      + 553.57       * tau) ;
	L1 = L1 +        10 * Math.cos(1.30      + 6286.6       * tau) ;
	L1 = L1 +        10 * Math.cos(4.24      + 1349.87      * tau) ;
	L1 = L1 +         9 * Math.cos(2.70      + 242.73       * tau) ;
	L1 = L1 +         9 * Math.cos(5.64      + 951.72       * tau) ;
	L1 = L1 +         8 * Math.cos(5.30      + 2352.87      * tau) ;
	L1 = L1 +         6 * Math.cos(2.65      + 9437.76      * tau) ;
	L1 = L1 +         6 * Math.cos(4.67      + 4690.48      * tau) ;

	L2 =          52919 ;
	L2 = L2 +      8720  * Math.cos(1.0721   + 6283.0758    * tau) ;
	L2 = L2 +       309  * Math.cos(0.867    + 12566.152    * tau) ;
	L2 = L2 +        27  * Math.cos(0.05     +       3.52   * tau) ;
	L2 = L2 +        16  * Math.cos(5.19     +      26.3    * tau) ;
	L2 = L2 +        16  * Math.cos(3.68     +     155.42   * tau) ;
	L2 = L2 +        10  * Math.cos(0.76     +   18849.23   * tau) ;
	L2 = L2 +         9  * Math.cos(2.06     +   77713.77   * tau) ;
	L2 = L2 +         7  * Math.cos(0.83     +     775.52   * tau) ;
	L2 = L2 +         5  * Math.cos(4.66     +    1577.34   * tau) ;
	L2 = L2 +         4  * Math.cos(1.03     +       7.11   * tau) ;
	L2 = L2 +         4  * Math.cos(3.44     +    5573.14   * tau) ;
	L2 = L2 +         3  * Math.cos(5.14     +     796.3    * tau) ;
	L2 = L2 +         3  * Math.cos(6.05     +    5507.55   * tau) ;
	L2 = L2 +         3  * Math.cos(1.19     +     242.73   * tau) ;
	L2 = L2 +         3  * Math.cos(6.12     +     529.69   * tau) ;
	L2 = L2 +         3  * Math.cos(0.31     +     398.15   * tau) ;
	L2 = L2 +         3  * Math.cos(2.28     +     553.57   * tau) ;
	L2 = L2 +         2  * Math.cos(4.38     +    5223.69   * tau) ;
	L2 = L2 +         2  * Math.cos(3.75     +       0.98   * tau) ; 

	L3 =            289  * Math.cos(5.844    +  6283.076    * tau) ;
	L3 = L3 +        35  * Math.cos(0        +       0      * tau) ;
	L3 = L3 +        17  * Math.cos(5.49     + 12566.15     * tau) ;
	L3 = L3 +         3  * Math.cos(5.2      +   155.42     * tau) ;
	L3 = L3 +         1  * Math.cos(4.72     +     3.52     * tau) ;
	L3 = L3 +         1  * Math.cos(5.3      + 18849.23     * tau) ;
	L3 = L3 +         1  * Math.cos(5.97     +   242.73     * tau) ; 

	L4 =            114  * Math.cos(3.142    +       0      * tau) ;
	L4 = L4 +         8  * Math.cos(4.13     +  6283.08     * tau) ;
	L4 = L4 +         1  * Math.cos(3.84     + 12566.15     * tau) ; 

	L5 =              1  * Math.cos(3.14     +       0      * tau) ;

	var XX = (L0 + tau * (L1 + tau * (L2 + tau * (L3 + tau * (L4 + tau * L5))))) / 100000000;
	var Longitude_Ecliptic_VSOP_deg = (degrees(XX) + 180) % 360;
	return Longitude_Ecliptic_VSOP_deg ;
}

//  ***************************************************************************************************
// GET ECLIPTIC LATITUDE OF SUN UsinG VSOP THEORY
// FAIRLY BIG FORMULA !
// Reference: Astronomical Algorithms 2nd Edition 1998 by Jean Meeus - Page 166,
// which uses pages 217 - 219 & Appendix III
function Get_Ecliptic_Latitude(TT_cent){	
	var tau = TT_cent / 10.0 ;	
	var B0 = 0 ;
	var B1 = 0 ;
	B0 =      280 * Math.cos(3.199 + 84334.662 * tau) ;
	B0 = B0 + 102 * Math.cos(5.422 +  5507.553 * tau) ;
	B0 = B0 + 80  * Math.cos(3.88  +  5223.69  * tau) ;
	B0 = B0 + 44  * Math.cos(3.7   +  2352.87  * tau) ;
	B0 = B0 + 32  * Math.cos(4     +  1577.34  * tau) ;
	B1 = B1 + 9   * Math.cos(3.9   +  5507.55  * tau) ;
	B1 = B1 + 6   * Math.cos(1.73  +  5223.69  * tau) ;

	var XX = (B0 + tau * B1) / 100000000 ;
	var Latitude_Ecliptic_VSOP_deg = -degrees(XX) ;
	return Latitude_Ecliptic_VSOP_deg;
}

// ***************************************************************************************************
// GET DISTANCE FROM EARTH TO SUN
// BIG FORMULA !
// Reference: Astronomical Algorithms 2nd Edition 1998 by Jean Meeus - Page 166,
// which uses pages 217 - 219 & Appendix III
function Get_Radius_Vector(TT_cent) {
	var tau = TT_cent / 10.0 ;
	var R0 = 0 ;
	var R1 = 0 ;
	var R2 = 0 ;
	var R3 = 0 ;
	var R4 = 0 ;
	R0 =      100013989 ;
	R0 = R0 +   1670700   * Math.cos(3.0984635 +  6283.07585  * tau) ;
	R0 = R0 +     13956   * Math.cos(3.05525   + 12566.1517   * tau) ;
	R0 = R0 +      3084   * Math.cos(5.1985    + 77713.7715   * tau) ;
	R0 = R0 +      1628   * Math.cos(1.1739    +  5753.3849   * tau) ;
	R0 = R0 +      1576   * Math.cos(2.8469    +  7860.4194   * tau) ;
	R0 = R0 +       925   * Math.cos(5.453     +  11506.77    * tau) ;
	R0 = R0 +       542   * Math.cos(4.564     +   3930.21    * tau) ;
	R0 = R0 +       472   * Math.cos(3.661     +   5884.927   * tau) ;
	R0 = R0 +       346   * Math.cos(0.964     +   5507.553   * tau) ;
	R0 = R0 +       329   * Math.cos(5.9       +   5223.694   * tau) ;
	R0 = R0 +       307   * Math.cos(0.299     +   5573.143   * tau) ;
	R0 = R0 +       243   * Math.cos(4.273     +  11790.629   * tau) ;
	R0 = R0 +       212   * Math.cos(5.847     +   1577.344   * tau) ;
	R0 = R0 +       186   * Math.cos(5.022     +  10977.079   * tau) ;
	R0 = R0 +       175   * Math.cos(3.012     +  18849.228   * tau) ;
	R0 = R0 +       110   * Math.cos(5.055     +   5486.778   * tau) ;
	R0 = R0 +        98   * Math.cos(0.89      +   6069.78    * tau) ;
	R0 = R0 +        86   * Math.cos(5.69      +  15720.84    * tau) ;
	R0 = R0 +        86   * Math.cos(1.27      + 161000.69    * tau) ;
	R0 = R0 +        65   * Math.cos(0.27      +  17260.15    * tau) ;
	R0 = R0 +        63   * Math.cos(0.92      +    529.69    * tau) ;
	R0 = R0 +        57   * Math.cos(2.01      +  83996.85    * tau) ;
	R0 = R0 +        56   * Math.cos(5.24      +  71430.7     * tau) ;
	R0 = R0 +        49   * Math.cos(3.25      +   2544.31    * tau) ;
	R0 = R0 +        47   * Math.cos(2.58      +    775.52    * tau) ;
	R0 = R0 +        45   * Math.cos(5.54      +    9437.76   * tau) ;
	R0 = R0 +        43   * Math.cos(6.01      +    6275.96   * tau) ;
	R0 = R0 +        39   * Math.cos(5.36      +    4694.0    * tau) ;
	R0 = R0 +        38   * Math.cos(2.39      +    8827.39   * tau) ;
	R0 = R0 +        37   * Math.cos(0.83      +   19651.05   * tau) ;
	R0 = R0 +        37   * Math.cos(4.9       +   12139.55   * tau) ;
	R0 = R0 +        36   * Math.cos(1.67      +   12036.46   * tau) ;
	R0 = R0 +        35   * Math.cos(1.84      +    2942.46   * tau) ;
	R0 = R0 +        33   * Math.cos(0.24      +    7084.9    * tau) ;
	R0 = R0 +        32   * Math.cos(0.18      +    5088.63   * tau) ;
	R0 = R0 +        32   * Math.cos(1.78      +     398.15   * tau) ;
	R0 = R0 +        28   * Math.cos(1.21      +    6286.6    * tau) ;
	R0 = R0 +        28   * Math.cos(1.9       +    6279.55   * tau) ;
	R0 = R0 +        26   * Math.cos(4.59      +   10447.39   * tau) ;
	
	R1 =         103019   * Math.cos(1.10749   +   6283.07585 * tau) ;
	R1 = R1 +      1721   * Math.cos(1.0644    +  12566.1517  * tau) ;
	R1 = R1 +       702   * Math.cos(3.142     +      0.0      * tau) ;
	R1 = R1 +        32   * Math.cos(1.02      +  18849.23    * tau) ;
	R1 = R1 +        31   * Math.cos(2.84      +   5507.55    * tau) ;
	R1 = R1 +        25   * Math.cos(1.32      +   5223.69    * tau) ;
	R1 = R1 +        18   * Math.cos(1.42      +   1577.34    * tau) ;
	R1 = R1 +        10   * Math.cos(5.91      +  10977.08    * tau) ;
	R1 = R1 +         9   * Math.cos(1.42      +   6275.96    * tau) ;
	R1 = R1 +         9   * Math.cos(0.27      +   5486.78    * tau) ;

	R2 =           4359   * Math.cos(5.7846    +   6283.0758  * tau) ;
	R2 = R2 +       124   * Math.cos(5.579     +  12566.152   * tau) ;
	R2 = R2 +        12   * Math.cos(3.14      +      0       * tau) ;
	R2 = R2 +         9   * Math.cos(3.63      +  77713.77    * tau) ;
	R2 = R2 +         6   * Math.cos(1.87      +   5573.14    * tau) ;
	R2 = R2 +         3   * Math.cos(5.47      +  18849.23    * tau) ;

	R3 =            145   * Math.cos(4.273     +   6283.076   * tau) ;
	R3 = R3 +         7   * Math.cos(3.92      +  12566.15    * tau) ;

	R4 =              4   * Math.cos(2.56      +   6283.08    * tau) ;

	var Radius_Vector_AU = (R0 + tau * (R1 + tau * (R2 + tau * (R3 + tau * R4)))) / 100000000;
	return Radius_Vector_AU;
}

// ***************************************************************************************************
// GET NUTATION IN LONGITUDE CORRECTION
// BIG FORMULA !
// Reference: Astronomical Algorithms 2nd Edition 1998 by Jean Meeus - Page 143 - 145
// Output is Nutation in Longitude in Seconds of Arc
// T is Centuries from Epoch J2000.0
// MEM is Mean Elongation of Moon from Sun
// MAS is Mean Anomaly of Sun (w.r.t Earth) ;
// MAM is Mean Anomaly of Moon
// MAS is Moon//s Argument of Latitude
// LAN is Longitude of Ascending Node of Moon
function Get_Nutation_in_Longitude(TT_Cent) {	
	var T = TT_Cent ;
	var MEM = radians(297.85036 + T * (445267.11148  + T * (-0.0019142 + T / 189474))) ;
	var MAS = radians(357.52772 + T * (35999.05034   + T * (-0.0001603 - T / 300000))) ;
	var MAM = radians(134.96298 + T * (477198.867398 + T * (0.0086972  + T / 56250))) ;
	var MAL = radians(93.27191  + T * (483202.017538 + T * (-0.0036825 + T / 327270))) ;
	var LAN = radians(125.04452 + T * (-1934.136261  + T * (0.0020708  + T / 450000))) ;

	var Nut_in_Long_deg = 0 ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-171996 - 174.2 * T) * Math.sin(LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-13187 - 1.6 * T)    * Math.sin(-2 * MEM + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-2274 - 0.2 * T)     * Math.sin(2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (2062 + 0.2 * T)      * Math.sin(2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (1426 - 3.4 * T)      * Math.sin(MAS) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (712 + 0.1 * T)       * Math.sin(MAM) ;

	Nut_in_Long_deg = Nut_in_Long_deg + (-517 + 1.2 * T)      * Math.sin(-2 * MEM + MAS + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-386 - 0.4 * T)      * Math.sin(2 * MAL + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-301)                * Math.sin(MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (217 - 0.5 * T)       * Math.sin(-2 * MEM - MAS + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-158)                * Math.sin(-2 * MEM + MAM) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (129 + 0.1 * T)       * Math.sin(-2 * MEM + 2 * MAL + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (123)                 * Math.sin(-MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (63)                  * Math.sin(2 * MEM) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (63 + 0.1 * T)        * Math.sin(MAM + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-59)                 * Math.sin(2 * MEM - MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-58 - 0.1 * T)       * Math.sin(-MAM + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-51)                 * Math.sin(MAM + 2 * MAL + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (48)                  * Math.sin(-2 * MEM + 2 * MAM) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (46)                  * Math.sin(-2 * MAM + 2 * MAL + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-38)                 * Math.sin(2 * MEM + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-31)                 * Math.sin(2 * MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (29)                  * Math.sin(2 * MAM) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (29)                  * Math.sin(-2 * MEM + MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (26)                  * Math.sin(2 * MAL) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-22)                 * Math.sin(-2 * MEM + 2 * MAL) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (21)                  * Math.sin(-MAM + 2 * MAL + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (17 - 0.1 * T)        * Math.sin(2 * MAS) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (16)                  * Math.sin(2 * MEM - MAM + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-16 + 0.1 * T)       * Math.sin(-2 * MEM + 2 * MAS + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-15)                 * Math.sin(MAS + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-13)                 * Math.sin(-2 * MEM + MAM + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-12)                 * Math.sin(-MAS + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (11)                  * Math.sin(2 * MAM - 2 * MAL) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-10)                 * Math.sin(2 * MEM - MAM + 2 * MAL + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-8)                  * Math.sin(2 * MEM + MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (7)                   * Math.sin(MAS + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-7)                  * Math.sin(-2 * MEM + MAS + MAM) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-7)                  * Math.sin(-MAS + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-7)                  * Math.sin(2 * MEM + 2 * MAL + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (6)                   * Math.sin(2 * MEM + MAM) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (6)                   * Math.sin(-2 * MEM + 2 * MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (6)                   * Math.sin(-2 * MEM + MAM + 2 * MAL + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-6)                  * Math.sin(2 * MEM - 2 * MAM + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-6)                  * Math.sin(2 * MEM + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (5)                   * Math.sin(-MAS + MAM) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-5)                  * Math.sin(-2 * MEM - MAS + 2 * MAL + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-5)                  * Math.sin(-2 * MEM + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-5)                  * Math.sin(2 * MAM + 2 * MAL + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (4)                   * Math.sin(-2 * MEM + 2 * MAM + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (4)                   * Math.sin(-2 * MEM + MAS + 2 * MAL + LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (4)                   * Math.sin(MAM - 2 * MAL) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-4)                  * Math.sin(-MEM + MAM) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-4)                  * Math.sin(-2 * MEM + MAS) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-4)                  * Math.sin(MEM) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (3)                   * Math.sin(MAM + 2 * MAL) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-3)                  * Math.sin(-2 * MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-3)                  * Math.sin(-MEM - MAS + MAM) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-3)                  * Math.sin(MAS + MAM) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-3)                  * Math.sin(-MAS + MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-3)                  * Math.sin(2 * MEM - MAS - MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-3)                  * Math.sin(3 * MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Long_deg = Nut_in_Long_deg + (-3)                  * Math.sin(2 * MEM - MAS + 2 * MAL + 2 * LAN) ;

	Nut_in_Long_deg = Nut_in_Long_deg * 0.0001 / 3600.0 ;
	return Nut_in_Long_deg ;
}

// ***************************************************************************************************
// GET NUTATION IN OBLIQUITY CORRECTION
// BIG FORMULA !
// Reference: Astronomical Algorithms 2nd Edition 1998 by Jean Meeus - Page 143 - 145
function Get_Nutation_in_Obliquity(TT_Cent) {
	var T = TT_Cent ;	
	var MEM = radians(297.85036 + T * (445267.11148  + T * (-0.0019142 + T / 189474))) ;
	var MAS = radians(357.52772 + T * (35999.05034   + T * (-0.0001603 - T / 300000))) ;
	var MAM = radians(134.96298 + T * (477198.867398 + T * ( 0.0086972 + T /  56250))) ;
	var MAL = radians( 93.27191 + T * (483202.017538 + T * (-0.0036825 + T / 327270))) ;
	var LAN = radians(125.04452 + T * (-1934.136261  + T * ( 0.0020708 + T / 450000))) ;

	var Nut_in_Obl_deg = 0 ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (92025 + 8.9 * T) * Math.cos(                         LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + ( 5736 - 3.1 * T) * Math.cos(-2 * MEM + 2 * MAL + 2 * LAN) ;

	Nut_in_Obl_deg = Nut_in_Obl_deg + (  977 - 0.5 * T) * Math.cos(           2 * MAL + 2 * LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (- 895 + 0.5 * T) * Math.cos(                     2 * LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (   54 - 0.1 * T) * Math.cos(MAS) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (-  7)            * Math.cos(MAM) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (  224 - 0.6 * T) * Math.cos(-2 * MEM + MAS + 2 * MAL + 2 * LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (  200)           * Math.cos(2 * MAL + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (  129 - 0.1 * T) * Math.cos(MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (-  95 + 0.3 * T) * Math.cos(-2 * MEM - MAS + 2 * MAL + 2 * LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (-  70)           * Math.cos(-2 * MEM + 2 * MAL + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (-  53)           * Math.cos(-MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (-  33)           * Math.cos(MAM + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (   26)           * Math.cos(2 * MEM - MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (   32)           * Math.cos(-MAM + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (   27)           * Math.cos(MAM + 2 * MAL + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (-  24)           * Math.cos(-2 * MAM + 2 * MAL + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (   16)           * Math.cos(2 * MEM + 2 * MAL + 2 * LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (   13)           * Math.cos(2 * MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (-  12)           * Math.cos(-2 * MEM + MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (-10)             * Math.cos(-MAM + 2 * MAL + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (-8)              * Math.cos(2 * MEM - MAM + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (7)               * Math.cos(-2 * MEM + 2 * MAS + 2 * MAL + 2 * LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (9)               * Math.cos(MAS + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (7)               * Math.cos(-2 * MEM + MAM + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (6)               * Math.cos(-MAS + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (5)               * Math.cos(2 * MEM - MAM + 2 * MAL + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (3)               * Math.cos(2 * MEM + MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (-3)              * Math.cos(MAS + 2 * MAL + 2 * LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (3)               * Math.cos(-MAS + 2 * MAL + 2 * LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (3)               * Math.cos(2 * MEM + 2 * MAL + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (-3)              * Math.cos(-2 * MEM + 2 * MAM + 2 * MAL + 2 * LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (-3)              * Math.cos(-2 * MEM + MAM + 2 * MAL + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (3)               * Math.cos(2 * MEM - 2 * MAM + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (3)               * Math.cos(2 * MEM + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (3)               * Math.cos(-2 * MEM - MAS + 2 * MAL + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (3)               * Math.cos(-2 * MEM + LAN) ;
	Nut_in_Obl_deg = Nut_in_Obl_deg + (3)               * Math.cos(2 * MAM + 2 * MAL + LAN) ;
		
	Nut_in_Obl_deg = Nut_in_Obl_deg * 0.0001 / 3600 ;
	return Nut_in_Obl_deg ;
}

// ***************************************************************************************************
// GET SOLAR RIGHT ASCENSION, DECLINATION, EQUATION OF TIME, ALTITUDE, AZIMUTH & 
// LOCAL HOUR ANGLE AS A FUNCTION OF LOVAL CIVIL TIME AND GEOGRAPHICAL POSITION
// Reference: Astronomical Algorithms 2nd Edition 1998 by Jean Meeus
//function Sunpos(Topo_Long,Topo_Lat,Zone,Height,Dst,Pressure,Temperature,Dut1,Year,Month,Day,Hour,Minute,Second)
function Sunpos()
{	
  var Topo_Lat        = latitude;
  var Topo_Long       = longitude;
	var Local_hrs       = (new Date().getHours() * 3600) + (new Date().getMinutes() * 60) + (new Date().getSeconds());
	var UTC_hrs         = Local_hrs + (new Date().getTimezoneOffset()*60) ;
	var UT1_hrs         = UTC_hrs / 3600.0;
	var UT1_deg         = UT1_hrs * 15.0 ;
  var Day             = new Date().getDate();
	var Month           = new Date().getMonth()+1;
  var Year            = new Date().getFullYear();
	if (Month <= 2) { Year        -= 1 ; Month       += 12 ;}
	var A                    = Math.floor(Year/100) ;
	var B                    = 2 - A + Math.floor(A/4) ;
	var JD_Date              = Math.floor(365.25*(Year + 4716)) + Math.floor(30.6001*(Month+1)) + Day + B - 1524.5 ;
	var JD_days              = JD_Date + UT1_hrs / 24.0 ;

	var tau                      = (JD_days - 2451545) / 36525 ;
    var Del_T_sec ;
	if   (tau < 0.05) 
    { Del_T_sec              = ((- 624.197 * tau - 186.451)  * tau +  27.384) * tau + 63.837 ;}
	else if (tau < 0.10) 
    { Del_T_sec              = ((-7277.152 * tau + 1756.476) * tau - 108.618) * tau + 66.637 ;}
	else if (tau < 0.15) 
    { Del_T_sec              = ((-8614.842 * tau + 3574.448) * tau - 441.389) * tau + 83.073 ;}
	else if (tau < 0.20) 
    { Del_T_sec              = ((-8386.677 * tau + 4245.182) * tau - 659.939) * tau + 99.801 ;}
	else           
    { Del_T_sec              = (     2.162                   * tau +  44.874) * tau + 61.749 ;}

	var JD_TT_days           = JD_days + Del_T_sec/24/3600.0 ;
	var TT_cent              = (JD_TT_days - 2451545)/36525.0 ;
	var Sol_Long_V_deg       = Get_Ecliptic_Longitude   (TT_cent) ;
	var Sol_Lat_V_deg        = Get_Ecliptic_Latitude    (TT_cent) ;
	var Sol_Radius_AU        = Get_Radius_Vector        (TT_cent) ;
	var Nut_in_Long_deg      = Get_Nutation_in_Longitude(TT_cent) ;
	var Nut_in_Obl_deg       = Get_Nutation_in_Obliquity(TT_cent) ;

	// ***************************************************************************************************
	// GET MEAN OBLIQUITY OF ECLIPTIC
	// Reference: Astronomical Algorithms 2nd Edition 1998 by Jean Meeus - Page 147
	var tau00                = TT_cent/100 ;
	var Obliquity_Base       = 23.0 + 260.0 / 600.0 + 21.448 / 3600.0 ;
	var deli                 = (tau00 * (-4680.93 + tau00 * ( -1.55 + tau00 * (1999.25 + tau00 * (-51.38 + tau00 * ( -249.67 + tau00 * (-39.05 + tau00 * (   7.12 + tau00 * (  5.79 + tau00 * (   27.87 + tau00 *    2.45)))))))))) ;
	var Obl_Mean_deg         = Obliquity_Base + deli / 3600 ;
	
	//***************************************************************************************************
	// Convert from VSOP >> FK5
	// Reference: Astronomical Algorithms 2nd Edition 1998 by Jean Meeus - Page 219 Equ 32.3
    var Lambda_Dash_rad      = radians(Sol_Long_V_deg - 1.397 * TT_cent - 0.00031 * UT1_hrs * UT1_hrs) ;
	var Long_Corr            = (-0.09033 + 0.03916 * (Math.cos(Lambda_Dash_rad) + Math.sin(Lambda_Dash_rad)) * Math.tan(radians(Sol_Lat_V_deg))) / 3600.0 ;
	var Lat_Corr             = (           0.03916 * (Math.cos(Lambda_Dash_rad) - Math.sin(Lambda_Dash_rad))                                   ) / 3600.0 ;
	var Sol_Long_F_deg       = Sol_Long_V_deg + Long_Corr ;
	var Sol_Lat_F_deg        = Sol_Lat_V_deg  + Lat_Corr ;
		
	// Correct for Nutation & Aberation_deg
	var Obl_True_deg         = Obl_Mean_deg + Nut_in_Obl_deg ;	
	var Aberation_deg        = -20.4898 / Sol_Radius_AU /3600.0 ;
	var Sol_Long_Appt_deg    = Sol_Long_F_deg + Nut_in_Long_deg + Aberation_deg ;

	// Convert >> Radians
	var Sol_Long_rad         = radians(Sol_Long_Appt_deg) ;
	var Sol_Lat_rad          = radians(Sol_Lat_F_deg) ;
	var Obl_rad              = radians(Obl_True_deg) ;

	// Convert Longitude & Latitude >> RA & Declination
	var RA_denom             = Math.sin(Sol_Long_rad) * Math.cos(Obl_rad) - Math.tan(Sol_Lat_rad) * Math.sin(Obl_rad) ;
	var RA_num               = Math.cos(Sol_Long_rad) ;
	var RA_rad               = Math.atan2(RA_denom,RA_num) ;
	var Decl_rad             = Math.asin(Math.sin(Sol_Lat_rad) * Math.cos(Obl_rad) + Math.cos(Sol_Lat_rad) * Math.sin(Obl_rad) * Math.sin(Sol_Long_rad)) ;

	// Convert >> Degrees & hours
	var RA_deg               = (360.0 + degrees(RA_rad)) % 360.0 ;
//	var RA_hrs               = RA_deg / 15.0 ;
//	var Decl_deg             = degrees(Decl_rad) ;
    
    // ***************************************************************************************************
	// Calculate Greenwich Mean Sidereal Time
	// Reference: USNO Circular 179 by G.H. Kaplan
	//            The IAU Resolutions on Astronomical Reference Systems, Time Scales, 
	//            and Earth Rotation Models - Eqns 2.11 & 2.12
	var DU                   = JD_days  - 2451545.0 ;
	var Theta                = 0.7790572732640 + 0.00273781191135448 * DU + JD_days % 1 ;
	var GMST_base            = (86400.0 * Theta)  % 86400.0 ;
	var Extra                = 0.014506 + TT_cent * (4612.156534 + TT_cent * (1.3915817 + TT_cent * (-0.00000044 + TT_cent * (-0.000029956 - TT_cent * 0.0000000368)))) ;
	var GMST_hrs             = ((GMST_base + Extra / 15.0) % 86400.0)/3600.0  ;
	var GMST_deg             = 15.0 * GMST_hrs ;
	
	// ***************************************************************************************************
	// Calculate Equation of the Equinoxs & Greenwich Apparent Sidereal Time
	// Reference: Astronomical Algorithms 2nd Edition 1998 by Jean Meeus - Page 88
	var Eqn_of_Equi_deg      = Nut_in_Long_deg * Math.cos(Obl_rad) ;
	var GAST_deg             = GMST_hrs * 15.0 + Eqn_of_Equi_deg ;
//	var GAST_hrs             = GAST_deg / 15.0 ;
	
	// ***************************************************************************************************
	// Calculate Geocentric Equation of Time
	var EoT_deg              = (GMST_deg - UT1_deg - RA_deg + 180.0 + Eqn_of_Equi_deg ) ;
	if (EoT_deg > 180)         {EoT_deg = EoT_deg - 360.0;}
//	var EoT_min              = EoT_deg * 4.0 ;

	// ***************************************************************************************************
	// Local Apparent Siderial Time and Hour Angle
	// Reference: Astronomical Algorithms 2nd Edition 1998 by Jean Meeus - Page 92
	var LAST_deg             = GAST_deg + Topo_Long ;
	var HA_deg               = (LAST_deg - RA_deg) % 360.0 ;
	if (HA_deg > 180)          { HA_deg = HA_deg - 360.0 ; }
	var HA_rad               = radians(HA_deg) ;

	// ***************************************************************************************************
	// Calculate Parallax Correction Parameters
	// Reference: Astronomical Algorithms 2nd Edition 1998 by Jean Meeus - Page 82 & 279
	var Topo_Lat_rad         = radians(Topo_Lat) ;
	var tanu                 = 0.99664719 * Math.tan(Topo_Lat_rad) ;
	var u                    = Math.atan(tanu) ;
  //var Rho_sin_Phi_         = 0.99664719 * Math.sin(u) + Math.sin(Topo_Lat_rad) * Height / 6378140 ;
	var Rho_sin_Phi_         = 0.99664719 * Math.sin(u) + Math.sin(Topo_Lat_rad) * 500 / 6378140 ;
	if (Topo_Lat_rad < 0)      {Rho_sin_Phi_ = -Rho_sin_Phi_;} 
  //var Rho_cos_Phi_         = Math.cos(u) + Math.cos(Topo_Lat_rad) * Height / 6378140 ;
	var Rho_cos_Phi_         = Math.cos(u) + Math.cos(Topo_Lat_rad) * 500 / 6378140 ;
	var sin_Pi_              = 3.14159265358979 * 8.794 / Sol_Radius_AU / 180 / 3600 ;

	// ***************************************************************************************************
	// Convert Geocentric RA >> Topocentric RA
	// Reference: Astronomical Algorithms 2nd Edition 1998 by Jean Meeus - Page 279
	var tan_Del_RA           = (-Rho_cos_Phi_ * sin_Pi_ * Math.sin(HA_rad)) / (Math.cos(Decl_rad) - Rho_cos_Phi_ * sin_Pi_ * Math.cos(HA_rad)) ;
	var RA_Parallax_rad      = Math.atan(tan_Del_RA) ;
	var Topo_RA_deg          = (RA_deg + degrees(RA_Parallax_rad)) % 360 ;
//	var Topo_RA_hrs          = Topo_RA_deg / 15.0 ;

	// ***************************************************************************************************
	// Convert Geocentric Declination >> Topocentric Declination
	// Reference: Astronomical Algorithms 2nd Edition 1998 by Jean Meeus - Page 279
	var tan_dec1             = (Math.sin(Decl_rad) - Rho_sin_Phi_ * sin_Pi_) * Math.cos(RA_Parallax_rad) ;
	var tan_dec2             = (Math.cos(Decl_rad) - Rho_cos_Phi_ * sin_Pi_ * Math.cos(HA_rad)) ;
	var Topo_Decl_rad        = Math.atan(tan_dec1 / tan_dec2) ;
//	var Topo_Decl_deg        = degrees(Topo_Decl_rad) ;

	// ***************************************************************************************************
	// Calculate Topocentric Equation of Time
	var Topo_EoT_deg         = (GAST_deg - UT1_deg - Topo_RA_deg + 180.0 ) % 360.0  ;
	if (Topo_EoT_deg > 180.0) {Topo_EoT_deg = Topo_EoT_deg - 360.0;}
	var Topo_EoT_min         = Topo_EoT_deg * 4.0 ;
//	var Sol_to_Civil_min     = -Topo_EoT_min + Zone * 60.0 - Topo_Long * 4.0 + Dst * 60.0 ;

	// ***************************************************************************************************
	//Calculate Topocentric Hour Angle
		var Topo_HA_deg          = (LAST_deg - Topo_RA_deg) % 360.0 ;
//		var Topo_HA_hrs          = Topo_HA_deg / 15.0 ;
		if (Topo_HA_deg > 180)     { Topo_HA_deg = Topo_HA_deg - 360.0;} 
		var Topo_HA_rad          = radians(Topo_HA_deg) ;

	// ***************************************************************************************************
	//Convert Hour Angle, Latitude & Declination to Solar Azimuth & Altitude
	//Reference: Astronomical Algorithms 2nd Edition 1998 by Jean Meeus - Page 93
		var Alt_rad              = Math.asin(Math.sin(Topo_Lat_rad) * Math.sin(Topo_Decl_rad) + Math.cos(Topo_Lat_rad) * Math.cos(Topo_Decl_rad) * Math.cos(Topo_HA_rad)) ;
//		var Alt_Airless_deg      = degrees(Alt_rad) ;
//		var Zenith_deg           = 90.0 - Alt_Airless_deg ;

		var cos_Azim             = ( Math.sin(Topo_Decl_rad) - Math.sin(Alt_rad) * Math.sin(Topo_Lat_rad) ) / ( Math.cos(Alt_rad) * Math.cos(Topo_Lat_rad)) ;
		var sin_Azim             = - Math.cos(Topo_Decl_rad) * Math.sin(Topo_HA_rad)                        /   Math.cos(Alt_rad) ;
		var Azim_rad             = Math.atan2(sin_Azim, cos_Azim) ;
		var Azim_deg             = degrees(Azim_rad) % 360 ;
		if (Azim_deg < 0) {Azim_deg = Azim_deg + 360.0;}
	
	// ***************************************************************************************************
	//GET REFRACTION CORRECTION
	//Reference: Astronomical Algorithms 2nd Edition 1998 by Jean Meeus - Page 106 - 107
//		var refr                 = (1.02 / Math.tan(radians(Alt_Airless_deg + 10.3 / (Alt_Airless_deg + 5.11)))) / 60.0 ;
//		var Refraction_deg       = refr * Pressure * 283 / (Pressure * (273 + Temperature)) ;
//		if (Alt_Airless_deg > 89) {Refraction_deg = 0;}

	// ***************************************************************************************************
	//GET REFRACTION CORRECTED ALTITUDE OF SUN
	//Reference: Astronomical Algorithms 2nd Edition 1998 by Jean Meeus - Page 105
//		var Alt_Refrac_deg       = Alt_Airless_deg + Refraction_deg ;
//		if (Alt_Refrac_deg < 0)    {Alt_Refrac_deg = 9999.0 ;}
  return Topo_EoT_min;
}