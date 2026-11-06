const RAD = Math.PI / 180;
const sin = degrees => Math.sin(degrees * RAD);
const cos = degrees => Math.cos(degrees * RAD);
const wrap = degrees => ((degrees % 360) + 360) % 360;
const dot = (a,b) => a.reduce((sum,value,i) => sum + value*b[i],0);

function horizon(longitude, latitude, tilt, sidereal, observerLatitude, distance = Infinity){
  const x=cos(longitude)*cos(latitude), y=sin(longitude)*cos(latitude), z=sin(latitude);
  const equatorialY=y*cos(tilt)-z*sin(tilt), equatorialZ=y*sin(tilt)+z*cos(tilt);
  const meridian=x*cos(sidereal)+equatorialY*sin(sidereal);
  // Scene axes are east (+X), up (+Y) and south (+Z).
  const east=equatorialY*cos(sidereal)-x*sin(sidereal);
  const up=meridian*cos(observerLatitude)+equatorialZ*sin(observerLatitude)-1/distance;
  const south=meridian*sin(observerLatitude)-equatorialZ*cos(observerLatitude);
  const length=Math.hypot(east,up,south);
  return {direction:[east/length,up/length,south/length],altitude:Math.atan2(up,Math.hypot(east,south))};
}

export function celestialAt(date, location){
  // Use the device's local-time meridian and a mid-latitude sky until coordinates are available.
  const {latitude,longitude}=location??{latitude:35,longitude:-date.getTimezoneOffset()/4};
  const j2000=date.getTime()/86400000-10957.5;
  const sidereal=wrap(280.46061837+360.98564736629*j2000+longitude);
  // USNO approximate solar coordinates: https://aa.usno.navy.mil/faq/sun_approx
  const solarAnomaly=wrap(357.529+.98560028*j2000);
  const sunLongitude=wrap(280.459+.98564736*j2000+1.915*sin(solarAnomaly)+.020*sin(2*solarAnomaly));
  const tilt=23.439-.00000036*j2000;
  const sun=horizon(sunLongitude,0,tilt,sidereal,latitude);

  // Lunar orbital elements and dominant perturbations from Schlyter's low-precision model.
  // https://www.stjarnhimlen.se/comp/ppcomp.html
  const d=j2000+1.5, node=wrap(125.1228-.0529538083*d), periapsis=wrap(318.0634+.1643573223*d);
  const anomaly=wrap(115.3654+13.0649929509*d), eccentricity=.0549, inclination=5.1454;
  const eccentricAnomaly=anomaly*RAD+eccentricity*sin(anomaly)*(1+eccentricity*cos(anomaly));
  const x=Math.cos(eccentricAnomaly)-eccentricity, y=Math.sqrt(1-eccentricity**2)*Math.sin(eccentricAnomaly);
  const argument=Math.atan2(y,x)/RAD+periapsis;
  const distance=60.2666*Math.hypot(x,y);
  const meanLongitude=node+periapsis+anomaly, elongation=meanLongitude-(280.459+.98564736*j2000);
  const latitudeArgument=meanLongitude-node;
  const moonLongitude=node+Math.atan2(sin(argument)*cos(inclination),cos(argument))/RAD
    -1.274*sin(anomaly-2*elongation)+.658*sin(2*elongation)-.186*sin(solarAnomaly)
    -.059*sin(2*anomaly-2*elongation)-.057*sin(anomaly-2*elongation+solarAnomaly)
    +.053*sin(anomaly+2*elongation)+.046*sin(2*elongation-solarAnomaly);
  const moonLatitude=Math.asin(sin(argument)*sin(inclination))/RAD
    -.173*sin(latitudeArgument-2*elongation)-.055*sin(anomaly-latitudeArgument-2*elongation)
    -.046*sin(anomaly+latitudeArgument-2*elongation)+.033*sin(latitudeArgument+2*elongation);
  const moon=horizon(moonLongitude,moonLatitude,tilt,sidereal,latitude,distance);
  const geocentricMoon=horizon(moonLongitude,moonLatitude,tilt,sidereal,latitude);
  const phaseCosine=dot(sun.direction,geocentricMoon.direction);
  return {sun,moon,phaseCosine,illuminated:(1-phaseCosine)/2};
}
