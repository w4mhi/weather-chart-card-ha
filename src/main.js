import locale from './locale.js';
import {
  cardinalDirectionsIcon,
  weatherIcons,
  weatherIconsDay,
  weatherIconsNight,
  WeatherEntityFeature
} from './const.js';
import { DEFAULTS, FORECAST_DEFAULTS, UNITS_DEFAULTS } from './defaults.js';
import iconData from './icon-data.js';
import { GestureDetector, hasAction } from './actions.js';
import {LitElement, html, nothing} from 'lit';
import './weather-chart-card-editor.js';
import {Chart, registerables} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
Chart.register(...registerables, ChartDataLabels);

// Data URIs of the bundled icons, built on first use and shared by every card.
const bundledIconUris = {};

// Injected by the rollup build from package.json; 'dev' when run unbundled (tests).
const CARD_VERSION = typeof __CARD_VERSION__ !== 'undefined' ? __CARD_VERSION__ : 'dev';

class WeatherChartCard extends LitElement {

static getConfigElement() {
  return document.createElement("weather-chart-card-ha-editor");
}

static getStubConfig(hass, unusedEntities, allEntities) {
  let entity = unusedEntities.find((eid) => eid.split(".")[0] === "weather");
  if (!entity) {
    entity = allEntities.find((eid) => eid.split(".")[0] === "weather");
  }
  return {
    entity,
    ...DEFAULTS,
    forecast: { ...FORECAST_DEFAULTS },
    units: { ...UNITS_DEFAULTS },
  };
}

  static get properties() {
    return {
      _hass: {},
      config: {},
      language: {},
      sun: {type: Object},
      weather: {type: Object},
      temperature: {type: Object},
      humidity: {type: Object},
      pressure: {type: Object},
      windSpeed: {type: Object},
      windDirection: {type: Number},
      forecastChart: {type: Object},
      forecastItems: {type: Number},
      forecasts: { type: Array }
    };
  }

setConfig(config) {
  const cardConfig = {
    ...DEFAULTS,
    ...config,
    forecast: {
      ...FORECAST_DEFAULTS,
      ...config.forecast,
    },
    units: {
      ...UNITS_DEFAULTS,
      ...config.units,
    }
  };

  cardConfig.units.speed = config.speed ? config.speed : cardConfig.units.speed;

  // An empty title disables the card header. The default 'Weather' is applied
  // above only when no title key is present in the user config. A config saved
  // by an older editor build can carry a non-string title (it wrote the input's
  // `checked` property instead of its value); treat that as no header.
  if (typeof cardConfig.title === 'number') {
    cardConfig.title = String(cardConfig.title);
  } else if (typeof cardConfig.title !== 'string') {
    cardConfig.title = '';
  }
  if (!cardConfig.title.trim()) {
    cardConfig.title = '';
  }

  // `show_main` and `show_forecast` each hide one half of the card, so turning
  // both off would leave nothing behind. The editor disables one switch once the
  // other is off; a hand-written YAML config can still ask for it, so fall back
  // to the forecast rather than rendering an empty card.
  if (cardConfig.show_main === false && cardConfig.show_forecast === false) {
    console.warn('weather-chart-card-ha: show_main and show_forecast cannot both be false; keeping the forecast visible.');
    cardConfig.show_forecast = true;
  }

  this.config = cardConfig;
  if (!config.entity) {
    throw new Error('Please, define entity in the card config');
  }
  if (this.isConnected) {
    this.startAutoRotate();
  }
}

set hass(hass) {
  this._hass = hass;
  this.language = this.config.locale || hass.selectedLanguage || hass.language;
  this.sun = 'sun.sun' in hass.states ? hass.states['sun.sun'] : null;
  // The weather entity must be assigned before the units are derived from it,
  // or the first update has no unit for wind, visibility and temperature.
  this.weather = this.config.entity in hass.states
    ? hass.states[this.config.entity]
    : null;
  this.unitSpeed = this.config.units.speed ? this.config.units.speed : this.weather && this.weather.attributes.wind_speed_unit;
  this.unitPressure = this.config.units.pressure ? this.config.units.pressure : this.weather && this.weather.attributes.pressure_unit;
  this.unitVisibility = this.config.units.visibility ? this.config.units.visibility : this.weather && this.weather.attributes.visibility_unit;
  this.unitTemperature = this.config.units.temperature ? this.config.units.temperature : this.weather && this.weather.attributes.temperature_unit;

  if (this.weather) {
    const attributes = this.weather.attributes;
    this.temperature = this.readSensorState(hass, this.config.temp, attributes.temperature);
    this.humidity = this.readSensorState(hass, this.config.humid, attributes.humidity);
    this.pressure = this.readSensorState(hass, this.config.press, attributes.pressure);
    this.uv_index = this.readSensorState(hass, this.config.uv, attributes.uv_index);
    this.windSpeed = this.readSensorState(hass, this.config.windspeed, attributes.wind_speed);
    this.dew_point = this.readSensorState(hass, this.config.dew_point, attributes.dew_point);
    this.wind_gust_speed = this.readSensorState(hass, this.config.wind_gust_speed, attributes.wind_gust_speed);
    if (this.hasSensorState(hass, this.config.visibility)) {
      this.visibility = hass.states[this.config.visibility].state;
      this.visibilitySourceUnit = hass.states[this.config.visibility].attributes.unit_of_measurement || attributes.visibility_unit;
    } else {
      this.visibility = attributes.visibility;
      this.visibilitySourceUnit = attributes.visibility_unit;
    }

    if (this.hasSensorState(hass, this.config.winddir)) {
      this.windDirection = parseFloat(hass.states[this.config.winddir].state);
    } else {
      this.windDirection = attributes.wind_bearing;
    }

    this.feels_like = this.readSensorState(hass, this.config.feels_like, attributes.apparent_temperature);
    this.description = this.readSensorState(hass, this.config.description, attributes.description);
  }

  // A theme switch changes the CSS variables the chart reads its colors from.
  // Redraw once the new theme has been applied to the page.
  const themes = hass.themes || {};
  const themeKey = `${themes.theme}|${themes.darkMode}`;
  if (this._themeKey !== undefined && themeKey !== this._themeKey && this.forecastChart) {
    requestAnimationFrame(() => this.drawChart());
  }
  this._themeKey = themeKey;

  if (this.weather) {
    this.syncForecastSubscriptions();
    // setConfig and connectedCallback can run before hass arrives, when the
    // forecast entities' features are still unknown.
    if (this.isConnected && this._canAutoRotate && !this.autoRotateTimeout) {
      this.startAutoRotate();
    }
  }
}

/**
 * True when an alternative sensor is configured, exists and reports a usable
 * state. A renamed, removed or unavailable sensor falls back to the weather
 * entity instead of breaking the card.
 */
hasSensorState(hass, entityId) {
  const stateObj = entityId ? hass.states[entityId] : null;
  return Boolean(stateObj)
    && stateObj.state !== undefined
    && stateObj.state !== 'unavailable'
    && stateObj.state !== 'unknown';
}

readSensorState(hass, entityId, fallback) {
  return this.hasSensorState(hass, entityId) ? hass.states[entityId].state : fallback;
}

currentForecastType() {
  return (this.config && this.config.forecast && this.config.forecast.type) || 'daily';
}

/**
 * Forecast types that need a live subscription: the one on screen, plus the
 * other one while auto-rotate is on. Keeping both open during rotation makes
 * each switch instant and avoids a websocket re-subscribe every few seconds.
 */
neededForecastTypes() {
  const current = this.currentForecastType();
  if (!this._canAutoRotate) {
    return [current];
  }
  return [current, current === 'daily' ? 'hourly' : 'daily'];
}

/**
 * Open the subscriptions neededForecastTypes() asks for and close the rest,
 * including any whose forecast entity changed in the config.
 */
syncForecastSubscriptions() {
  if (!this._hass || !this._hass.connection) {
    return;
  }
  this._forecastSubscriptions = this._forecastSubscriptions || {};
  const needed = this.neededForecastTypes();
  for (const type of Object.keys(this._forecastSubscriptions)) {
    const subscription = this._forecastSubscriptions[type];
    if (!needed.includes(type) || subscription.entityId !== this.getForecastEntityId(type)) {
      this.unsubscribeForecastType(type);
    }
  }
  for (const type of needed) {
    if (!this._forecastSubscriptions[type]) {
      this.subscribeForecastType(type);
    }
  }
}

unsubscribeForecastType(type) {
  const subscription = this._forecastSubscriptions && this._forecastSubscriptions[type];
  if (!subscription) {
    return;
  }
  Promise.resolve(subscription.unsubscribe)
    .then((unsub) => { if (typeof unsub === 'function') unsub(); })
    .catch(() => {});
  delete this._forecastSubscriptions[type];
  // The cached payload stops updating once unsubscribed, so drop it.
  if (this._forecastCache) {
    delete this._forecastCache[type];
  }
}

unsubscribeForecastEvents() {
  for (const type of Object.keys(this._forecastSubscriptions || {})) {
    this.unsubscribeForecastType(type);
  }
}

subscribeForecastType(type) {
  const entityId = this.getForecastEntityId(type);

  if (!this.forecastEntitySupports(type)) {
    // set hass retries on every state update; report the problem once.
    const key = `${entityId}|${type}`;
    if (this._unsupportedForecastKey !== key) {
      this._unsupportedForecastKey = key;
      console.error(`Weather entity "${entityId}" does not support ${type} forecasts.`);
    }
    return;
  }

  this._forecastCache = this._forecastCache || {};
  const callback = (event) => {
    const forecast = event.forecast || [];
    // Weather integrations frequently re-push an identical forecast on every
    // entity state write. Skip the redundant redraw so low-power clients don't
    // fall behind the websocket stream — Home Assistant drops the connection
    // once its outbound queue reaches 4096 pending messages.
    const signature = JSON.stringify(forecast);
    const subscription = this._forecastSubscriptions[type];
    if (!subscription || signature === subscription.signature) {
      return;
    }
    subscription.signature = signature;
    this._forecastCache[type] = forecast;
    if (type !== this.currentForecastType()) {
      return;
    }
    this.forecasts = forecast;
    this.requestUpdate();
    // Update the existing chart in place when possible; a full destroy+rebuild
    // (drawChart) is only needed when there is no chart yet.
    if (this.forecastChart) {
      this.updateChart();
    } else {
      this.drawChart();
    }
  };

  // A fresh subscription has no signature, so its first payload always renders.
  this._forecastSubscriptions[type] = {
    entityId,
    signature: null,
    unsubscribe: this._hass.connection.subscribeMessage(callback, {
      type: "weather/subscribe_forecast",
      forecast_type: type,
      entity_id: entityId,
    }),
  };
}

handleForecastTypeToggle() {
  // Toggle between daily and hourly
  const currentType = this.config.forecast.type || 'daily';
  const newType = currentType === 'daily' ? 'hourly' : 'daily';

  // Check if the new type is supported by its resolved forecast entity
  if (!this.forecastEntitySupports(newType)) {
    console.warn(`Weather entity "${this.getForecastEntityId(newType)}" does not support ${newType} forecasts.`);
    return;
  }

  // Update config
  this.config = {
    ...this.config,
    forecast: {
      ...this.config.forecast,
      type: newType
    }
  };

  // Show the other type's forecast at once when its subscription is already
  // open (auto-rotate keeps both); otherwise subscribe and wait for it.
  const cached = this._forecastCache && this._forecastCache[newType];
  if (cached) {
    this.forecasts = cached;
  }
  this.syncForecastSubscriptions();

  // Request update to re-render
  this.requestUpdate();

  // Restart animated icon SVG animations after re-render
  this.updateComplete.then(() => {
    const icons = this.shadowRoot.querySelectorAll('img');
    icons.forEach((img) => {
      const src = img.src;
      img.src = '';
      img.src = src;
    });
  });
}

  supportsFeature(feature) {
    return (this.weather.attributes.supported_features & feature) !== 0;
  }

  getForecastEntityId(type) {
    const forecastConfig = this.config && this.config.forecast ? this.config.forecast : {};
    const override = type === 'hourly' ? forecastConfig.hourly_entity : forecastConfig.daily_entity;
    return override || this.config.entity;
  }

  getForecastEntityState(type) {
    const id = this.getForecastEntityId(type);
    return this._hass && this._hass.states ? (this._hass.states[id] || null) : null;
  }

  getForecastEntityAttributes(type) {
    const state = this.getForecastEntityState(type);
    if (state && state.attributes) {
      return state.attributes;
    }
    return (this.weather && this.weather.attributes) || {};
  }

  forecastEntitySupports(type) {
    const state = this.getForecastEntityState(type);
    if (!state || !state.attributes) {
      return false;
    }
    const feature = type === 'hourly'
      ? WeatherEntityFeature.FORECAST_HOURLY
      : WeatherEntityFeature.FORECAST_DAILY;
    return (state.attributes.supported_features & feature) !== 0;
  }

  /**
   * Auto-rotate interval in milliseconds: `auto_rotate` minutes (0-60) plus
   * `auto_rotate_seconds` (0, 5, 10, 15 or 30). 0 means off.
   */
  getAutoRotateMs() {
    const forecast = (this.config && this.config.forecast) || {};
    const minutes = Math.min(60, Math.max(0, parseInt(forecast.auto_rotate, 10) || 0));
    const seconds = parseInt(forecast.auto_rotate_seconds, 10);
    const validSeconds = WeatherChartCard.AUTO_ROTATE_SECONDS.includes(seconds) ? seconds : 0;
    return (minutes * 60 + validSeconds) * 1000;
  }

  get _canAutoRotate() {
    return this.getAutoRotateMs() > 0
      && this.forecastEntitySupports('daily')
      && this.forecastEntitySupports('hourly');
  }

  constructor() {
    super();
    this.resizeObserver = null;
    this.resizeInitialized = false;
    this._gestures = new GestureDetector(
      (action) => this.handleCardAction(action),
      () => ({
        hold: hasAction(this.config.hold_action),
        doubleTap: hasAction(this.config.double_tap_action),
      })
    );
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.resizeInitialized) {
      this.delayedAttachResizeObserver();
    }
    // firstUpdated starts autoscroll on the first connect; later reconnects
    // (view changes) restart the timer that disconnectedCallback cancelled.
    if (this.hasUpdated && this.config && this.config.autoscroll) {
      this.autoscroll();
    }
    this.startAutoRotate();
  }

  /**
   * Start (or restart) auto-rotate. Switches land on multiples of the interval
   * since the epoch, so cards with the same interval switch together. After a
   * manual click the boundaries are counted from the click instead, so the
   * full interval runs from now. Each switch targets the next boundary rather
   * than a fixed delay, so a late (throttled) timeout does not shift the rest.
   */
  startAutoRotate({ fromNow = false } = {}) {
    this.stopAutoRotate();
    if (this.config && this.config.show_forecast === false) return;
    if (!this._canAutoRotate) return;
    const interval = this.getAutoRotateMs();
    const anchor = fromNow ? Date.now() : 0;
    const nextBoundary = (after) => anchor + (Math.floor((after - anchor) / interval) + 1) * interval;
    const schedule = (target) => {
      this.autoRotateTimeout = setTimeout(() => {
        this.handleForecastTypeToggle();
        // max() keeps an early timeout from switching twice for one boundary.
        schedule(nextBoundary(Math.max(Date.now(), target)));
      }, Math.max(0, target - Date.now()));
    };
    schedule(nextBoundary(Date.now()));
  }

  stopAutoRotate() {
    if (this.autoRotateTimeout) {
      clearTimeout(this.autoRotateTimeout);
      this.autoRotateTimeout = null;
    }
  }

  // The daily/hourly button. With auto-rotate on it still switches, and the
  // next automatic switch is a full interval after the click.
  handleForecastToggleClick() {
    this.handleForecastTypeToggle();
    if (this._canAutoRotate) {
      this.startAutoRotate({ fromNow: true });
    }
  }

  delayedAttachResizeObserver() {
    setTimeout(() => {
      this.attachResizeObserver();
      this.resizeInitialized = true;
    }, 0);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.detachResizeObserver();
    // Reattach on the next connect: HA disconnects cards on every view change.
    this.resizeInitialized = false;
    this.cancelAutoscroll();
    this.stopAutoRotate();
    this.unsubscribeForecastEvents();
    this._gestures.dispose();
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
  }

  attachResizeObserver() {
    this.resizeObserver = new ResizeObserver(() => {
      this.measureCard();
    });
    const card = this.shadowRoot.querySelector('ha-card');
    if (card) {
      this.resizeObserver.observe(card);
    }
  }

  detachResizeObserver() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

measureCard() {
  const card = this.shadowRoot.querySelector('ha-card');
  let fontSize = this.config.forecast.labels_font_size;
  const numberOfForecasts = this.config.forecast.number_of_forecasts || 0;

  if (!card) {
    return;
  }

  this.forecastItems = numberOfForecasts > 0 ? numberOfForecasts : Math.round(card.offsetWidth / (fontSize * 6));
  this.drawChart();
}

/**
 * Translation blocks to try for the card's language, most specific first:
 * the full locale ('ro-RO'), then its language code ('ro'). Norwegian is keyed
 * `nb`; older configs and some browsers use the macrolanguage code `no`.
 */
getLocaleCandidates() {
  const selectedLocale = this.config.locale || this.language || 'en';
  const languageCode = selectedLocale.split('-')[0];
  const aliases = { no: 'nb', nn: 'nb' };
  return [selectedLocale, languageCode, aliases[languageCode]]
    .filter((key) => key && locale[key]);
}

ll(str) {
  for (const key of this.getLocaleCandidates()) {
    if (locale[key][str]) {
      return locale[key][str];
    }
  }

  // Final fallback to English
  return locale.en[str];
}

/**
 * Condition text for the main section. Home Assistant ships the condition
 * names in every language it supports, so its translation comes first, as
 * long as the card shows the same language as Home Assistant (a card `locale`
 * can differ). The card's own translations come next, then the raw state.
 */
localizeCondition(condition) {
  const localize = this._hass && this._hass.localize;
  const haTranslation = () => {
    if (typeof localize !== 'function') {
      return '';
    }
    return localize(`component.weather.entity_component._.state.${condition}`)
      || localize(`state.default.${condition}`);
  };
  const language = (code) => String(code || '').split('-')[0].toLowerCase();
  const sameLanguage = !this.config.locale
    || language(this.config.locale) === language(this._hass && this._hass.language);
  return (sameLanguage && haTranslation())
    || this.ll(condition)
    || haTranslation()
    || condition;
}

getTimezone() {
  return this.config.timezone || (this._hass && this._hass.config && this._hass.config.time_zone) || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Calculate sunrise and sunset times from coordinates using the standard algorithm.
 * Returns UTC Date objects for sunrise and sunset on the given date.
 * @param {Date} date
 * @param {number} latitude
 * @param {number} longitude
 * @returns {{ sunrise: Date|null, sunset: Date|null }}
 */
calculateSunriseSunset(date, latitude, longitude) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;

  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor(
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - startOfYear) / 86400000
  );

  const zenith = 90.833;
  const lngHour = longitude / 15;

  const compute = (isSunrise) => {
    const t = dayOfYear + ((isSunrise ? 6 : 18) - lngHour) / 24;
    const M = (0.9856 * t) - 3.289;
    let L = M + 1.916 * Math.sin(toRad(M)) + 0.020 * Math.sin(toRad(2 * M)) + 282.634;
    L = ((L % 360) + 360) % 360;
    let RA = toDeg(Math.atan(0.91764 * Math.tan(toRad(L))));
    RA = ((RA % 360) + 360) % 360;
    const Lq = Math.floor(L / 90) * 90;
    const RAq = Math.floor(RA / 90) * 90;
    RA = (RA + Lq - RAq) / 15;
    const sinDec = 0.39782 * Math.sin(toRad(L));
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(toRad(zenith)) - sinDec * Math.sin(toRad(latitude))) /
                 (cosDec * Math.cos(toRad(latitude)));
    if (cosH > 1 || cosH < -1) return null; // polar day or night
    const H = isSunrise ? 360 - toDeg(Math.acos(cosH)) : toDeg(Math.acos(cosH));
    let UT = (H / 15 + RA - 0.06571 * t - 6.622) - lngHour;
    UT = ((UT % 24) + 24) % 24;
    const hours = Math.floor(UT);
    const minutes = Math.round((UT - hours) * 60);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes, 0));
  };

  return { sunrise: compute(true), sunset: compute(false) };
}

/**
 * Timezone used for sun/day-night calculations. Mirrors renderSun's resolution
 * so every day/night decision shares one source of truth.
 */
getSunTimezone() {
  return this.config.sun_timezone
    || this.config.timezone
    || (this._hass && this._hass.config && this._hass.config.time_zone)
    || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Latitude/longitude used for sun calculations: explicit card config first,
 * otherwise the Home Assistant home coordinates.
 */
getSunLocation() {
  const lat = this.config.sun_latitude != null ? this.config.sun_latitude
    : (this._hass && this._hass.config && this._hass.config.latitude);
  const lon = this.config.sun_longitude != null ? this.config.sun_longitude
    : (this._hass && this._hass.config && this._hass.config.longitude);
  return { lat, lon };
}

/**
 * Minutes-since-midnight of an instant, evaluated as wall-clock time in the
 * given IANA timezone. Comparing wall-clock minutes is immune to the UTC-day
 * that calculateSunriseSunset pins its results to, so it works correctly for
 * both eastern and western longitudes.
 */
getWallClockMinutes(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(instant);
  const hour = Number(parts.find((p) => p.type === 'hour').value);
  const minute = Number(parts.find((p) => p.type === 'minute').value);
  return hour * 60 + minute;
}

/**
 * Determine whether a given instant is daytime at the card's sun location.
 * The forecast slot's calendar date is derived in the card's own timezone
 * (not the Home Assistant home timezone), then compared against that date's
 * sunrise/sunset by local wall-clock time.
 *
 * @param {Date} instant
 * @param {{ lat?: number, lon?: number, timeZone?: string }} [options]
 * @returns {boolean|null} true=day, false=night, null when it cannot be computed
 *   (missing coordinates or polar day/night) so the caller can fall back.
 */
isDaytimeAt(instant, options = {}) {
  const lat = options.lat != null ? options.lat : this.getSunLocation().lat;
  const lon = options.lon != null ? options.lon : this.getSunLocation().lon;
  if (lat == null || lon == null) return null;
  const timeZone = options.timeZone || this.getSunTimezone();

  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(instant);
  const year = Number(dateParts.find((p) => p.type === 'year').value);
  const month = Number(dateParts.find((p) => p.type === 'month').value);
  const day = Number(dateParts.find((p) => p.type === 'day').value);

  const { sunrise, sunset } = this.calculateSunriseSunset(
    new Date(Date.UTC(year, month - 1, day)), lat, lon
  );
  if (!sunrise || !sunset) return null; // polar day/night → let caller fall back

  const nowMinutes = this.getWallClockMinutes(instant, timeZone);
  const sunriseMinutes = this.getWallClockMinutes(sunrise, timeZone);
  const sunsetMinutes = this.getWallClockMinutes(sunset, timeZone);
  return nowMinutes >= sunriseMinutes && nowMinutes < sunsetMinutes;
}

/**
 * Day or night for an hourly forecast slot, at the card's sun location. Falls
 * back to the `sun.sun` entity when there are no coordinates (or at polar day
 * and night), and to daytime when that is missing too.
 * @param {Date} forecastTime
 * @param {{ lat?: number, lon?: number, timeZone?: string }} [location]
 */
isForecastSlotDaytime(forecastTime, location = {}) {
  const isDay = this.isDaytimeAt(forecastTime, location);
  if (isDay != null) {
    return isDay;
  }
  const sun = this.sun;
  if (sun && sun.attributes) {
    const sunriseTime = new Date(sun.attributes.next_rising);
    const sunsetTime = new Date(sun.attributes.next_setting);
    return sunriseTime && sunsetTime
      ? forecastTime >= sunriseTime && forecastTime <= sunsetTime
      : true;
  }
  return true;
}

/**
 * Get locale data with fallback logic
 * @param {string} key - 'days' or 'months'
 * @returns {Array|null} - locale array or null if not found
 */
getLocaleArray(key) {
  for (const localeKey of this.getLocaleCandidates()) {
    if (locale[localeKey][key] && locale[localeKey][key].length) {
      return locale[localeKey][key];
    }
  }
  
  // English fallback with safety check
  if (locale.en && locale.en[key] && locale.en[key].length) {
    return locale.en[key];
  }
  
  // Ultimate fallback: return null if nothing works
  return null;
}

formatLocalizedShortDateLabel(label, locale) {
  const normalizedLabel = label.replace(/[.\s]+$/u, '');
  if (!WeatherChartCard.LATIN_SCRIPT_REGEX.test(normalizedLabel)) return normalizedLabel;
  try {
    return normalizedLabel.toLocaleUpperCase(locale);
  } catch (e) {
    return normalizedLabel.toUpperCase();
  }
}

/**
 * Weekday (0 = Sunday) and month (0 = January) of an instant in the given
 * timezone. `Date#getDay` and `Date#getMonth` use the browser's timezone, which
 * differs from the card's on a dual-location dashboard.
 */
getZonedDateIndices(date, timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'numeric',
      timeZone: timezone
    }).formatToParts(date);
    const weekday = parts.find((p) => p.type === 'weekday').value;
    const month = Number(parts.find((p) => p.type === 'month').value);
    const dayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
    if (dayIndex >= 0 && month >= 1 && month <= 12) {
      return { dayIndex, monthIndex: month - 1 };
    }
  } catch (e) {
    // Invalid timezone: fall through to the browser's own calendar.
  }
  return { dayIndex: date.getDay(), monthIndex: date.getMonth() };
}

getLocalizedDayName(date, timezone) {
  const { dayIndex } = this.getZonedDateIndices(date, timezone);
  
  // Priority 1: Browser Intl localized short weekday name
  try {
    const selectedLocale = this.config.locale || this.language || 'en';
    const dayFormatter = new Intl.DateTimeFormat(selectedLocale, {
      weekday: document.dir === 'rtl' ? 'long' : 'short',
      timeZone: timezone
    });
    const formatted = dayFormatter.format(date);
    if (formatted && formatted.length > 0) {
      return this.formatLocalizedShortDateLabel(formatted, selectedLocale);
    }
  } catch (e) {
    // Intl failed, continue to translation-array fallback
  }

  // Priority 2: Try full day translation array from locale.js
  const days = this.getLocaleArray('days');
  if (days && days[dayIndex] && typeof days[dayIndex] === 'string' && days[dayIndex].length > 0) {
    const dayName = document.dir === 'rtl' ? days[dayIndex] : days[dayIndex].substring(0, 3);
    return this.formatLocalizedShortDateLabel(dayName, this.config.locale || this.language || 'en');
  }
  
  // Priority 3: Hardcoded English fallback
  const englishDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return englishDays[dayIndex].substring(0, 3).toUpperCase();
}

/**
 * Get localized day name (full)
 */
getLocalizedDayNameFull(date, timezone) {
  const { dayIndex } = this.getZonedDateIndices(date, timezone);
  
  // Priority 1: Try translation array from locale.js
  const days = this.getLocaleArray('days');
  if (days && days[dayIndex] && typeof days[dayIndex] === 'string' && days[dayIndex].length > 0) {
    return days[dayIndex];
  }
  
  // Priority 2: Browser Intl fallback
  try {
    const selectedLocale = this.config.locale || this.language || 'en';
    const dayFormatter = new Intl.DateTimeFormat(selectedLocale, {
      weekday: 'long',
      timeZone: timezone
    });
    const formatted = dayFormatter.format(date);
    if (formatted && formatted.length > 0) {
      return formatted;
    }
  } catch (e) {
    // Intl failed, continue to ultimate fallback
  }
  
  // Priority 3: Hardcoded English fallback
  const englishDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return englishDays[dayIndex];
}

/**
 * Get localized day number
 */
getLocalizedDayNumber(date, locale, timezone) {
  try {
    return date.toLocaleString(locale, { day: 'numeric', timeZone: timezone });
  } catch (error) {
    return date.getDate().toString();
  }
}

/**
 * Get localized month name (full)
 */
getLocalizedMonthName(date, timezone) {
  const { monthIndex } = this.getZonedDateIndices(date, timezone);
  
  // Priority 1: Try translation array from locale.js
  const months = this.getLocaleArray('months');
  if (months && months[monthIndex] && typeof months[monthIndex] === 'string' && months[monthIndex].length > 0) {
    return months[monthIndex].charAt(0).toUpperCase() + months[monthIndex].slice(1);
  }
  
  // Priority 2: Browser Intl fallback
  try {
    const selectedLocale = this.config.locale || this.language || 'en';
    const monthFormatter = new Intl.DateTimeFormat(selectedLocale, {
      month: 'long',
      timeZone: timezone
    });
    const formatted = monthFormatter.format(date);
    if (formatted && formatted.length > 0) {
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
  } catch (e) {
    // Intl failed, continue to ultimate fallback
  }
  
  // Priority 3: Hardcoded English fallback
  const englishMonths = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  return englishMonths[monthIndex].charAt(0).toUpperCase() + englishMonths[monthIndex].slice(1);
}

/**
 * Get localized month name (short - 3 letters uppercase)
 */
getLocalizedMonthNameShort(date, timezone) {
  const { monthIndex } = this.getZonedDateIndices(date, timezone);
  
  // Priority 1: Try translation array from locale.js
  const months = this.getLocaleArray('months');
  if (months && months[monthIndex] && typeof months[monthIndex] === 'string' && months[monthIndex].length > 0) {
    const monthName = months[monthIndex].substring(0, 3);
    // Only uppercase for Latin-script languages
    return WeatherChartCard.LATIN_SCRIPT_REGEX.test(monthName) ? monthName.toUpperCase() : monthName;
  }
  
  // Priority 2: Browser Intl fallback
  try {
    const selectedLocale = this.config.locale || this.language || 'en';
    const monthFormatter = new Intl.DateTimeFormat(selectedLocale, {
      month: 'long',
      timeZone: timezone
    });
    const formatted = monthFormatter.format(date);
    if (formatted && formatted.length > 0) {
      const monthName = formatted.substring(0, 3);
      // Only uppercase for Latin-script languages
      return WeatherChartCard.LATIN_SCRIPT_REGEX.test(monthName) ? monthName.toUpperCase() : monthName;
    }
  } catch (e) {
    // Intl failed, continue to ultimate fallback
  }
  
  // Priority 3: Hardcoded English fallback
  const englishMonths = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  return englishMonths[monthIndex].substring(0, 3).toUpperCase();
}

  getCardSize() {
    return 4;
  }

  getUnit(unit) {
    return this._hass.config.unit_system[unit] || '';
  }

  /**
   * Icon for a condition: an image URL (custom `icons` path, or the animated
   * icon bundled with the card) or an MDI icon name. Custom icons win over
   * the bundled ones; a condition with no image falls back to MDI.
   */
  getWeatherIcon(condition, sun) {
    const iconName = (sun === 'below_horizon' ? weatherIconsNight : weatherIconsDay)[condition];
    if (iconName && this.config.icons) {
      return `${this.config.icons}${iconName}.svg`;
    }
    if (iconName && this.config.animated_icons === true) {
      const bundled = this.getBundledIcon(iconName);
      if (bundled) {
        return bundled;
      }
    }
    return weatherIcons[condition] || 'mdi:weather-cloudy-alert';
  }

  /**
   * Data URI of an animated icon shipped inside the bundle, in the configured
   * `icon_style`. Bundling them means no CDN, no extra files to install and no
   * icons from a different release.
   */
  getBundledIcon(iconName) {
    const style = this.config.icon_style === 'style2' ? 'style2' : 'style1';
    const key = `${style}/${iconName}`;
    if (!(key in bundledIconUris)) {
      const svg = iconData[style][iconName];
      bundledIconUris[key] = svg ? `data:image/svg+xml,${encodeURIComponent(svg)}` : null;
    }
    return bundledIconUris[key];
  }

  renderWeatherIcon(condition, sunState) {
    const icon = this.getWeatherIcon(condition, sunState);
    if (/^(mdi|hass):/.test(icon)) {
      return html`<ha-icon icon="${icon}"></ha-icon>`;
    }
    return html`<img src="${icon}"
                     @error="${(e) => this.handleIconError(e, condition, sunState)}"
                     alt="">`;
  }

  /**
   * A custom icon failed to load: show the bundled animated icon instead, and
   * if that is missing too, the MDI icon.
   */
  handleIconError(event, condition, sun) {
    const img = event.target;
    const iconName = (sun === 'below_horizon' ? weatherIconsNight : weatherIconsDay)[condition];
    const bundled = iconName ? this.getBundledIcon(iconName) : null;
    if (bundled && !img.dataset.fallbackAttempted) {
      img.dataset.fallbackAttempted = 'bundled';
      img.src = bundled;
      return;
    }
    const haIcon = document.createElement('ha-icon');
    haIcon.setAttribute('icon', weatherIcons[condition] || 'mdi:weather-cloudy-alert');
    haIcon.style.cssText = img.style.cssText;
    img.parentNode.replaceChild(haIcon, img);
  }

getWindDirIcon(deg) {
  if (typeof deg === 'number') {
    return cardinalDirectionsIcon[parseInt((deg + 22.5) / 45.0)];
  } else {
    var i = 9;
    switch (deg) {
      case "N":
        i = 0;
        break;
      case "NNE":
      case "NE":
        i = 1;
        break;
      case "ENE":
      case "E":
        i = 2;
        break;
      case "ESE":
      case "SE":
        i = 3;
        break;
      case "SSE":
      case "S":
        i = 4;
        break;
      case "SSW":
      case "SW":
        i = 5;
        break;
      case "WSW":
      case "W":
        i = 6;
        break;
      case "NW":
      case "NNW":
        i = 7;
        break;
      case "WNW":
        i = 8;
        break;
      default:
        // Unknown or missing bearing: there is no arrow to point.
        return null;
    }
    return cardinalDirectionsIcon[i];
  }
}

getWindDir(deg) {
  if (typeof deg === 'number') {
    return this.ll('cardinalDirections')[parseInt((deg + 11.25) / 22.5)];
  } else {
    return deg;
  }
}

calculateBeaufortScale(windSpeed, sourceUnit = this.weather && this.weather.attributes && this.weather.attributes.wind_speed_unit) {
  const numericWindSpeed = Number(windSpeed);
  if (!Number.isFinite(numericWindSpeed)) {
    return windSpeed;
  }

  // The source is already on the Beaufort scale. Home Assistant reports this
  // unit as 'Beaufort'; some setups/sensors use the short 'Bft'. Either way the
  // value is already a Beaufort number, so return it unchanged (rounded).
  if (sourceUnit === 'Bft' || sourceUnit === 'Beaufort') {
    return Math.round(numericWindSpeed);
  }

  const unitConversion = {
    'km/h': 1,
    'm/s': 3.6,
    'mph': 1.60934,
    'kn': 1.852,
  };

  const conversionFactor = sourceUnit ? unitConversion[sourceUnit] : undefined;

  // Unknown/missing source unit: we can't compute Beaufort, but throwing here
  // would bubble out of render() and blank the whole card. Degrade gracefully
  // by returning the value unchanged instead.
  if (typeof conversionFactor !== 'number') {
    console.warn(`weather-chart-card-ha: cannot convert wind speed from "${sourceUnit}" to Beaufort; showing the value unchanged.`);
    return Math.round(numericWindSpeed);
  }

  const windSpeedInKmPerHour = numericWindSpeed * conversionFactor;

  if (windSpeedInKmPerHour < 1) return 0;
  else if (windSpeedInKmPerHour < 6) return 1;
  else if (windSpeedInKmPerHour < 12) return 2;
  else if (windSpeedInKmPerHour < 20) return 3;
  else if (windSpeedInKmPerHour < 29) return 4;
  else if (windSpeedInKmPerHour < 39) return 5;
  else if (windSpeedInKmPerHour < 50) return 6;
  else if (windSpeedInKmPerHour < 62) return 7;
  else if (windSpeedInKmPerHour < 75) return 8;
  else if (windSpeedInKmPerHour < 89) return 9;
  else if (windSpeedInKmPerHour < 103) return 10;
  else if (windSpeedInKmPerHour < 118) return 11;
  else return 12;
}

/**
 * Representative wind speed (m/s) for a Beaufort force number, using the
 * accepted empirical relationship v = 0.836 * B^1.5. Beaufort is a range-based
 * scale, so this returns a typical mid-range speed for the force rather than an
 * exact value.
 */
beaufortToMetersPerSecond(beaufort) {
  const b = Number(beaufort);
  if (!Number.isFinite(b) || b <= 0) {
    return 0;
  }
  return 0.836 * Math.pow(b, 1.5);
}

convertWindSpeed(windSpeed, targetUnit = this.unitSpeed, sourceUnit = this.weather && this.weather.attributes && this.weather.attributes.wind_speed_unit) {
  const numericWindSpeed = Number(windSpeed);

  if (!Number.isFinite(numericWindSpeed)) {
    return windSpeed;
  }

  if (!targetUnit || !sourceUnit || targetUnit === sourceUnit) {
    return Math.round(numericWindSpeed);
  }

  // Home Assistant reports Beaufort-scale wind as 'Beaufort'; some sensors use
  // the short 'Bft'. Treat both as the same scale.
  const sourceIsBeaufort = sourceUnit === 'Bft' || sourceUnit === 'Beaufort';

  if (targetUnit === 'Bft' || targetUnit === 'Beaufort') {
    return this.calculateBeaufortScale(numericWindSpeed, sourceUnit);
  }

  const metersPerSecondToTarget = {
    'm/s': 1,
    'km/h': 3.6,
    'mph': 2.2369362920544,
    'kn': 1.9438444924406,
  };

  const fromMetersPerSecond = metersPerSecondToTarget[targetUnit];

  // Beaufort is a scale, not an exact speed, so map each force to a
  // representative wind speed (m/s) before converting to the target unit.
  if (sourceIsBeaufort) {
    if (!fromMetersPerSecond) {
      return Math.round(numericWindSpeed);
    }
    const metersPerSecond = this.beaufortToMetersPerSecond(numericWindSpeed);
    return Math.round(metersPerSecond * fromMetersPerSecond);
  }

  const sourceToMetersPerSecond = {
    'm/s': 1,
    'km/h': 1 / 3.6,
    'mph': 0.44704,
    'kn': 0.514444,
  };

  const toMetersPerSecond = sourceToMetersPerSecond[sourceUnit];

  if (!toMetersPerSecond || !fromMetersPerSecond) {
    return Math.round(numericWindSpeed);
  }

  return Math.round(numericWindSpeed * toMetersPerSecond * fromMetersPerSecond);
}

/**
 * Convert a pressure between any of the units Home Assistant reports, through
 * pascals, and round it for display. An unknown unit is shown unconverted,
 * labelled with its own unit.
 * @returns {{ value: (number|string|undefined), unit: string }}
 */
formatPressure(value, fromUnit, toUnit = fromUnit) {
  const numericValue = Number(value);
  if (value === undefined || value === null || value === '' || !Number.isFinite(numericValue)) {
    return { value, unit: toUnit || fromUnit };
  }
  const toPascals = {
    'Pa': 1,
    'hPa': 100,
    'mbar': 100,
    'cbar': 1000,
    'kPa': 1000,
    'bar': 100000,
    'mmHg': 133.322387415,
    'inHg': 3386.389,
    'psi': 6894.757,
  };
  const decimals = { 'kPa': 1, 'cbar': 1, 'bar': 3, 'inHg': 2, 'psi': 2 };
  const fromFactor = toPascals[fromUnit];
  const toFactor = toPascals[toUnit];
  const unit = fromFactor && toFactor ? toUnit : fromUnit;
  const converted = fromFactor && toFactor ? numericValue * fromFactor / toFactor : numericValue;
  const places = decimals[unit] || 0;
  return { value: places ? converted.toFixed(places) : Math.round(converted), unit };
}

convertTemperature(temp, fromUnit, toUnit) {
  if (!toUnit || fromUnit === toUnit) return temp;
  
  if (toUnit === '°C' && fromUnit === '°F') {
    return (temp - 32) * 5/9;
  } else if (toUnit === '°F' && fromUnit === '°C') {
    return (temp * 9/5) + 32;
  }
  
  return temp;
}

normalizePrecipitationUnit(unit) {
  if (!unit) {
    return null;
  }

  const normalized = String(unit).trim().toLowerCase();
  const aliases = {
    'mm': 'mm',
    'millimeter': 'mm',
    'millimeters': 'mm',
    'millimetre': 'mm',
    'millimetres': 'mm',
    'cm': 'cm',
    'centimeter': 'cm',
    'centimeters': 'cm',
    'centimetre': 'cm',
    'centimetres': 'cm',
    'in': 'in',
    'inch': 'in',
    'inches': 'in',
    'l/m2': 'l/m2',
    'l/m²': 'l/m2',
    'liter/m2': 'l/m2',
    'liters/m2': 'l/m2',
    'litre/m2': 'l/m2',
    'litres/m2': 'l/m2',
    'kg/m2': 'kg/m2',
    'kg/m²': 'kg/m2',
  };

  return aliases[normalized] || normalized;
}

getSourcePrecipitationUnit() {
  const forecastType = this.config && this.config.forecast ? (this.config.forecast.type || 'daily') : 'daily';
  const forecastAttrs = this.getForecastEntityAttributes(forecastType);
  const attrUnit = forecastAttrs ? forecastAttrs.precipitation_unit : null;
  const normalizedAttrUnit = this.normalizePrecipitationUnit(attrUnit);
  if (normalizedAttrUnit) {
    return normalizedAttrUnit;
  }

  const lengthUnit = this._hass && this._hass.config && this._hass.config.unit_system
    ? this._hass.config.unit_system.length
    : null;
  return lengthUnit === 'km' ? 'mm' : 'in';
}

getDisplayPrecipitationUnit(sourceUnit = this.getSourcePrecipitationUnit()) {
  const configuredUnit = this.config && this.config.units ? this.config.units.precipitation : null;
  const normalizedConfiguredUnit = this.normalizePrecipitationUnit(configuredUnit);
  return normalizedConfiguredUnit || sourceUnit;
}

convertPrecipitation(value, fromUnit, toUnit) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value;
  }

  const normalizedFrom = this.normalizePrecipitationUnit(fromUnit);
  const normalizedTo = this.normalizePrecipitationUnit(toUnit);

  if (!normalizedFrom || !normalizedTo || normalizedFrom === normalizedTo) {
    return numericValue;
  }

  const toMillimeters = {
    'mm': 1,
    'cm': 10,
    'in': 25.4,
    'l/m2': 1,
    'kg/m2': 1,
  };

  const fromFactor = toMillimeters[normalizedFrom];
  const toFactor = toMillimeters[normalizedTo];

  if (!fromFactor || !toFactor) {
    return numericValue;
  }

  return numericValue * fromFactor / toFactor;
}

convertVisibility(value, fromUnit, toUnit) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return value;
  }
  if (!fromUnit || !toUnit || fromUnit === toUnit) {
    return numericValue;
  }
  // Normalize to meters first
  const toMeters = { 'm': 1, 'km': 1000, 'mi': 1609.344, 'yd': 0.9144, 'ft': 0.3048 };
  const fromFactor = toMeters[fromUnit];
  const toFactor = toMeters[toUnit];
  if (!fromFactor || !toFactor) {
    return numericValue;
  }
  const result = numericValue * fromFactor / toFactor;
  // Round to 1 decimal place; drop the decimal if the result is a whole number
  return Math.round(result * 10) / 10;
}

async firstUpdated(changedProperties) {
  super.firstUpdated(changedProperties);
  this.measureCard();
  await new Promise(resolve => setTimeout(resolve, 0));
  this.drawChart();

  if (this.config.autoscroll) {
    this.autoscroll();
  }
}


async updated(changedProperties) {
  await this.updateComplete;

  if (changedProperties.has('config')) {
    const oldConfig = changedProperties.get('config');

    const autoscrollChanged = oldConfig && this.config.autoscroll !== oldConfig.autoscroll;

    if (oldConfig) {
      this.syncForecastSubscriptions();
      const cached = this._forecastCache && this._forecastCache[this.currentForecastType()];
      if (cached) {
        this.forecasts = cached;
      }
    }

    if (this.forecasts && this.forecasts.length) {
      this.drawChart();
    }

    if (autoscrollChanged) {
      if (this.config.autoscroll) {
        this.autoscroll();
      } else {
        this.cancelAutoscroll();
      }
    }
  }

  if (changedProperties.has('weather')) {
    this.updateChart();
  }
}

autoscroll() {
  if (this.autoscrollTimeout) {
    // Autscroll already set, nothing to do
    return;
  }

  const updateChartOncePerHour = () => {
    const now = new Date();
    const nextHour = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours()+1,
    );
    this.autoscrollTimeout = setTimeout(() => {
      this.autoscrollTimeout = null;
      // Re-render too, so the icon and wind rows drop the same past slot.
      this.requestUpdate();
      this.updateChart();
      updateChartOncePerHour();
    }, nextHour - now);
  };

  updateChartOncePerHour();
}

cancelAutoscroll() {
  if (this.autoscrollTimeout) {
    clearTimeout(this.autoscrollTimeout);
    this.autoscrollTimeout = null;
  }
}

getTemperatureColor(temp, unit) {
  return this.getTemperatureColorWithRange(temp, unit, null);
}

getTemperatureColorWithRange(temp, unit, rangeC) {
  // Convert to Celsius for consistent thresholds
  let tempC = temp;
  if (unit === '°F') {
    tempC = (temp - 32) * 5/9;
  }

  if (rangeC && Number.isFinite(rangeC.min) && Number.isFinite(rangeC.max) && rangeC.max > rangeC.min) {
    const palette = [
      { stop: 0.0, rgb: [30, 136, 229] },
      { stop: 0.25, rgb: [129, 212, 250] },
      { stop: 0.5, rgb: [129, 199, 132] },
      { stop: 0.68, rgb: [255, 241, 118] },
      { stop: 0.84, rgb: [255, 167, 38] },
      { stop: 1.0, rgb: [244, 67, 54] },
    ];

    const normalized = Math.max(0, Math.min(1, (tempC - rangeC.min) / (rangeC.max - rangeC.min)));

    for (let i = 0; i < palette.length - 1; i++) {
      const start = palette[i];
      const end = palette[i + 1];
      if (normalized >= start.stop && normalized <= end.stop) {
        const localT = (normalized - start.stop) / (end.stop - start.stop || 1);
        const r = Math.round(start.rgb[0] + (end.rgb[0] - start.rgb[0]) * localT);
        const g = Math.round(start.rgb[1] + (end.rgb[1] - start.rgb[1]) * localT);
        const b = Math.round(start.rgb[2] + (end.rgb[2] - start.rgb[2]) * localT);
        return `rgba(${r}, ${g}, ${b}, 1.0)`;
      }
    }
  }
  
  // 6-level color spectrum
  if (tempC < 5) {
    return 'rgba(30, 136, 229, 1.0)';   // Cold - Dark Blue
  } else if (tempC < 15) {
    return 'rgba(129, 212, 250, 1.0)';  // Cool - Light Blue
  } else if (tempC < 22) {
    return 'rgba(129, 199, 132, 1.0)';  // Comfortable - Green
  } else if (tempC < 26) {
    return 'rgba(255, 241, 118, 1.0)';  // Pleasant/Warm - Yellow
  } else if (tempC < 32) {
    return 'rgba(255, 167, 38, 1.0)';   // Hot - Orange
  } else {
    return 'rgba(244, 67, 54, 1.0)';    // Very Hot - Red
  }
}

getGradientPresetRangeC(preset = 'temperate') {
  const presetRanges = {
    temperate: { min: -10, max: 35 },
    continental: { min: -30, max: 35 },
    subarctic: { min: -45, max: 20 },
    polar: { min: -55, max: 10 },
    hot_arid: { min: 0, max: 50 },
  };

  return presetRanges[preset] || presetRanges.temperate;
}

getAdaptiveTemperatureRangeC(data, unit) {
  const values = (data || [])
    .map((value) => {
      if (!Number.isFinite(value)) {
        return null;
      }
      return unit === '°F' ? ((value - 32) * 5 / 9) : value;
    })
    .filter((value) => value !== null)
    .sort((a, b) => a - b);

  if (values.length < 4) {
    return null;
  }

  const low = values[Math.floor((values.length - 1) * 0.1)];
  const high = values[Math.ceil((values.length - 1) * 0.9)];
  let min = low;
  let max = high;

  if (max - min < 8) {
    const center = (min + max) / 2;
    min = center - 4;
    max = center + 4;
  }

  const padding = Math.max(1.5, (max - min) * 0.1);
  min = Math.max(-60, min - padding);
  max = Math.min(55, max + padding);

  if (max - min < 2) {
    return null;
  }

  return { min, max };
}

getTemperatureRangeC(data, unit) {
  const forecastConfig = (this.config && this.config.forecast) ? this.config.forecast : {};
  const gradientMode = forecastConfig.gradient_mode || 'classic';
  const gradientPreset = forecastConfig.gradient_preset || 'temperate';

  if (gradientMode === 'climate_preset') {
    return this.getGradientPresetRangeC(gradientPreset);
  }

  if (gradientMode === 'adaptive') {
    const adaptiveRange = this.getAdaptiveTemperatureRangeC(data, unit);
    if (adaptiveRange) {
      return adaptiveRange;
    }
    return this.getGradientPresetRangeC(gradientPreset);
  }

  return null;
}

createTemperatureGradient(data, unit, ctx, chartArea, rangeC = null, alpha = 1) {
  if (!chartArea) {
    return null;
  }
  
  const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
  const dataLength = data.length;
  
  for (let i = 0; i < dataLength; i++) {
    const position = dataLength === 1 ? 0 : i / (dataLength - 1);
    const color = this.getTemperatureColorWithRange(data[i], unit, rangeC);
    gradient.addColorStop(position, alpha === 1 ? color : this.withAlpha(color, alpha));
  }
  
  return gradient;
}

/**
 * The same color at another opacity, for rgb(), rgba() and hex colors. Other
 * CSS colors (names, hsl, variables) come back as a neutral translucent grey.
 */
withAlpha(color, alpha) {
  const value = String(color || '').trim();
  const rgb = value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  }
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].replace(/./g, '$&$&') : hex[1];
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(127, 127, 127, ${alpha})`;
}

/**
 * Pixel span [start, end] of one category column on the chart's x scale,
 * clipped to the chart area. Works with the reversed (RTL) scale too.
 */
getColumnBounds(chart, index) {
  const xScale = chart.scales.x;
  const area = chart.chartArea;
  const count = (chart.data.labels || []).length;
  const center = xScale.getPixelForValue(index);
  const step = count > 1
    ? Math.abs(xScale.getPixelForValue(1) - xScale.getPixelForValue(0))
    : area.right - area.left;
  return [Math.max(area.left, center - step / 2), Math.min(area.right, center + step / 2)];
}

drawChart({ config, language, weather, forecastItems } = this) {
  const self = this; // Capture component instance for use in Chart.js callbacks

  // No canvas is rendered when the forecast is hidden, so bail out before the
  // lookup below reports a missing element.
  if (config.show_forecast === false) {
    if (this.forecastChart) {
      this.forecastChart.destroy();
      this.forecastChart = null;
    }
    return;
  }

  if (!this.forecasts || !this.forecasts.length) {
    return [];
  }

  const chartCanvas = this.renderRoot && this.renderRoot.querySelector('#forecastChart');
  if (!chartCanvas) {
    console.error('Canvas element not found:', this.renderRoot);
    return;
  }

  if (this.forecastChart) {
    this.forecastChart.destroy();
  }
  var tempUnit = this.unitTemperature || this._hass.config.unit_system.temperature;
  const displayPrecipUnit = this.getDisplayPrecipitationUnit();
  const precipUnit = config.forecast.precipitation_type === 'probability'
    ? '%'
    : this.ll('units')[displayPrecipUnit] || displayPrecipUnit;
  // computeForecastData already converted rainfall to the display unit.
  const formatPrecipitationValue = (rawValue) => {
    const numericValue = Number(rawValue);
    return Number.isFinite(numericValue) ? numericValue : rawValue;
  };
  const data = this.computeForecastData();
  // updateChart() swaps the data on this chart instance without rebuilding the
  // callbacks below, so they read the current slice from here, not `data`.
  this._chartData = data;
  const tempColorRange = this.getTemperatureRangeC(data.tempHigh, tempUnit);
  // Lows have gaps (null) where a forecast item has none; keep them out of the axis range.
  const temperatures = [...data.tempHigh, ...data.tempLow].filter(Number.isFinite);

  // Read theme variables from the card itself, so view- and card-level themes
  // (and card-mod) apply, not only the page theme set on <body>.
  var style = getComputedStyle(this);
  var backgroundColor = style.getPropertyValue('--card-background-color');
  var textColor = style.getPropertyValue('--primary-text-color');
  var dividerColor = style.getPropertyValue('--divider-color');
  const canvas = this.renderRoot.querySelector('#forecastChart');
  if (!canvas) {
    requestAnimationFrame(() => this.drawChart());
    return;
  }

  const ctx = canvas.getContext('2d');

  const precipMax = config.forecast.precipitation_type === 'probability'
    ? 100
    : this.getPrecipitationAxisMax(displayPrecipUnit, config.forecast.type === 'hourly');

  Chart.defaults.elements.line.fill = false;
  Chart.defaults.elements.line.tension = 0.3;
  Chart.defaults.elements.line.borderWidth = 1.5;
  Chart.defaults.elements.point.radius = 2;
  Chart.defaults.elements.point.hitRadius = 10;

  var datasets = [
    {
      label: this.ll('tempHi'),
      type: 'line',
      data: data.tempHigh,
      yAxisID: 'TempAxis',
      borderColor: config.forecast.use_color_thresholds 
        ? (context) => {
            if (context.chart.chartArea) {
              return this.createTemperatureGradient(context.chart.data.datasets[0].data, tempUnit, context.chart.ctx, context.chart.chartArea, tempColorRange);
            }
            return config.forecast.temperature1_color;
          }
        : config.forecast.temperature1_color,
      backgroundColor: config.forecast.use_color_thresholds
        ? (context) => {
            if (context.chart.chartArea) {
              return this.createTemperatureGradient(context.chart.data.datasets[0].data, tempUnit, context.chart.ctx, context.chart.chartArea, tempColorRange);
            }
            return config.forecast.temperature1_color;
          }
        : config.forecast.temperature1_color,
      segment: {
        borderColor: config.forecast.use_color_thresholds
          ? (ctx) => {
              const temp = ctx.p1.parsed.y;
              return this.getTemperatureColorWithRange(temp, tempUnit, tempColorRange);
            }
          : undefined,
      },
      // Shade between the high and the low line. Scriptable, because the
      // gradient needs the chart area, which exists only after the first layout.
      fill: config.forecast.fill_temperature_range
        ? (context) => {
            const chart = context.chart;
            let color = config.forecast.temperature_range_color;
            if (!color && config.forecast.use_color_thresholds && chart.chartArea) {
              color = this.createTemperatureGradient(chart.data.datasets[0].data, tempUnit, chart.ctx, chart.chartArea, tempColorRange, 0.25);
            }
            color = color || this.withAlpha(config.forecast.temperature1_color, 0.2);
            return { target: 1, above: color, below: color };
          }
        : false,
    },
    {
      label: this.ll('tempLo'),
      type: 'line',
      data: data.tempLow,
      yAxisID: 'TempAxis',
      borderDash: [5, 5],
      borderColor: config.forecast.temperature2_color,
      backgroundColor: config.forecast.temperature2_color,
    },
    {
      label: this.ll('precip'),
      type: 'bar',
      data: data.precip,
      yAxisID: 'PrecipAxis',
      borderColor: config.forecast.precipitation_color,
      backgroundColor: config.forecast.precipitation_color,
      barPercentage: config.forecast.precip_bar_size / 100,
      categoryPercentage: 1.0,
      datalabels: {
        display: function (context) {
          // Hides the value printed on each bar; the bars themselves stay.
          if (config.forecast.show_precipitation_labels === false) {
            return false;
          }
          return context.dataset.data[context.dataIndex] > 0 ? 'true' : false;
        },
      formatter: function (value, context) {
        const precipitationType = config.forecast.precipitation_type;

        const rainfallRaw = context.dataset.data[context.dataIndex];
        const rainfall = formatPrecipitationValue(rainfallRaw);
        const item = self._chartData.forecast[context.dataIndex];
        const probability = item ? item.precipitation_probability : undefined;

        let formattedValue;
        if (precipitationType === 'rainfall') {
          if (probability !== undefined && probability !== null && config.forecast.show_probability) {
            formattedValue = `${rainfall > 9 ? Math.round(rainfall) : rainfall.toFixed(1)} ${precipUnit}\n${Math.round(probability)}%`;
          } else {
            formattedValue = `${rainfall > 9 ? Math.round(rainfall) : rainfall.toFixed(1)} ${precipUnit}`;
          }
        } else {
          formattedValue = `${rainfall > 9 ? Math.round(rainfall) : rainfall.toFixed(1)} ${precipUnit}`;
        }

        formattedValue = formattedValue.replace('\n', '\n\n');

        // Canvas labels need explicit bidi context because the chart stays LTR.
        if (document.dir === 'rtl') {
          formattedValue = formattedValue.split('\n')
            .map((line) => line ? `\u202B${line}\u202C` : line)
            .join('\n');
        }

        return formattedValue;
      },
        textAlign: 'center',
        textBaseline: 'middle',
        align: 'top',
        anchor: 'start',
        offset: -10,
      },
    },
  ];

  const chart_text_color = (config.forecast.chart_text_color === 'auto') ? textColor : config.forecast.chart_text_color;

  if (config.forecast.style === 'style2') {
    datasets[0].datalabels = {
      display: function (context) {
        return 'true';
      },
      formatter: (value, context) => {
        return this.renderBidiMeasurement(context.dataset.data[context.dataIndex] + '°');
      },
      align: 'top',
      anchor: 'center',
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      color: config.forecast.use_color_thresholds
        ? (context) => this.getTemperatureColorWithRange(context.dataset.data[context.dataIndex], tempUnit, tempColorRange)
        : (chart_text_color || config.forecast.temperature1_color),
      font: {
        size: parseInt(config.forecast.labels_font_size) + 1,
        lineHeight: 0.7,
      },
    };

    datasets[1].datalabels = {
      display: (context) => Number.isFinite(context.dataset.data[context.dataIndex]),
      formatter: (value, context) => {
        return this.renderBidiMeasurement(context.dataset.data[context.dataIndex] + '°');
      },
      align: 'bottom',
      anchor: 'center',
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      color: chart_text_color || config.forecast.temperature2_color,
      font: {
        size: parseInt(config.forecast.labels_font_size) + 1,
        lineHeight: 0.7,
      },
    };
  }

  // Optional: precipitation probability as a line over the rainfall bars, on
  // its own hidden 0-100 % axis.
  if (config.forecast.show_probability_line && config.forecast.precipitation_type !== 'probability') {
    datasets.push({
      label: this.ll('precip'),
      type: 'line',
      data: data.probability,
      yAxisID: 'ProbAxis',
      borderColor: config.forecast.probability_line_color || 'rgba(25, 118, 210, 0.9)',
      backgroundColor: config.forecast.probability_line_color || 'rgba(25, 118, 210, 0.9)',
      borderDash: [3, 3],
      pointRadius: 0,
      // Monotone curves never overshoot, so the line stays within 0-100 %.
      cubicInterpolationMode: 'monotone',
      // Above the bars, which share its blue and would otherwise hide it.
      order: -1,
      datalabels: { display: false },
    });
  }

  // Optional: shade the night on hourly forecasts. Columns are night when the
  // slot is, by the same rule as the day and night condition icons.
  let nightCache = { labels: null, night: [] };
  const nightShadingPlugin = {
    id: 'nightShading',
    beforeDatasetsDraw(chart) {
      if (!config.forecast.night_shading || (config.forecast.type || 'daily') !== 'hourly' || !chart.chartArea) {
        return;
      }
      const labels = chart.data.labels || [];
      if (nightCache.labels !== labels) {
        const location = { ...self.getSunLocation(), timeZone: self.getSunTimezone() };
        nightCache = { labels, night: labels.map((dt) => !self.isForecastSlotDaytime(new Date(dt), location)) };
      }
      const area = chart.chartArea;
      const c = chart.ctx;
      c.save();
      c.fillStyle = config.forecast.night_shading_color || 'rgba(100, 120, 160, 0.15)';
      nightCache.night.forEach((isNight, index) => {
        if (isNight) {
          const [start, end] = self.getColumnBounds(chart, index);
          // Round outwards so neighbouring night columns join without a seam.
          c.fillRect(Math.floor(start), area.top, Math.ceil(end) - Math.floor(start), area.bottom - area.top);
        }
      });
      c.restore();
    },
  };

  // Optional: mark today's column (daily forecasts only) with a soft band and a bold date label.
  // Resolved on every draw: updateChart() reuses this chart instance, so labels and "today" change.
  const todayIndexOf = (labels) => (config.forecast.highlight_today && (config.forecast.type || 'daily') === 'daily'
    ? (labels || []).findIndex((dt) => self.forecastDateKey(dt) === self.forecastDateKey(new Date()))
    : -1);
  const highlightTodayPlugin = {
    id: 'highlightToday',
    beforeDatasetsDraw(chart) {
      const labels = chart.data.labels || [];
      const todayIndex = todayIndexOf(labels);
      if (todayIndex < 0) {
        return;
      }
      const area = chart.chartArea;
      if (!chart.scales.x || !area) {
        return;
      }
      const [start, end] = self.getColumnBounds(chart, todayIndex);
      const c = chart.ctx;
      c.save();
      c.fillStyle = config.forecast.highlight_today_color || 'rgba(127, 127, 127, 0.12)';
      c.fillRect(start, area.top, end - start, area.bottom - area.top);
      c.restore();
    },
  };

  this.forecastChart = new Chart(ctx, {
    type: 'bar',
    plugins: [nightShadingPlugin, highlightTodayPlugin],
    data: {
      labels: data.dateTime,
      datasets: datasets,
    },
    options: {
      color: textColor,
      maintainAspectRatio: false,
      animation: config.forecast.disable_animation === true ? { duration: 0 } : {},
      layout: {
        padding: {
          bottom: 10,
        },
      },
      scales: {
        x: {
          position: 'top',
          border: {
            width: 0,
          },
          grid: {
            drawTicks: false,
            color: dividerColor,
          },
          ticks: {
              maxRotation: 0,
              color: config.forecast.chart_datetime_color || textColor,
              font: (context) => (context.index === todayIndexOf(context.chart.data.labels) ? { weight: 'bold' } : {}),
              padding: config.forecast.precipitation_type === 'rainfall' && config.forecast.show_probability && config.forecast.type !== 'hourly' ? 4 : 10,
              callback: function (value, index, values) {
                  var datetime = this.getLabelForValue(value);
                  var dateObj = new Date(datetime);
                  var timezone = config.timezone || (self._hass && self._hass.config && self._hass.config.time_zone) || Intl.DateTimeFormat().resolvedOptions().timeZone;
                  var locale = config.locale || undefined;
        
                  var timeFormatOptions = {
                      hour12: config.use_12hour_format,
                      hour: 'numeric',
                      ...(config.use_12hour_format ? {} : { minute: 'numeric' }),
                      timeZone: timezone,
                  };

                  var time = dateObj.toLocaleTimeString(locale, timeFormatOptions);

                  // Get hours in the target timezone
                  var tzHours = parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(dateObj));
                  var tzMinutes = parseInt(new Intl.DateTimeFormat('en-US', { minute: 'numeric', timeZone: timezone }).format(dateObj));

                  if (tzHours === 0 && tzMinutes === 0 && config.forecast.type === 'hourly') {
                      var monthShort = self.getLocalizedMonthNameShort(dateObj, timezone);
                      var date = monthShort + ' ' + self.getLocalizedDayNumber(dateObj, locale, timezone);
                      time = time.replace('a.m.', 'AM').replace('p.m.', 'PM');
                      return [date, time];
                  }

                  if (config.forecast.type !== 'hourly') {
                      var weekday = self.getLocalizedDayName(dateObj, timezone);
                      
                      // Add date number if show_date_labels is enabled
                      if (config.forecast.show_date_labels) {
                          var dayNumber = self.getLocalizedDayNumber(dateObj, locale, timezone);
                          return [weekday, dayNumber];  // Return as array for multi-line display
                      }
                      
                      return weekday;
                  }

                  time = time.replace('a.m.', 'AM').replace('p.m.', 'PM');
                  return time;
              },
          },
          reverse: document.dir === 'rtl' ? true : false,
        },
        TempAxis: {
          position: 'left',
          beginAtZero: false,
          suggestedMin: Math.min(...temperatures) - 5,
          suggestedMax: Math.max(...temperatures) + 3,
          grid: {
            display: false,
            drawTicks: false,
          },
          ticks: {
            display: false,
          },
        },
        PrecipAxis: {
          position: 'right',
          suggestedMax: precipMax,
          beginAtZero: true,
          grid: {
            display: true,
            drawOnChartArea: true,
            drawTicks: false,
            lineWidth: (context) => context.tick.value === 0 ? 1 : 0,
            color: (context) => context.tick.value === 0 ? 'rgba(128, 128, 128, 0.2)' : 'transparent',
          },
          ticks: {
            display: false,
          },
        },
        ProbAxis: {
          position: 'right',
          display: false,
          min: 0,
          max: 100,
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        datalabels: {
          textAlign: 'left',
          backgroundColor: backgroundColor,
          borderColor: context => context.dataset.backgroundColor,
          borderRadius: 0,
          borderWidth: 1.5,
          padding: config.forecast.precipitation_type === 'rainfall' && config.forecast.show_probability && config.forecast.type !== 'hourly' ? 3 : 4,
          color: chart_text_color || textColor,
          font: {
            size: config.forecast.labels_font_size,
            lineHeight: 0.7,
          },
          display: (context) => Number.isFinite(context.dataset.data[context.dataIndex]),
          formatter: (value, context) => {
            return this.renderBidiMeasurement(context.dataset.data[context.dataIndex] + '°');
          },
        },
        tooltip: {
          rtl: document.dir === 'rtl',
          textDirection: document.dir === 'rtl' ? 'rtl' : 'ltr',
          caretSize: 0,
          caretPadding: 15,
          callbacks: {
            title: function (TooltipItem) {
              var datetime = TooltipItem[0].label;
              var timezone = config.timezone || (self._hass && self._hass.config && self._hass.config.time_zone) || Intl.DateTimeFormat().resolvedOptions().timeZone;
              var dateObj = new Date(datetime);
              
              var monthShort = self.getLocalizedMonthNameShort(dateObj, timezone);
              var dayNumber = self.getLocalizedDayNumber(dateObj, config.locale, timezone);
              var weekdayShort = self.getLocalizedDayName(dateObj, timezone);
              
              var timeFormatter = new Intl.DateTimeFormat(config.locale || 'en-US', {
                hour: 'numeric',
                minute: 'numeric',
                hour12: config.use_12hour_format,
                timeZone: timezone
              });
              var timeStr = timeFormatter.format(dateObj);
              
              return weekdayShort + ', ' + monthShort + ' ' + dayNumber + ', ' + timeStr;
            },
    label: (context) => {
      var label = context.dataset.label;
      var value = context.formattedValue;
      var item = this._chartData.forecast[context.dataIndex];
      var probability = item ? item.precipitation_probability : undefined;
      var unit = context.datasetIndex === 2 ? precipUnit : context.datasetIndex === 3 ? '%' : tempUnit;

      if (config.forecast.precipitation_type === 'rainfall' && context.datasetIndex === 2) {
        const rainfallRaw = context.dataset.data[context.dataIndex];
        const rainfallDisplay = formatPrecipitationValue(rainfallRaw);
        if (Number.isFinite(rainfallDisplay)) {
          value = rainfallDisplay > 9 ? Math.round(rainfallDisplay) : rainfallDisplay.toFixed(1);
        }
      }

      if (config.forecast.precipitation_type === 'rainfall' && context.datasetIndex === 2 && config.forecast.show_probability && probability !== undefined && probability !== null) {
        return label + ': ' + this.renderBidiMeasurement(value + ' ' + precipUnit + ' / ' + Math.round(probability) + '%');
      } else {
        return label + ': ' + this.renderBidiMeasurement(value + ' ' + unit);
      }
            },
          },
        },
      },
    },
  });
}

/**
 * The forecast slots on screen: past slots dropped when autoscroll is on, then
 * limited to the number of columns that fit. The chart, the icon row, the wind
 * row and the extra rows all use this, so their columns stay aligned.
 */
getVisibleForecast(forecastItems = this.forecastItems) {
  let forecast = this.forecasts || [];
  if (this.config.autoscroll) {
    const cutoff = (this.config.forecast.type === 'hourly' ? 1 : 24) * 60 * 60 * 1000;
    const now = Date.now();
    forecast = forecast.filter((item) => now - new Date(item.datetime).getTime() <= cutoff);
  }
  return forecast.slice(0, forecastItems);
}

/**
 * Suggested ceiling for the precipitation axis in the display unit, so light
 * rain does not fill the chart. Larger values still extend the axis.
 */
getPrecipitationAxisMax(displayUnit, isHourly) {
  if (this.normalizePrecipitationUnit(displayUnit) === 'in') {
    return 1;
  }
  const millimeters = isHourly ? 4 : 20;
  const converted = this.convertPrecipitation(millimeters, 'mm', displayUnit);
  return Number.isFinite(converted) ? converted : millimeters;
}

computeForecastData({ config, forecastItems } = this) {
  var forecast = this.getVisibleForecast(forecastItems);
  var roundTemp = config.forecast.round_temp == true;
  var dateTime = [];
  var tempHigh = [];
  var tempLow = [];
  var precip = [];
  var probability = [];

  const forecastType = config.forecast.type || 'daily';
  const forecastSourceTempUnit = this.getForecastEntityAttributes(forecastType).temperature_unit
    || (this.weather && this.weather.attributes.temperature_unit);

  const sourcePrecipUnit = this.getSourcePrecipitationUnit();
  const displayPrecipUnit = this.getDisplayPrecipitationUnit(sourcePrecipUnit);

  for (var i = 0; i < forecast.length; i++) {
    var d = forecast[i];
    dateTime.push(d.datetime);
    
    let highTemp = d.temperature;
    let lowTemp = d.templow;
    
    // Convert temperatures if needed
    if (this.unitTemperature && this.unitTemperature !== forecastSourceTempUnit) {
      highTemp = this.convertTemperature(highTemp, forecastSourceTempUnit, this.unitTemperature);
      if (lowTemp != null) {
        lowTemp = this.convertTemperature(lowTemp, forecastSourceTempUnit, this.unitTemperature);
      }
    }
    
    // ALWAYS round temperatures for chart display (whether roundTemp is on or not)
    highTemp = roundTemp ? Math.round(highTemp) : Math.round(highTemp * 10) / 10;
    if (lowTemp != null) {
      lowTemp = roundTemp ? Math.round(lowTemp) : Math.round(lowTemp * 10) / 10;
    }
    
    tempHigh.push(highTemp);
    // A gap keeps later lows under their own day when one item has no low.
    tempLow.push(Number.isFinite(lowTemp) ? lowTemp : null);
    probability.push(Number.isFinite(Number(d.precipitation_probability)) && d.precipitation_probability !== null
      ? Number(d.precipitation_probability)
      : null);

    if (config.forecast.precipitation_type === 'probability') {
      precip.push(d.precipitation_probability);
    } else {
      // Bars are drawn in the display unit, the same unit as the labels and
      // the axis ceiling.
      const numericPrecipitation = Number(this.convertPrecipitation(d.precipitation, sourcePrecipUnit, displayPrecipUnit));
      if (d.precipitation !== null && d.precipitation !== undefined && Number.isFinite(numericPrecipitation)) {
        precip.push(Math.round(numericPrecipitation * 100) / 100);
      } else {
        precip.push(d.precipitation);
      }
    }
  }

  return {
    forecast,
    dateTime,
    tempHigh,
    tempLow,
    precip,
    probability,
  }
}

updateChart({ forecasts, forecastChart } = this) {
  if (!forecasts || !forecasts.length) {
    return [];
  }

  const data = this.computeForecastData();
  this._chartData = data;

  if (forecastChart) {
    forecastChart.data.labels = data.dateTime;
    forecastChart.data.datasets[0].data = data.tempHigh;
    forecastChart.data.datasets[1].data = data.tempLow;
    forecastChart.data.datasets[2].data = data.precip;
    if (forecastChart.data.datasets[3]) {
      forecastChart.data.datasets[3].data = data.probability;
    }
    forecastChart.update();
  }
}

  render({config, _hass, weather} = this) {
    if (!config || !_hass) {
      return html``;
    }
    // Forecast-only mode: with the main section, clock and attributes gone, the
    // absolutely positioned daily/hourly button would land on top of the chart,
    // so the chart needs to be pushed clear of it.
    const forecastOnly = config.show_main === false;
    const showForecast = config.show_forecast !== false;
    const actionable = this.hasCardActions();

    if (!weather || !weather.attributes) {
      return html`
        <style>
          .card {
            padding-top: ${config.title ? '0px' : '16px'};
            padding-right: 16px;
            padding-bottom: 16px;
            padding-left: 16px;
          }
        </style>
        <ha-card header="${config.title}">
          <div class="card">
            Please, check your weather entity
          </div>
        </ha-card>
      `;
    }
    return html`
      <style>
        ha-card {
          ${config.title ? 'padding-bottom: 8px;' : ''}
          position: relative;
          overflow: hidden;
        }
        ha-icon {
          color: var(--paper-item-icon-color);
        }
        img {
          width: ${config.icons_size}px;
          height: ${config.icons_size}px;
        }
        .card {
          padding-top: ${config.title ? '0px' : '16px'};
          padding-right: 16px;
          padding-bottom: ${config.show_last_changed === true ? '2px' : '16px'};
          padding-left: 16px;
        }
        .main {
          display: flex;
          align-items: ${config.title ? 'center' : 'flex-start'};
          justify-content: space-between;
          font-size: ${config.current_temp_size}px;
          margin-bottom: 10px;
          position: ${config.title ? 'relative' : 'static'};
          ${config.title ? '' : `min-height: ${59 + (parseInt(config.main_icon_size, 10) || 150) / 2}px;`}
        }
        .main .weather-icon {
          position: absolute;
          left: 50%;
          top: ${config.title ? '10px' : '75px'};
          transform: translate(-50%, -50%);
          z-index: 1;
        }
        .main .weather-icon ha-icon {
          --mdc-icon-size: ${config.main_icon_size || 150}px;
        }
        .main .weather-icon img {
          width: ${config.main_icon_size || 150}px;
          height: ${config.main_icon_size || 150}px;
        }
        .main .temp-info {
          display: flex;
          flex-direction: column;
          z-index: 2;
        }
        .main .temp-info > div {
          line-height: 1.2;
        }
        .main .current-temp {
          font-size: ${config.current_temp_size}px;
          font-weight: 300;
          direction: ltr;
          unicode-bidi: isolate;
        }
        .main .current-condition {
          font-size: 18px;
          margin-top: 4px;
        }
        .current-time {
          position: absolute;
          top: 24px;
          right: 16px;
          inset-inline-start: initial;
          inset-inline-end: 16px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          z-index: 1;
          font-size: ${config.time_size}px;
        }
        .date-text {
          font-size: ${config.day_date_size}px;
          color: var(--secondary-text-color);
          direction: var(--direction, inherit);
        }
        .main span {
          font-size: 18px;
          color: var(--secondary-text-color);
        }
        .attributes {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
      	  font-weight: 300;
        }
        .chart-container {
          position: relative;
          height: ${config.forecast.chart_height}px;
          width: 100%;
          direction: ltr;
          margin-top: ${forecastOnly && config.show_forecast_toggle ? '40px' : '0px'};
        }
        .conditions {
          display: flex;
          justify-content: space-around;
          align-items: center;
          margin: 0px 5px 0px 5px;
      	  cursor: pointer;
        }
        .forecast-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 1px;
        }
        .extra-row {
          display: flex;
          justify-content: space-around;
          align-items: center;
          margin: 0px 5px;
          font-weight: 300;
          cursor: pointer;
        }
        .extra-detail {
          display: flex;
          flex: 1 1 0;
          justify-content: center;
          align-items: center;
          margin: 1px;
          min-width: 0;
        }
        .extra-detail ha-icon {
          --mdc-icon-size: 15px;
          margin-inline-end: 1px;
        }
        .extra-value {
          font-size: 11px;
        }
        .extra-unit {
          font-size: 9px;
          margin-inline-start: 1px;
        }
        .wind-details {
          display: flex;
          justify-content: space-around;
          align-items: center;
          font-weight: 300;
        }
        .wind-detail {
          display: flex;
          align-items: center;
          margin: 1px;
        }
        .wind-detail ha-icon {
          --mdc-icon-size: 15px;
          margin-right: 1px;
          margin-inline-start: initial;
          margin-inline-end: 1px;
        }
        .wind-icon {
          margin-right: 1px;
          margin-inline-start: initial;
          margin-inline-end: 1px;
          position: relative;
	        bottom: 1px;
        }
        .wind-speed {
          font-size: 11px;
          margin-right: 1px;
          margin-inline-start: initial;
          margin-inline-end: 1px;
        }
        .wind-unit {
          font-size: 9px;
          margin-left: 1px;
          margin-inline-start: 1px;
          margin-inline-end: initial;
        }
        .main .feels-like {
          font-size: 13px;
          margin-top: 5px;
          font-weight: 400;
        }
        .main .description {
	        font-style: italic;
          font-size: 13px;
          margin-top: 5px;
          font-weight: 400;
        }
        .card-version {
          position: absolute;
          bottom: 2px;
          right: 6px; /* physical, not inset-inline-end: bottom-right in RTL too */
          font-size: 9px;
          line-height: 1;
          color: var(--secondary-text-color);
          opacity: 0.6;
          pointer-events: none;
        }
        .updated {
          font-size: 13px;
          align-items: right;
          font-weight: 300;
          margin-bottom: 1px;
        }
        .forecast-toggle {
          cursor: pointer;
          background: var(--primary-color);
          color: var(--text-primary-color);
          border: none;
          border-radius: 4px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 700;
          opacity: 0.9;
          transition: opacity 0.2s;
          margin-top: 4px;
        }
        .forecast-toggle:hover {
          opacity: 1;
        }
        .attributes .water-percent,
        .attributes .pressure,
        .attributes .dew-point,
        .attributes .visibility,
        .attributes .uv-index,
        .attributes .wind-speed-attribute,
        .attributes .wind-gust-speed {
          direction: ltr;
          unicode-bidi: isolate;
        }
        .forecast-toggle {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .forecast-toggle .auto-rotate-icon {
          --mdc-icon-size: 14px;
          color: inherit;
        }
        .actionable {
          cursor: pointer;
          -webkit-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }
        .actionable:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }
      </style>

      <ha-card header="${config.title}">
        <div class="card">
          ${this.renderClock()}
          ${forecastOnly ? '' : html`
            <div class="current ${actionable ? 'actionable' : ''}"
              role=${actionable ? 'button' : nothing}
              tabindex=${actionable ? '0' : nothing}
              @pointerdown=${this._onActionPointerDown}
              @pointermove=${this._onActionPointerMove}
              @pointerup=${this._onActionPointerUp}
              @pointercancel=${this._onActionPointerCancel}
              @pointerleave=${this._onActionPointerCancel}
              @contextmenu=${this._onActionContextMenu}
              @keydown=${this._onActionKeyDown}>
              ${this.renderMain()}
              ${this.renderAttributes()}
            </div>
          `}
          ${showForecast ? html`
            <div class="chart-container ${actionable ? 'actionable' : ''}"
              role=${actionable ? 'button' : nothing}
              tabindex=${actionable ? '0' : nothing}
              @pointerdown=${this._onActionPointerDown}
              @pointermove=${this._onActionPointerMove}
              @pointerup=${this._onActionPointerUp}
              @pointercancel=${this._onActionPointerCancel}
              @pointerleave=${this._onActionPointerCancel}
              @contextmenu=${this._onActionContextMenu}
              @keydown=${this._onActionKeyDown}>
              <canvas id="forecastChart"></canvas>
            </div>
          ` : ''}
          ${this.renderForecastConditionIcons()}
          ${this.renderWind()}
          ${this.renderExtraRows()}
          ${this.renderLastUpdated()}
        </div>
        <div class="card-version">v${CARD_VERSION}</div>
      </ha-card>
    `;
  }

renderMain({ config, sun, weather, temperature, feels_like, description } = this) {
  if (config.show_main === false)
    return html``;

  const showFeelsLike = config.show_feels_like;
  const showDescription = config.show_description;
  const showCurrentCondition = config.show_current_condition !== false;
  const showTemperature = config.show_temperature !== false;

  let roundedTemperature = parseFloat(temperature);
  
  // Temperature conversion
  if (this.unitTemperature && this.unitTemperature !== this.weather.attributes.temperature_unit) {
    roundedTemperature = this.convertTemperature(
      roundedTemperature, 
      this.weather.attributes.temperature_unit, 
      this.unitTemperature
    );
  }
  
  if (!isNaN(roundedTemperature) && roundedTemperature % 1 !== 0) {
    roundedTemperature = Math.round(roundedTemperature * 10) / 10;
  }

  let roundedFeelsLike = parseFloat(feels_like);
  
  // Feels like conversion
  if (this.unitTemperature && this.unitTemperature !== this.weather.attributes.temperature_unit) {
    roundedFeelsLike = this.convertTemperature(
      roundedFeelsLike, 
      this.weather.attributes.temperature_unit, 
      this.unitTemperature
    );
  }
  
  if (!isNaN(roundedFeelsLike) && roundedFeelsLike % 1 !== 0) {
    roundedFeelsLike = Math.round(roundedFeelsLike * 10) / 10;
  }

  // Day/night for the current-conditions icon and condition text. When the card
  // explicitly targets a sun location (multi-location dashboards), compute it
  // there instead of using the single home `sun.sun` entity, which only reflects
  // the HA server location.
  let currentSunState = sun ? sun.state : 'above_horizon';
  let currentCondition = weather.state;
  if (config.sun_latitude != null && config.sun_longitude != null) {
    const isDay = this.isDaytimeAt(new Date(), {
      lat: config.sun_latitude,
      lon: config.sun_longitude
    });
    if (isDay != null) {
      currentSunState = isDay ? 'above_horizon' : 'below_horizon';
      // The weather entity's day/night follows its own integration location, so
      // it can report `clear-night` while it is daytime at the card's location
      // (or `sunny` while it is night). `sunny`⇄`clear-night` is the only HA
      // condition with a night-specific state, so normalise it to match.
      if (isDay && currentCondition === 'clear-night') {
        currentCondition = 'sunny';
      } else if (!isDay && currentCondition === 'sunny') {
        currentCondition = 'clear-night';
      }
    }
  }

  return html`
    <div class="main">
      <!-- Left: Temperature and condition info -->
      <div class="temp-info">
        <div class="current-temp">
          ${showTemperature ? html`${roundedTemperature}<span>${this.unitTemperature || this.getUnit('temperature')}</span>` : ''}
        </div>
        ${showCurrentCondition ? html`
          <div class="current-condition">
            ${this.localizeCondition(currentCondition)}
          </div>
        ` : ''}
        ${showFeelsLike && roundedFeelsLike ? html`
          <div class="feels-like">
            ${this.ll('feelsLike')}
            ${roundedFeelsLike}${this.unitTemperature || this.getUnit('temperature')}
          </div>
        ` : ''}
        ${showDescription ? html`
          <div class="description">
            ${description}
          </div>
        ` : ''}
      </div>
      
      <!-- Center: Large weather icon -->
      <div class="weather-icon">
        ${this.renderWeatherIcon(currentCondition, currentSunState)}
      </div>
      
    </div>
  `;
}

updateClock() {
  const timezone = this.getTimezone();
  const use12HourFormat = this.config.use_12hour_format;
  const showSeconds = this.config.show_time_seconds === true;
  const showHourLeadingZero = this.config.show_hour_leading_zero !== false;
  const showDay = this.config.show_day;
  const showDate = this.config.show_date;
  const currentDate = new Date();
  
  // Build the full time string using Intl.DateTimeFormat, then fix the hour for leading zero control
  const locale = this.config.locale || 'en-US';
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: use12HourFormat,
    timeZone: timezone
  });
  const parts = timeFormatter.formatToParts(currentDate);

  // Rebuild the time string, adjusting the hour part for leading zero preference
  var currentTime = '';
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (part.type === 'hour') {
      var h = part.value;
      if (showHourLeadingZero && h.length === 1) {
        h = '0' + h;
      } else if (!showHourLeadingZero && h.length === 2 && h[0] === '0') {
        h = h.slice(1);
      }
      currentTime += h;
    } else {
      currentTime += part.value;
    }
  }

  const currentDayOfWeek = this.getLocalizedDayNameFull(currentDate, timezone);
  const selectedLocale = this.config.locale || this.language || 'en';
  const currentDateFormatted = new Intl.DateTimeFormat(selectedLocale, {
    day: 'numeric', month: 'long', timeZone: timezone
  }).format(currentDate);

  const cardDiv = this.shadowRoot.querySelector('.card');
  if (cardDiv) {
    const clockElement = cardDiv.querySelector('#digital-clock');
    if (clockElement) {
      clockElement.textContent = currentTime;
    }
    if (showDay) {
      const dayElement = cardDiv.querySelector('.date-text.day');
      if (dayElement) {
        dayElement.textContent = currentDayOfWeek;
      }
    }
    if (showDate) {
      const dateElement = cardDiv.querySelector('.date-text.date');
      if (dateElement) {
        dateElement.textContent = currentDateFormatted;
      }
    }
  }
}

renderClock({ config } = this) {
  // `show_main: false` is the card's forecast-only mode. The clock, day and date
  // belong to the main section and go with it; the daily/hourly button stays,
  // since it drives the forecast that is still on screen.
  const showMain = config.show_main !== false;
  const showTime = showMain && config.show_time;
  const showDay = config.show_day;
  const showDate = config.show_date;
  const showForecastToggle = config.show_forecast_toggle && config.show_forecast !== false;

  // Clock update logic
  if (showTime) {
    if (!this.clockInterval) {
      this.clockInterval = setInterval(() => this.updateClock(), 1000);
      // Initial update
      setTimeout(() => this.updateClock(), 0);
    }
  } else if (this.clockInterval) {
    clearInterval(this.clockInterval);
    this.clockInterval = null;
  }

  // Nothing to render in this container if neither the clock nor the toggle is enabled
  if (!showTime && !showForecastToggle) {
    return html``;
  }

  return html`
    <div class="current-time">
      ${showTime ? html`
        <div id="digital-clock"></div>
        ${showDay ? html`<div class="date-text day"></div>` : ''}
        ${showDay && showDate ? html` ` : ''}
        ${showDate ? html`<div class="date-text date"></div>` : ''}
      ` : ''}
      ${showForecastToggle ? html`
        <button class="forecast-toggle"
          @click="${this.handleForecastToggleClick.bind(this)}"
          title="${this._canAutoRotate ? this.ll('auto') : ''}">
          ${this.config.forecast.type === 'daily' ? this.ll('hourly') : this.ll('daily')}
          ${this._canAutoRotate ? html`<ha-icon class="auto-rotate-icon" icon="mdi:autorenew" aria-label="${this.ll('auto')}"></ha-icon>` : ''}
        </button>
      ` : ''}
    </div>
  `;
}

renderAttributes({ config, humidity, pressure, windSpeed, windDirection, sun, language, uv_index, dew_point, wind_gust_speed, visibility } = this) {
  // The attributes row describes current conditions, so it is part of the main
  // section and is hidden in forecast-only mode (`show_main: false`).
  if (config.show_main === false || config.show_attributes == false)
    return html``;

  let dWindSpeed = this.convertWindSpeed(windSpeed);
  const dewPointNumber = Number(dew_point);
  let dDewPoint = dew_point;
  const dewPointDisplayUnit = this.unitTemperature || this.weather.attributes.temperature_unit;
  if (Number.isFinite(dewPointNumber)) {
    dDewPoint = dewPointNumber;
    if (this.unitTemperature && this.unitTemperature !== this.weather.attributes.temperature_unit) {
      dDewPoint = this.convertTemperature(
        dDewPoint,
        this.weather.attributes.temperature_unit,
        this.unitTemperature
      );
    }
    dDewPoint = Math.round(dDewPoint);
  }
  const dWindGustSpeed = this.convertWindSpeed(wind_gust_speed);

  const { value: dPressure, unit: pressureUnit } = this.formatPressure(pressure, this.weather.attributes.pressure_unit, this.unitPressure);

  const showHumidity = config.show_humidity !== false;
  const showPressure = config.show_pressure !== false;
  const showWindDirection = config.show_wind_direction !== false;
  const showWindSpeed = config.show_wind_speed !== false;
  const showSun = config.show_sun !== false;
  const showUv = config.show_uv !== false;
  const showDewpoint = config.show_dew_point == true;
  const showWindgustspeed = config.show_wind_gust_speed == true;
  const showVisibility = config.show_visibility == true;
  const visibilityDisplayUnit = this.unitVisibility || this.visibilitySourceUnit || (this.weather && this.weather.attributes.visibility_unit);
  let dVisibility = visibility;
  if (showVisibility && visibility !== undefined) {
    dVisibility = this.convertVisibility(visibility, this.visibilitySourceUnit, visibilityDisplayUnit);
  }

return html`
    <div class="attributes">
      ${((showHumidity && humidity !== undefined) || (showPressure && dPressure !== undefined) || (showDewpoint && dew_point !== undefined) || (showVisibility && dVisibility !== undefined)) ? html`
        <div>
          ${showHumidity && humidity !== undefined ? html`
            <ha-icon icon="hass:water-percent"></ha-icon> <span class="water-percent">${humidity} %</span><br>
          ` : ''}
          ${showPressure && dPressure !== undefined ? html`
            <ha-icon icon="hass:gauge"></ha-icon> <span class="pressure">${dPressure} ${this.ll('units')[pressureUnit] || pressureUnit}</span> <br>
          ` : ''}
          ${showDewpoint && dew_point !== undefined ? html`
            <ha-icon icon="hass:thermometer-water"></ha-icon> <span class="dew-point">${dDewPoint} ${dewPointDisplayUnit}</span> <br>
          ` : ''}
          ${showVisibility && dVisibility !== undefined ? html`
            <ha-icon icon="hass:eye"></ha-icon> <span class="visibility">${dVisibility} ${visibilityDisplayUnit}</span>
          ` : ''}
        </div>
      ` : ''}
      ${((showSun && sun !== undefined) || (showUv && uv_index !== undefined)) ? html`
        <div>
          ${showUv && uv_index !== undefined ? html`
            <div>
              <ha-icon icon="hass:white-balance-sunny"></ha-icon> <span class="uv-index">UV: ${Math.round(uv_index * 10) / 10}</span>
            </div>
          ` : ''}
          ${showSun && sun !== undefined ? html`
            <div>
              ${this.renderSun({ sun, language })}
            </div>
          ` : ''}
        </div>
      ` : ''}
      ${((showWindDirection && windDirection !== undefined) || (showWindSpeed && dWindSpeed !== undefined)) ? html`
        <div>
          ${showWindDirection && windDirection !== undefined && windDirection !== null ? html`
            ${this.getWindDirIcon(windDirection) ? html`<ha-icon icon="hass:${this.getWindDirIcon(windDirection)}"></ha-icon> ` : ''}<span class="wind-direction">${this.getWindDir(windDirection)}</span> <br>
          ` : ''}
          ${showWindSpeed && dWindSpeed !== undefined ? html`
            <ha-icon icon="hass:weather-windy"></ha-icon>
            <span class="wind-speed-attribute">${dWindSpeed} ${this.ll('units')[this.unitSpeed] || this.unitSpeed}</span> <br>
          ` : ''}
          ${showWindgustspeed && wind_gust_speed !== undefined ? html`
            <ha-icon icon="hass:weather-windy-variant"></ha-icon>
            <span class="wind-gust-speed">${dWindGustSpeed} ${this.ll('units')[this.unitSpeed] || this.unitSpeed}</span>
          ` : ''}
        </div>
      ` : ''}
    </div>
`;
}

renderSun({ sun, language } = this) {
  if (sun == undefined) {
    return html``;
  }

  const config = this.config;
  const use12HourFormat = this.config.use_12hour_format;
  const timezone = config.sun_timezone
    || config.timezone
    || (this._hass && this._hass.config && this._hass.config.time_zone)
    || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const locale = this.config.locale || undefined;

  const timeOptions = {
    hour12: use12HourFormat,
    hour: 'numeric',
    minute: 'numeric',
    timeZone: timezone
  };

  const lat = this.config.sun_latitude != null ? this.config.sun_latitude
    : (this._hass && this._hass.config && this._hass.config.latitude);
  const lon = this.config.sun_longitude != null ? this.config.sun_longitude
    : (this._hass && this._hass.config && this._hass.config.longitude);
  let sunriseDate, sunsetDate;
  if (lat != null && lon != null) {
    const now = new Date();
    const { sunrise: todaySunrise, sunset: todaySunset } = this.calculateSunriseSunset(now, lat, lon);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const { sunrise: tomorrowSunrise, sunset: tomorrowSunset } = this.calculateSunriseSunset(tomorrow, lat, lon);
    sunriseDate = todaySunrise > now ? todaySunrise : tomorrowSunrise;
    sunsetDate = todaySunset > now ? todaySunset : tomorrowSunset;
  } else {
    sunriseDate = new Date(sun.attributes.next_rising);
    sunsetDate = new Date(sun.attributes.next_setting);
  }

  return html`
    <ha-icon icon="mdi:weather-sunset-up"></ha-icon>
      ${sunriseDate ? sunriseDate.toLocaleTimeString(locale, timeOptions) : '--'}<br>
    <ha-icon icon="mdi:weather-sunset-down"></ha-icon>
      ${sunsetDate ? sunsetDate.toLocaleTimeString(locale, timeOptions) : '--'}
  `;
}

renderForecastConditionIcons({ config, forecastItems } = this) {
  if (config.show_forecast === false || config.forecast.condition_icons === false) {
    return html``;
  }

  const forecast = this.getVisibleForecast(forecastItems);

  return html`
    <div class="conditions" @click="${(e) => this.showMoreInfo(config.entity)}">
      ${(() => {
        const location = { ...this.getSunLocation(), timeZone: this.getSunTimezone() };
        return forecast.map((item) => {
        const isDayTime = config.forecast.type === 'daily'
          || this.isForecastSlotDaytime(new Date(item.datetime), location);

        const sunState = isDayTime ? 'above_horizon' : 'below_horizon';

        return html`
          <div class="forecast-item">
            ${this.renderWeatherIcon(item.condition, sunState)}
          </div>
        `;
      });
      })()}
    </div>
  `;
}

renderWind({ config, weather, windSpeed, windDirection, forecastItems } = this) {
  const showWindForecast = config.show_forecast !== false && config.forecast.show_wind_forecast !== false;

  if (!showWindForecast) {
    return html``;
  }

  const forecast = this.getVisibleForecast(forecastItems);

  const hasWindData = (item) => Number.isFinite(Number(item.wind_speed))
    || (item.wind_bearing !== undefined && item.wind_bearing !== null);

  // Not every forecast provider reports wind. Rendering the row regardless left
  // a strip of bare unit labels under the chart, so drop it entirely when no
  // forecast item carries wind.
  if (!forecast.some(hasWindData)) {
    return html``;
  }

  const forecastType = config.forecast.type || 'daily';
  const forecastWindUnit = this.getForecastEntityAttributes(forecastType).wind_speed_unit
    || (this.weather && this.weather.attributes.wind_speed_unit);

  return html`
    <div class="wind-details">
      ${forecast.map((item) => {
        const numericWindSpeed = Number(item.wind_speed);
        const hasSpeed = Number.isFinite(numericWindSpeed);
        const bearingIcon = item.wind_bearing !== undefined && item.wind_bearing !== null
          ? this.getWindDirIcon(item.wind_bearing)
          : null;

        // An individual gap still needs its column, or the row stops lining up
        // with the chart and the condition icons above it.
        if (!hasSpeed && !bearingIcon) {
          return html`<div class="wind-detail"></div>`;
        }

        const dWindSpeed = this.convertWindSpeed(item.wind_speed, this.unitSpeed, forecastWindUnit);

        return html`
          <div class="wind-detail">
            ${bearingIcon ? html`<ha-icon class="wind-icon" icon="hass:${bearingIcon}"></ha-icon>` : ''}
            ${hasSpeed ? html`
              <span class="wind-speed">${dWindSpeed}</span>
              <span class="wind-unit">${this.ll('units')[this.unitSpeed] || this.unitSpeed}</span>
            ` : ''}
          </div>
        `;
      })}
    </div>
  `;
}

getExtraRows() {
  const rows = this.config && this.config.forecast && this.config.forecast.extra_rows;
  return Array.isArray(rows) ? rows.filter((row) => row && row.entity) : [];
}

/**
 * Calendar date (YYYY-MM-DD) of a forecast item in the card's time zone, so it
 * can be matched against per-day values that a sensor provides.
 */
forecastDateKey(datetime) {
  const date = new Date(datetime);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    // Build the key from parts: the formatted string of a locale is not a stable format.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: this.getSunTimezone(), year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const part = (type) => (parts.find((p) => p.type === type) || {}).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch (e) {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Extra rows of per-day values under the forecast (e.g. sunshine hours or a PV
 * yield forecast), read from a list attribute of any entity:
 *   forecast:
 *     extra_rows:
 *       - entity: sensor.sunshine
 *         attribute: days        # list of objects
 *         date_key: date         # YYYY-MM-DD (default "date")
 *         value_key: hours       # (default "value")
 *         unit: h
 *         icon: mdi:weather-sunny
 *         icon_color: '#f6b100'  # optional
 *         decimals: 0
 * Only daily forecasts; values are matched by calendar date, missing days stay empty.
 */
renderExtraRows({ config, forecastItems } = this) {
  const rows = this.getExtraRows();
  if (!rows.length || config.show_forecast === false || (config.forecast.type || 'daily') !== 'daily' || !this._hass) {
    return html``;
  }

  const forecast = this.getVisibleForecast(forecastItems);
  if (!forecast.length) {
    return html``;
  }
  const dateKeys = forecast.map((item) => this.forecastDateKey(item.datetime));

  return rows.map((row) => {
    const stateObj = this._hass.states[row.entity];
    const list = stateObj && stateObj.attributes ? stateObj.attributes[row.attribute || 'forecast'] : null;
    if (!Array.isArray(list)) {
      return html``;
    }
    const dateKey = row.date_key || 'date';
    const valueKey = row.value_key || 'value';
    const byDate = {};
    list.forEach((entry) => {
      if (entry && entry[dateKey] != null) {
        byDate[String(entry[dateKey]).slice(0, 10)] = entry[valueKey];
      }
    });
    if (!dateKeys.some((key) => key in byDate)) {
      return html``;
    }
    // toFixed() throws outside 0..100; ignore invalid values instead of breaking the card.
    const d = Number(row.decimals);
    const decimals = row.decimals != null && row.decimals !== '' && Number.isInteger(d) && d >= 0 && d <= 100 ? d : null;

    return html`
      <div class="extra-row" @click="${() => this.showMoreInfo(row.entity)}">
        ${dateKeys.map((key) => {
          const value = Number(byDate[key]);
          if (byDate[key] === null || byDate[key] === undefined || byDate[key] === '' || !Number.isFinite(value)) {
            return html`<div class="extra-detail"></div>`;
          }
          return html`
            <div class="extra-detail">
              ${row.icon ? html`<ha-icon icon="${row.icon}" style="${row.icon_color ? `color: ${row.icon_color}` : ''}"></ha-icon>` : ''}
              <span class="extra-value">${decimals !== null ? value.toFixed(decimals) : value}</span>
              ${row.unit ? html`<span class="extra-unit">${row.unit}</span>` : ''}
            </div>
          `;
        })}
      </div>
    `;
  });
}

renderLastUpdated() {
  const lastUpdatedString = this.weather.last_changed;
  const lastUpdatedTimestamp = new Date(lastUpdatedString).getTime();
  const currentTimestamp = Date.now();
  const timeDifference = currentTimestamp - lastUpdatedTimestamp;

  const minutesAgo = Math.floor(timeDifference / (1000 * 60));
  const hoursAgo = Math.floor(minutesAgo / 60);

  const locale = this.language;

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  let formattedLastUpdated;

  if (hoursAgo > 0) {
    formattedLastUpdated = formatter.format(-hoursAgo, 'hour');
  } else {
    formattedLastUpdated = formatter.format(-minutesAgo, 'minute');
  }

  const showLastUpdated = this.config.show_last_changed == true;

  if (!showLastUpdated) {
    return html``;
  }

  return html`
    <div class="updated">
      <div>
        ${formattedLastUpdated}
      </div>
    </div>
  `;
}

  _fire(type, detail, options) {
    const node = this.shadowRoot;
    options = options || {};
    detail = (detail === null || detail === undefined) ? {} : detail;
    const event = new Event(type, {
      bubbles: options.bubbles === undefined ? true : options.bubbles,
      cancelable: Boolean(options.cancelable),
      composed: options.composed === undefined ? true : options.composed
    });
    event.detail = detail;
    node.dispatchEvent(event);
    return event;
  }

  showMoreInfo(entity) {
    this._fire('hass-more-info', { entityId: entity });
  }

  hasCardActions() {
    const { tap_action, hold_action, double_tap_action } = this.config;
    return hasAction(tap_action) || hasAction(hold_action) || hasAction(double_tap_action);
  }

  /**
   * Run a configured tap, hold or double-tap action. Home Assistant handles
   * `hass-action` itself, using `entity` for more-info and toggle.
   */
  handleCardAction(action) {
    const key = { tap: 'tap_action', hold: 'hold_action', double_tap: 'double_tap_action' }[action];
    if (!key || !hasAction(this.config[key])) {
      return;
    }
    const { entity, tap_action, hold_action, double_tap_action } = this.config;
    this._fire('hass-action', { config: { entity, tap_action, hold_action, double_tap_action }, action });
  }

  // Pointer and key handlers for the actionable areas (current conditions and
  // chart). Lit calls them with the card as `this`.
  _onActionPointerDown(ev) {
    if (ev.button === 0 && this.hasCardActions()) {
      this._gestures.down(ev.clientX, ev.clientY);
    }
  }

  _onActionPointerMove(ev) {
    this._gestures.move(ev.clientX, ev.clientY);
  }

  _onActionPointerUp() {
    this._gestures.up();
  }

  _onActionPointerCancel() {
    this._gestures.cancel();
  }

  _onActionContextMenu(ev) {
    // A long press on touch opens the context menu; it belongs to hold_action.
    if (hasAction(this.config.hold_action)) {
      ev.preventDefault();
    }
  }

  _onActionKeyDown(ev) {
    if ((ev.key === 'Enter' || ev.key === ' ') && this.hasCardActions()) {
      ev.preventDefault();
      this.handleCardAction('tap');
    }
  }

  // Keep canvas measurements in LTR order even when an RTL tooltip is visible.
  renderBidiMeasurement(text) {
    return '\u2066' + text + '\u2069';
  }
}

// Regex to detect Latin script characters for uppercase formatting (ES2019 compatible)
WeatherChartCard.LATIN_SCRIPT_REGEX = /^\p{Script=Latin}+$/u;

// Second steps offered for auto-rotate, on top of whole minutes.
WeatherChartCard.AUTO_ROTATE_SECONDS = [0, 5, 10, 15, 30];

export default WeatherChartCard;

if (!customElements.get('weather-chart-card-ha')) {
  customElements.define('weather-chart-card-ha', WeatherChartCard);
}

window.customCards = window.customCards || [];
// A resource loaded twice (HACS plus a manual entry) must not list the card twice.
if (!window.customCards.some((card) => card.type === 'weather-chart-card-ha')) {
  window.customCards.push({
    type: "weather-chart-card-ha",
    name: "Enhanced Weather Chart Card",
    description: "Enhanced custom weather card with charts.",
    preview: true,
    documentationURL: "https://github.com/w4mhi/weather-chart-card-ha",
  });
}
