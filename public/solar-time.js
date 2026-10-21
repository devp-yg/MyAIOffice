const RAD = Math.PI / 180;
const DAY_MINUTES = 24 * 60;
const normalize = (value, length) => ((value % length) + length) % length;
const smoothstep = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

function solarEvent(date, latitude, longitude, sunrise) {
  const year = date.getFullYear();
  const day = Math.floor((Date.UTC(year, date.getMonth(), date.getDate()) - Date.UTC(year, 0, 0)) / 86400000);
  const longitudeHour = longitude / 15;
  const approximate = day + ((sunrise ? 6 : 18) - longitudeHour) / 24;
  const meanAnomaly = .9856 * approximate - 3.289;
  const trueLongitude = normalize(meanAnomaly + 1.916 * Math.sin(meanAnomaly * RAD) + .020 * Math.sin(2 * meanAnomaly * RAD) + 282.634, 360);
  let rightAscension = normalize(Math.atan(.91764 * Math.tan(trueLongitude * RAD)) / RAD, 360);
  rightAscension += Math.floor(trueLongitude / 90) * 90 - Math.floor(rightAscension / 90) * 90;
  rightAscension /= 15;
  const sinDeclination = .39782 * Math.sin(trueLongitude * RAD);
  const cosDeclination = Math.cos(Math.asin(sinDeclination));
  const cosHourAngle = (Math.cos(90.833 * RAD) - sinDeclination * Math.sin(latitude * RAD)) / (cosDeclination * Math.cos(latitude * RAD));
  if (cosHourAngle > 1) return { polar: 'night' };
  if (cosHourAngle < -1) return { polar: 'day' };
  const hourAngle = (sunrise ? 360 - Math.acos(cosHourAngle) / RAD : Math.acos(cosHourAngle) / RAD) / 15;
  const utcHours = normalize(hourAngle + rightAscension - .06571 * approximate - 6.622 - longitudeHour, 24);
  return { minute: normalize(utcHours * 60 - date.getTimezoneOffset(), DAY_MINUTES) };
}

export function sunriseSunset(date, latitude, longitude) {
  const sunrise = solarEvent(date, latitude, longitude, true);
  const sunset = solarEvent(date, latitude, longitude, false);
  if (sunrise.polar || sunset.polar) return { polar: sunrise.polar || sunset.polar };
  return { sunrise: sunrise.minute, sunset: sunset.minute };
}

export function daylightAt(date, events) {
  if (events.polar === 'day') return 1;
  if (events.polar === 'night') return .08;
  if (!Number.isFinite(events.sunrise) || !Number.isFinite(events.sunset)) return .08;
  const minute = date.getHours() * 60 + date.getMinutes();
  const dawnStart = normalize(events.sunrise - 75, DAY_MINUTES);
  const dawnProgress = normalize(minute - dawnStart, DAY_MINUTES);
  if (dawnProgress < 105) return .08 + .92 * smoothstep(dawnProgress / 105);
  const daylightStart = normalize(events.sunrise + 30, DAY_MINUTES);
  const daylightDuration = normalize(events.sunset - 30 - daylightStart, DAY_MINUTES);
  if (normalize(minute - daylightStart, DAY_MINUTES) < daylightDuration) return 1;
  const duskStart = normalize(events.sunset - 30, DAY_MINUTES);
  const duskProgress = normalize(minute - duskStart, DAY_MINUTES);
  if (duskProgress < 105) return .08 + .92 * (1 - smoothstep(duskProgress / 105));
  return .08;
}
