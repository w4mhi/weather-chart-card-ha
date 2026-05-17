import locale from './locale.js';
import {
  cardinalDirectionsIcon,
  weatherIcons,
  weatherIconsDay,
  weatherIconsNight,
  WeatherEntityFeature
} from './const.js';
import {LitElement, html} from 'lit';
import './weather-chart-card-editor.js';
import { property } from 'lit/decorators.js';
import {Chart, registerables} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
Chart.register(...registerables, ChartDataLabels);

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
    title: 'Enhanced Weather Chart Card',
    show_main: true,
    show_temperature: true,
    show_current_condition: true,
    show_attributes: true,
    show_time: true,
    show_time_seconds: true,
    show_hour_leading_zero: true,
    show_day: true,
    show_date: true,
    show_humidity: true,
    show_pressure: true,
    show_wind_direction: true,
    show_wind_speed: true,
    show_sun: true,
    show_feels_like: false,
    timezone: '',
    show_dew_point: false,
    show_wind_gust_speed: false,
    show_visibility: false,
    show_last_changed: false,
    show_forecast_toggle: false,
    use_12hour_format: false,
    icons_size: 30,
    main_icon_size: 150,
    current_temp_size: 35,
    animated_icons: true,
    icon_style: 'style1',
    autoscroll: false,
    forecast: {
      precipitation_type: 'rainfall',
      show_probability: false,
      labels_font_size: '11',
      precip_bar_size: '100',
      style: 'style2',
      show_wind_forecast: true,
      condition_icons: true,
      round_temp: false,
      type: 'daily',
      number_of_forecasts: '0', 
      disable_animation: false,
      show_date_labels: true,
      use_color_thresholds: true,
      gradient_mode: 'classic',
      gradient_preset: 'temperate',
    },
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
    title: 'Weather',
    icons_size: 30,
    animated_icons: true,
    icon_style: 'style1',
    current_temp_size: 35,
    main_icon_size: 150,
    time_size: 26,
    day_date_size: 15,
    show_feels_like: false,
    show_dew_point: false,
    show_wind_gust_speed: false,
    show_visibility: false,
    show_last_changed: false,
    show_description: false,
    show_forecast_toggle: false,
    show_hour_leading_zero: true,
    ...config,
    forecast: {
      precipitation_type: 'rainfall',
      show_probability: false,
      labels_font_size: 11,
      chart_height: 180,
      precip_bar_size: 100,
      style: 'style2',
      temperature1_color: 'rgba(255, 152, 0, 1.0)',
      temperature2_color: 'rgba(68, 115, 158, 1.0)',
      precipitation_color: 'rgba(132, 209, 253, 1.0)',
      condition_icons: true,
      show_wind_forecast: true,
      round_temp: false,
      type: 'daily',
      auto_rotate: 0,
      number_of_forecasts: '0',
      '12hourformat': false,
      show_date_labels: true,
      use_color_thresholds: true,
      gradient_mode: 'classic',
      gradient_preset: 'temperate',
      ...config.forecast,
    },
    units: {
      pressure: 'hPa',
      ...config.units,
    }
  };

  cardConfig.units.speed = config.speed ? config.speed : cardConfig.units.speed;

  // Icon path configuration: Prioritize CDN, fallback to custom path if specified
  if (config.icons) {
    // User specified custom icons path
    this.baseIconPath = config.icons;
  } else {
    // Use icons from GitHub repository via jsdelivr CDN
    // Using @latest for better CDN caching and reliability
    // style1 = fill (default), style2 = line
    this.baseIconPath = cardConfig.icon_style === 'style2'
      ? 'https://cdn.jsdelivr.net/gh/w4mhi/weather-chart-card-ha@latest/dist/icons2/'
      : 'https://cdn.jsdelivr.net/gh/w4mhi/weather-chart-card-ha@latest/dist/icons/';
  }

  if (!cardConfig.title || !cardConfig.title.trim()) {
    cardConfig.title = 'Weather';
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
  this.unitSpeed = this.config.units.speed ? this.config.units.speed : this.weather && this.weather.attributes.wind_speed_unit;
  this.unitPressure = this.config.units.pressure ? this.config.units.pressure : this.weather && this.weather.attributes.pressure_unit;
  this.unitVisibility = this.config.units.visibility ? this.config.units.visibility : this.weather && this.weather.attributes.visibility_unit;
  this.unitTemperature = this.config.units.temperature ? this.config.units.temperature : this.weather && this.weather.attributes.temperature_unit;
  this.weather = this.config.entity in hass.states
    ? hass.states[this.config.entity]
    : null;

  if (this.weather) {
    this.temperature = this.config.temp ? hass.states[this.config.temp].state : this.weather.attributes.temperature;
    this.humidity = this.config.humid ? hass.states[this.config.humid].state : this.weather.attributes.humidity;
    this.pressure = this.config.press ? hass.states[this.config.press].state : this.weather.attributes.pressure;
    this.uv_index = this.config.show_uv === false
      ? undefined
      : (this.config.uv ? hass.states[this.config.uv].state : this.weather.attributes.uv_index);
    this.windSpeed = this.config.windspeed ? hass.states[this.config.windspeed].state : this.weather.attributes.wind_speed;
    this.dew_point = this.config.dew_point ? hass.states[this.config.dew_point].state : this.weather.attributes.dew_point;
    this.wind_gust_speed = this.config.wind_gust_speed ? hass.states[this.config.wind_gust_speed].state : this.weather.attributes.wind_gust_speed;
    this.visibility = this.config.visibility ? hass.states[this.config.visibility].state : this.weather.attributes.visibility;

    if (this.config.winddir && hass.states[this.config.winddir] && hass.states[this.config.winddir].state !== undefined) {
      this.windDirection = parseFloat(hass.states[this.config.winddir].state);
    } else {
      this.windDirection = this.weather.attributes.wind_bearing;
    }

    this.feels_like = this.config.feels_like && hass.states[this.config.feels_like] ? hass.states[this.config.feels_like].state : this.weather.attributes.apparent_temperature;
    this.description = this.config.description && hass.states[this.config.description] ? hass.states[this.config.description].state : this.weather.attributes.description;
  }

  if (this.weather && !this.forecastSubscriber) {
    this.subscribeForecastEvents();
  }
}

subscribeForecastEvents() {
  const forecastType = this.config.forecast.type || 'daily';
  const isHourly = forecastType === 'hourly';

  const feature = isHourly ? WeatherEntityFeature.FORECAST_HOURLY : WeatherEntityFeature.FORECAST_DAILY;
  if (!this.supportsFeature(feature)) {
    console.error(`Weather entity "${this.config.entity}" does not support ${isHourly ? 'hourly' : 'daily'} forecasts.`);
    return;
  }

  const callback = (event) => {
    this.forecasts = event.forecast;
    this.requestUpdate();
    this.drawChart();
  };

  this.forecastSubscriber = this._hass.connection.subscribeMessage(callback, {
    type: "weather/subscribe_forecast",
    forecast_type: isHourly ? 'hourly' : 'daily',
    entity_id: this.config.entity,
  });
}

handleForecastTypeToggle() {
  // Toggle between daily and hourly
  const currentType = this.config.forecast.type || 'daily';
  const newType = currentType === 'daily' ? 'hourly' : 'daily';
  
  // Check if the new type is supported
  const feature = newType === 'hourly' ? WeatherEntityFeature.FORECAST_HOURLY : WeatherEntityFeature.FORECAST_DAILY;
  if (!this.supportsFeature(feature)) {
    console.warn(`Weather entity "${this.config.entity}" does not support ${newType} forecasts.`);
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
  
  // Unsubscribe from old forecast
  if (this.forecastSubscriber) {
    this.forecastSubscriber.then((unsub) => unsub());
    this.forecastSubscriber = null;
  }
  
  // Subscribe to new forecast type
  this.subscribeForecastEvents();
  
  // Request update to re-render
  this.requestUpdate();

  // Restart animated icon SVG animations after re-render
  this.updateComplete.then(() => {
    const icons = this.shadowRoot.querySelectorAll('img[src$=".svg"]');
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

  constructor() {
    super();
    this.resizeObserver = null;
    this.resizeInitialized = false;
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.resizeInitialized) {
      this.delayedAttachResizeObserver();
    }
    this.startAutoRotate();
  }

  startAutoRotate() {
    this.stopAutoRotate();
    const interval = this.config && this.config.forecast ? parseInt(this.config.forecast.auto_rotate, 10) : 0;
    if (!interval || interval < 1 || interval > 60) return;
    // Align to the next whole minute, then start the interval
    const now = new Date();
    const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    this.autoRotateTimeout = setTimeout(() => {
      this.handleForecastTypeToggle();
      this.autoRotateInterval = setInterval(() => {
        this.handleForecastTypeToggle();
      }, interval * 60 * 1000);
    }, msUntilNextMinute);
  }

  stopAutoRotate() {
    if (this.autoRotateTimeout) {
      clearTimeout(this.autoRotateTimeout);
      this.autoRotateTimeout = null;
    }
    if (this.autoRotateInterval) {
      clearInterval(this.autoRotateInterval);
      this.autoRotateInterval = null;
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
    this.stopAutoRotate();
    if (this.forecastSubscriber) {
      this.forecastSubscriber.then((unsub) => unsub());
    }
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

ll(str) {
  const selectedLocale = this.config.locale || this.language || 'en';

  // Try full locale first (e.g., 'ro-RO')
  if (locale[selectedLocale] && locale[selectedLocale][str]) {
    return locale[selectedLocale][str];
  }

  // Fall back to language code (e.g., 'ro' from 'ro-RO')
  const languageCode = selectedLocale.split('-')[0];
  if (locale[languageCode] && locale[languageCode][str]) {
    return locale[languageCode][str];
  }

  // Final fallback to English
  return locale.en[str];
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
 * Get locale data with fallback logic
 * @param {string} key - 'days' or 'months'
 * @returns {Array|null} - locale array or null if not found
 */
getLocaleArray(key) {
  const selectedLocale = this.config.locale || this.language || 'en';
  
  // Try full locale first (e.g., 'ro-RO')
  if (locale[selectedLocale] && locale[selectedLocale][key] && locale[selectedLocale][key].length) {
    return locale[selectedLocale][key];
  }
  
  // Try language code (e.g., 'ro' from 'ro-RO')
  const languageCode = selectedLocale.split('-')[0];
  if (locale[languageCode] && locale[languageCode][key] && locale[languageCode][key].length) {
    return locale[languageCode][key];
  }
  
  // English fallback with safety check
  if (locale.en && locale.en[key] && locale.en[key].length) {
    return locale.en[key];
  }
  
  // Ultimate fallback: return null if nothing works
  return null;
}

getLocalizedDayName(date, timezone) {
  const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Priority 1: Try translation array from locale.js
  const days = this.getLocaleArray('days');
  if (days && days[dayIndex] && typeof days[dayIndex] === 'string' && days[dayIndex].length > 0) {
    const dayName = days[dayIndex].substring(0, 3);
    // Only uppercase for Latin-script languages
    return WeatherChartCard.LATIN_SCRIPT_REGEX.test(dayName) ? dayName.toUpperCase() : dayName;
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
      const dayName = formatted.substring(0, 3);
      // Only uppercase for Latin-script languages
      return WeatherChartCard.LATIN_SCRIPT_REGEX.test(dayName) ? dayName.toUpperCase() : dayName;
    }
  } catch (e) {
    // Intl failed, continue to ultimate fallback
  }
  
  // Priority 3: Hardcoded English fallback
  const englishDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return englishDays[dayIndex].substring(0, 3).toUpperCase();
}

/**
 * Get localized day name (full)
 */
getLocalizedDayNameFull(date, timezone) {
  const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
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
  const monthIndex = date.getMonth(); // 0 = January, 1 = February, etc.
  
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
  const monthIndex = date.getMonth(); // 0 = January, 1 = February, etc.
  
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

  getWeatherIcon(condition, sun) {
    if (this.config.animated_icons === true) {
      const iconName = sun === 'below_horizon' ? weatherIconsNight[condition] : weatherIconsDay[condition];
      return `${this.baseIconPath}${iconName}.svg`;
    } else if (this.config.icons) {
      const iconName = sun === 'below_horizon' ? weatherIconsNight[condition] : weatherIconsDay[condition];
      return `${this.config.icons}${iconName}.svg`;
    }
    return weatherIcons[condition];
  }

  /**
   * Get local icon path - tries different common paths for HACS/manual installation
   */
  getLocalIconPath() {
    // Get the card's script URL to determine installation path
    const scripts = document.querySelectorAll('script[src*="weather-chart-card"]');
    if (scripts.length > 0) {
      const scriptSrc = scripts[scripts.length - 1].src;
      const basePath = scriptSrc.substring(0, scriptSrc.lastIndexOf('/'));
      return `${basePath}/icons/`;
    }
    // Fallback paths for common installations
    return '/hacsfiles/weather-chart-card-ha/icons/';
  }

  /**
   * Handle icon loading error - fallback to local icons or MDI icons
   */
  handleIconError(event, condition, sun) {
    const img = event.target;
    const currentSrc = img.src;
    
    // If already tried local bundled icons, try custom path if configured
    if (img.dataset.fallbackAttempted === 'bundled') {
      if (this.config.icons && !currentSrc.includes(this.config.icons)) {
        img.dataset.fallbackAttempted = 'custom';
        const iconName = sun === 'below_horizon' ? weatherIconsNight[condition] : weatherIconsDay[condition];
        img.src = `${this.config.icons}${iconName}.svg`;
        return;
      }
      img.dataset.fallbackAttempted = 'final';
    }
    
    // If all fallbacks failed, use MDI icon
    if (img.dataset.fallbackAttempted === 'custom' || img.dataset.fallbackAttempted === 'final') {
      // Replace img with ha-icon
      const haIcon = document.createElement('ha-icon');
      haIcon.setAttribute('icon', weatherIcons[condition]);
      haIcon.style.cssText = img.style.cssText;
      img.parentNode.replaceChild(haIcon, img);
      return;
    }
    
    // First fallback: try local bundled icons
    if (!img.dataset.fallbackAttempted) {
      img.dataset.fallbackAttempted = 'bundled';
      const iconName = sun === 'below_horizon' ? weatherIconsNight[condition] : weatherIconsDay[condition];
      const localPath = this.getLocalIconPath();
      img.src = `${localPath}${iconName}.svg`;
    }
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
        i = 9;
        break;
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
  const unitConversion = {
    'km/h': 1,
    'm/s': 3.6,
    'mph': 1.60934,
    'kn': 1.852,
  };

  if (!sourceUnit) {
    throw new Error('wind_speed_unit not available in weather attributes.');
  }

  const wind_speed_unit = sourceUnit;
  const conversionFactor = unitConversion[wind_speed_unit];

  if (typeof conversionFactor !== 'number') {
    throw new Error(`Unknown wind_speed_unit: ${wind_speed_unit}`);
  }

  const windSpeedInKmPerHour = windSpeed * conversionFactor;

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

convertWindSpeed(windSpeed, targetUnit = this.unitSpeed, sourceUnit = this.weather && this.weather.attributes && this.weather.attributes.wind_speed_unit) {
  const numericWindSpeed = Number(windSpeed);

  if (!Number.isFinite(numericWindSpeed)) {
    return windSpeed;
  }

  if (!targetUnit || !sourceUnit || targetUnit === sourceUnit) {
    return Math.round(numericWindSpeed);
  }

  if (targetUnit === 'Bft') {
    return this.calculateBeaufortScale(numericWindSpeed, sourceUnit);
  }

  const sourceToMetersPerSecond = {
    'm/s': 1,
    'km/h': 1 / 3.6,
    'mph': 0.44704,
    'kn': 0.514444,
  };

  const metersPerSecondToTarget = {
    'm/s': 1,
    'km/h': 3.6,
    'mph': 2.2369362920544,
    'kn': 1.9438444924406,
  };

  const toMetersPerSecond = sourceToMetersPerSecond[sourceUnit];
  const fromMetersPerSecond = metersPerSecondToTarget[targetUnit];

  if (!toMetersPerSecond || !fromMetersPerSecond) {
    return Math.round(numericWindSpeed);
  }

  return Math.round(numericWindSpeed * toMetersPerSecond * fromMetersPerSecond);
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
  const attrUnit = this.weather && this.weather.attributes ? this.weather.attributes.precipitation_unit : null;
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

    const entityChanged = oldConfig && this.config.entity !== oldConfig.entity;
    const forecastTypeChanged = oldConfig && this.config.forecast.type !== oldConfig.forecast.type;
    const autoscrollChanged = oldConfig && this.config.autoscroll !== oldConfig.autoscroll;

    if (entityChanged || forecastTypeChanged) {
      if (this.forecastSubscriber && typeof this.forecastSubscriber === 'function') {
        this.forecastSubscriber();
      }

      this.subscribeForecastEvents();
    }

    if (this.forecasts && this.forecasts.length) {
      this.drawChart();
    }

    if (autoscrollChanged) {
      if (!this.config.autoscroll) {
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

createTemperatureGradient(data, unit, ctx, chartArea, rangeC = null) {
  if (!chartArea) {
    return null;
  }
  
  const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
  const dataLength = data.length;
  
  for (let i = 0; i < dataLength; i++) {
    const position = i / (dataLength - 1);
    const color = this.getTemperatureColorWithRange(data[i], unit, rangeC);
    gradient.addColorStop(position, color);
  }
  
  return gradient;
}

drawChart({ config, language, weather, forecastItems } = this) {
  const self = this; // Capture component instance for use in Chart.js callbacks
  
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
  var lengthUnit = this._hass.config.unit_system.length;
  const sourcePrecipUnit = this.getSourcePrecipitationUnit();
  const displayPrecipUnit = this.getDisplayPrecipitationUnit(sourcePrecipUnit);
  if (config.forecast.precipitation_type === 'probability') {
    var precipUnit = '%';
  } else {
    var precipUnit = this.ll('units')[displayPrecipUnit] || displayPrecipUnit;
  }
  const formatPrecipitationValue = (rawValue) => {
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) {
      return rawValue;
    }

    if (config.forecast.precipitation_type !== 'rainfall') {
      return numericValue;
    }

    const convertedValue = this.convertPrecipitation(numericValue, sourcePrecipUnit, displayPrecipUnit);
    return Number.isFinite(convertedValue) ? convertedValue : numericValue;
  };
  const data = this.computeForecastData();
  const tempColorRange = this.getTemperatureRangeC(data.tempHigh, tempUnit);

  var style = getComputedStyle(document.body);
  var backgroundColor = style.getPropertyValue('--card-background-color');
  var textColor = style.getPropertyValue('--primary-text-color');
  var dividerColor = style.getPropertyValue('--divider-color');
  const canvas = this.renderRoot.querySelector('#forecastChart');
  if (!canvas) {
    requestAnimationFrame(() => this.drawChart());
    return;
  }

  const ctx = canvas.getContext('2d');

  let precipMax;

  if (config.forecast.precipitation_type === 'probability') {
    precipMax = 100;
  } else {
    if (config.forecast.type === 'hourly') {
      precipMax = lengthUnit === 'km' ? 4 : 1;
    } else {
      precipMax = lengthUnit === 'km' ? 20 : 1;
    }
  }

  Chart.defaults.color = textColor;
  Chart.defaults.scale.grid.color = dividerColor;
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
              return this.createTemperatureGradient(data.tempHigh, tempUnit, context.chart.ctx, context.chart.chartArea, tempColorRange);
            }
            return config.forecast.temperature1_color;
          }
        : config.forecast.temperature1_color,
      backgroundColor: config.forecast.use_color_thresholds
        ? (context) => {
            if (context.chart.chartArea) {
              return this.createTemperatureGradient(data.tempHigh, tempUnit, context.chart.ctx, context.chart.chartArea, tempColorRange);
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
          return context.dataset.data[context.dataIndex] > 0 ? 'true' : false;
        },
      formatter: function (value, context) {
        const precipitationType = config.forecast.precipitation_type;

        const rainfallRaw = context.dataset.data[context.dataIndex];
        const rainfall = formatPrecipitationValue(rainfallRaw);
        const probability = data.forecast[context.dataIndex].precipitation_probability;

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
      formatter: function (value, context) {
        return context.dataset.data[context.dataIndex] + '°';
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
      display: function (context) {
        return 'true';
      },
      formatter: function (value, context) {
        return context.dataset.data[context.dataIndex] + '°';
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

  this.forecastChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.dateTime,
      datasets: datasets,
    },
    options: {
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
                      var dayNumber = self.getLocalizedDayNumber(dateObj, locale, timezone);
                      var date = monthShort + ' ' + dayNumber;
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
          suggestedMin: Math.min(...data.tempHigh, ...data.tempLow) - 5,
          suggestedMax: Math.max(...data.tempHigh, ...data.tempLow) + 3,
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
      },
      plugins: {
        legend: {
          display: false,
        },
        datalabels: {
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
          formatter: function (value, context) {
            return context.dataset.data[context.dataIndex] + '°';
          },
        },
        tooltip: {
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
    label: function (context) {
      var label = context.dataset.label;
      var value = context.formattedValue;
      var probability = data.forecast[context.dataIndex].precipitation_probability;
      var unit = context.datasetIndex === 2 ? precipUnit : tempUnit;

      if (config.forecast.precipitation_type === 'rainfall' && context.datasetIndex === 2) {
        const rainfallRaw = context.dataset.data[context.dataIndex];
        const rainfallDisplay = formatPrecipitationValue(rainfallRaw);
        if (Number.isFinite(rainfallDisplay)) {
          value = rainfallDisplay > 9 ? Math.round(rainfallDisplay) : rainfallDisplay.toFixed(1);
        }
      }

      if (config.forecast.precipitation_type === 'rainfall' && context.datasetIndex === 2 && config.forecast.show_probability && probability !== undefined && probability !== null) {
        return label + ': ' + value + ' ' + precipUnit + ' / ' + Math.round(probability) + '%';
      } else {
        return label + ': ' + value + ' ' + unit;
      }
            },
          },
        },
      },
    },
  });
}

computeForecastData({ config, forecastItems } = this) {
  var forecast = this.forecasts ? this.forecasts.slice(0, forecastItems) : [];
  var roundTemp = config.forecast.round_temp == true;
  var dateTime = [];
  var tempHigh = [];
  var tempLow = [];
  var precip = [];

  for (var i = 0; i < forecast.length; i++) {
    var d = forecast[i];
    if (config.autoscroll) {
      const cutoff = (config.forecast.type === 'hourly' ? 1 : 24) * 60 * 60 * 1000;
      if (new Date() - new Date(d.datetime) > cutoff) {
        continue;
      }
    }
    dateTime.push(d.datetime);
    
    let highTemp = d.temperature;
    let lowTemp = d.templow;
    
    // Convert temperatures if needed
    if (this.unitTemperature && this.unitTemperature !== this.weather.attributes.temperature_unit) {
      highTemp = this.convertTemperature(highTemp, this.weather.attributes.temperature_unit, this.unitTemperature);
      if (typeof lowTemp !== 'undefined') {
        lowTemp = this.convertTemperature(lowTemp, this.weather.attributes.temperature_unit, this.unitTemperature);
      }
    }
    
    // ALWAYS round temperatures for chart display (whether roundTemp is on or not)
    highTemp = roundTemp ? Math.round(highTemp) : Math.round(highTemp * 10) / 10;
    if (typeof lowTemp !== 'undefined') {
      lowTemp = roundTemp ? Math.round(lowTemp) : Math.round(lowTemp * 10) / 10;
    }
    
    tempHigh.push(highTemp);
    if (typeof lowTemp !== 'undefined') {
      tempLow.push(lowTemp);
    }

    if (config.forecast.precipitation_type === 'probability') {
      precip.push(d.precipitation_probability);
    } else {
      const numericPrecipitation = Number(d.precipitation);
      if (Number.isFinite(numericPrecipitation)) {
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
  }
}

updateChart({ forecasts, forecastChart } = this) {
  if (!forecasts || !forecasts.length) {
    return [];
  }

  const data = this.computeForecastData();

  if (forecastChart) {
    forecastChart.data.labels = data.dateTime;
    forecastChart.data.datasets[0].data = data.tempHigh;
    forecastChart.data.datasets[1].data = data.tempLow;
    forecastChart.data.datasets[2].data = data.precip;
    forecastChart.update();
  }
}

  render({config, _hass, weather} = this) {
    if (!config || !_hass) {
      return html``;
    }
    if (!weather || !weather.attributes) {
      return html`
        <style>
          .card {
            padding-top: ${config.title? '0px' : '16px'};
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
          align-items: center;
          justify-content: space-between;
          font-size: ${config.current_temp_size}px;
          margin-bottom: 10px;
          position: relative;
        }
        .main .weather-icon {
          position: absolute;
          left: 50%;
          top: 10px;
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
        }
        .main .current-condition {
          font-size: 18px;
          margin-top: 4px;
        }
        .current-time {
          position: absolute;
          top: ${config.title ? '24px' : '20px'};
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
          direction: ltr;
        }
        .chart-container {
          position: relative;
          height: ${config.forecast.chart_height}px;
          width: 100%;
          direction: ltr;
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
        .forecast-toggle:disabled {
          cursor: default;
          opacity: 0.7;
        }
      </style>

      <ha-card header="${config.title}">
        <div class="card">
          ${this.renderClock()}
          ${this.renderMain()}
          ${this.renderAttributes()}
          <div class="chart-container">
            <canvas id="forecastChart"></canvas>
          </div>
          ${this.renderForecastConditionIcons()}
          ${this.renderWind()}
          ${this.renderLastUpdated()}
        </div>
      </ha-card>
    `;
  }

renderMain({ config, sun, weather, temperature, feels_like, description } = this) {
  if (config.show_main === false)
    return html``;

  const use12HourFormat = config.use_12hour_format;
  const showTime = config.show_time;
  const showDay = config.show_day;
  const showDate = config.show_date;
  const showFeelsLike = config.show_feels_like;
  const showDescription = config.show_description;
  const showCurrentCondition = config.show_current_condition !== false;
  const showTemperature = config.show_temperature !== false;
  const showSeconds = config.show_time_seconds === true;

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

  const iconHtml = config.animated_icons || config.icons
    ? html`<img src="${this.getWeatherIcon(weather.state, sun.state)}" 
                 @error="${(e) => this.handleIconError(e, weather.state, sun.state)}" 
                 alt="">`
    : html`<ha-icon icon="${this.getWeatherIcon(weather.state, sun.state)}"></ha-icon>`;

  return html`
    <div class="main">
      <!-- Left: Temperature and condition info -->
      <div class="temp-info">
        <div class="current-temp">
          ${showTemperature ? html`${roundedTemperature}<span>${this.unitTemperature || this.getUnit('temperature')}</span>` : ''}
        </div>
        ${showCurrentCondition ? html`
          <div class="current-condition">
            ${this.ll(weather.state)}
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
        ${iconHtml}
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
  
  // Force timezone conversion using explicit formatters
  const timeFormatter = new Intl.DateTimeFormat(this.config.locale || 'en-US', {
    hour: showHourLeadingZero ? '2-digit' : 'numeric',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
    hour12: use12HourFormat,
    timeZone: timezone
  });
  
  const currentTime = timeFormatter.format(currentDate);
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
  const showTime = config.show_time;
  const showDay = config.show_day;
  const showDate = config.show_date;

  if (!showTime) {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
      this.clockInterval = null;
    }
    return html``;
  }

  // Clock update logic
  if (!this.clockInterval) {
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
    // Initial update
    setTimeout(() => this.updateClock(), 0);
  }

  return html`
    <div class="current-time">
      <div id="digital-clock"></div>
      ${showDay ? html`<div class="date-text day"></div>` : ''}
      ${showDay && showDate ? html` ` : ''}
      ${showDate ? html`<div class="date-text date"></div>` : ''}
      ${config.show_forecast_toggle ? html`
        <button class="forecast-toggle"
          @click="${this.handleForecastTypeToggle.bind(this)}"
          ?disabled="${parseInt(config.forecast.auto_rotate, 10) > 0}">
          ${parseInt(config.forecast.auto_rotate, 10) > 0 ? `Auto [${parseInt(config.forecast.auto_rotate, 10)}]` : (this.config.forecast.type === 'daily' ? 'Hourly' : 'Daily')}
        </button>
      ` : ''}
    </div>
  `;
}

renderAttributes({ config, humidity, pressure, windSpeed, windDirection, sun, language, uv_index, dew_point, wind_gust_speed, visibility } = this) {
  let dWindSpeed = this.convertWindSpeed(windSpeed);
  let dPressure = pressure;
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

  if (this.unitPressure !== this.weather.attributes.pressure_unit) {
    if (this.unitPressure === 'mmHg') {
      if (this.weather.attributes.pressure_unit === 'hPa') {
        dPressure = Math.round(pressure * 0.75006);
      } else if (this.weather.attributes.pressure_unit === 'inHg') {
        dPressure = Math.round(pressure * 25.4);
      }
    } else if (this.unitPressure === 'hPa') {
      if (this.weather.attributes.pressure_unit === 'mmHg') {
        dPressure = Math.round(pressure / 0.75006);
      } else if (this.weather.attributes.pressure_unit === 'inHg') {
        dPressure = Math.round(pressure * 33.8639);
      }
    } else if (this.unitPressure === 'inHg') {
      if (this.weather.attributes.pressure_unit === 'mmHg') {
        dPressure = pressure / 25.4;
      } else if (this.weather.attributes.pressure_unit === 'hPa') {
        dPressure = pressure / 33.8639;
      }
      dPressure = dPressure.toFixed(2);
    }
  } else {
    if (this.unitPressure === 'hPa' || this.unitPressure === 'mmHg') {
      dPressure = Math.round(dPressure);
    }
  }

  if (config.show_attributes == false)
    return html``;

  const showHumidity = config.show_humidity !== false;
  const showPressure = config.show_pressure !== false;
  const showWindDirection = config.show_wind_direction !== false;
  const showWindSpeed = config.show_wind_speed !== false;
  const showSun = config.show_sun !== false;
  const showDewpoint = config.show_dew_point == true;
  const showWindgustspeed = config.show_wind_gust_speed == true;
  const showVisibility = config.show_visibility == true;

return html`
    <div class="attributes">
      ${((showHumidity && humidity !== undefined) || (showPressure && dPressure !== undefined) || (showDewpoint && dew_point !== undefined) || (showVisibility && visibility !== undefined)) ? html`
        <div>
          ${showHumidity && humidity !== undefined ? html`
            <ha-icon icon="hass:water-percent"></ha-icon> ${humidity} %<br>
          ` : ''}
          ${showPressure && dPressure !== undefined ? html`
            <ha-icon icon="hass:gauge"></ha-icon> ${dPressure} ${this.ll('units')[this.unitPressure]} <br>
          ` : ''}
          ${showDewpoint && dew_point !== undefined ? html`
            <ha-icon icon="hass:thermometer-water"></ha-icon> ${dDewPoint} ${dewPointDisplayUnit} <br>
          ` : ''}
          ${showVisibility && visibility !== undefined ? html`
            <ha-icon icon="hass:eye"></ha-icon> ${visibility} ${this.weather.attributes.visibility_unit}
          ` : ''}
        </div>
      ` : ''}
      ${((showSun && sun !== undefined) || (typeof uv_index !== 'undefined' && uv_index !== undefined)) ? html`
        <div>
          ${typeof uv_index !== 'undefined' && uv_index !== undefined ? html`
            <div>
              <ha-icon icon="hass:white-balance-sunny"></ha-icon> UV: ${Math.round(uv_index * 10) / 10}
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
          ${showWindDirection && windDirection !== undefined ? html`
            <ha-icon icon="hass:${this.getWindDirIcon(windDirection)}"></ha-icon> ${this.getWindDir(windDirection)} <br>
          ` : ''}
          ${showWindSpeed && dWindSpeed !== undefined ? html`
            <ha-icon icon="hass:weather-windy"></ha-icon>
            ${dWindSpeed} ${this.ll('units')[this.unitSpeed] || this.unitSpeed} <br>
          ` : ''}
          ${showWindgustspeed && wind_gust_speed !== undefined ? html`
            <ha-icon icon="hass:weather-windy-variant"></ha-icon>
            ${dWindGustSpeed} ${this.ll('units')[this.unitSpeed] || this.unitSpeed}
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

renderForecastConditionIcons({ config, forecastItems, sun } = this) {
  const forecast = this.forecasts ? this.forecasts.slice(0, forecastItems) : [];

  if (config.forecast.condition_icons === false) {
    return html``;
  }

  return html`
    <div class="conditions" @click="${(e) => this.showMoreInfo(config.entity)}">
      ${(() => {
        const lat = this.config.sun_latitude != null ? this.config.sun_latitude
          : (this._hass && this._hass.config && this._hass.config.latitude);
        const lon = this.config.sun_longitude != null ? this.config.sun_longitude
          : (this._hass && this._hass.config && this._hass.config.longitude);
        return forecast.map((item) => {
        const forecastTime = new Date(item.datetime);

        let sunriseTime, sunsetTime;
        if (lat != null && lon != null) {
          const configuredTimeZone = this.config.time_zone
            || (this._hass && this._hass.config && this._hass.config.time_zone);
          let sunriseSunsetDate = forecastTime;

          if (configuredTimeZone) {
            const parts = new Intl.DateTimeFormat('en-CA', {
              timeZone: configuredTimeZone,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            }).formatToParts(forecastTime);
            const year = Number(parts.find((part) => part.type === 'year').value);
            const month = Number(parts.find((part) => part.type === 'month').value);
            const day = Number(parts.find((part) => part.type === 'day').value);
            sunriseSunsetDate = new Date(Date.UTC(year, month - 1, day));
          }

          const { sunrise, sunset } = this.calculateSunriseSunset(sunriseSunsetDate, lat, lon);
          sunriseTime = sunrise;
          sunsetTime = sunset;
        } else {
          sunriseTime = new Date(sun.attributes.next_rising);
          sunsetTime = new Date(sun.attributes.next_setting);
        }

        let isDayTime;
        if (config.forecast.type === 'daily') {
          isDayTime = true;
        } else {
          isDayTime = sunriseTime && sunsetTime
            ? forecastTime >= sunriseTime && forecastTime <= sunsetTime
            : true;
        }

        const weatherIcons = isDayTime ? weatherIconsDay : weatherIconsNight;
        const condition = item.condition;

        let iconHtml;

        if (config.animated_icons || config.icons) {
          const iconSrc = config.animated_icons ?
            `${this.baseIconPath}${weatherIcons[condition]}.svg` :
            `${this.config.icons}${weatherIcons[condition]}.svg`;
          const sunState = isDayTime ? 'above_horizon' : 'below_horizon';
          iconHtml = html`<img class="icon" 
                               src="${iconSrc}" 
                               @error="${(e) => this.handleIconError(e, condition, sunState)}" 
                               alt="">`;
        } else {
          iconHtml = html`<ha-icon icon="${this.getWeatherIcon(condition, sun.state)}"></ha-icon>`;
        }

        return html`
          <div class="forecast-item">
            ${iconHtml}
          </div>
        `;
      });
      })()}
    </div>
  `;
}

renderWind({ config, weather, windSpeed, windDirection, forecastItems } = this) {
  const showWindForecast = config.forecast.show_wind_forecast !== false;

  if (!showWindForecast) {
    return html``;
  }

  const forecast = this.forecasts ? this.forecasts.slice(0, forecastItems) : [];

  return html`
    <div class="wind-details">
      ${showWindForecast ? html`
        ${forecast.map((item) => {
          const dWindSpeed = this.convertWindSpeed(item.wind_speed);

          return html`
            <div class="wind-detail">
              <ha-icon class="wind-icon" icon="hass:${this.getWindDirIcon(item.wind_bearing)}"></ha-icon>
              <span class="wind-speed">${dWindSpeed}</span>
              <span class="wind-unit">${this.ll('units')[this.unitSpeed] || this.unitSpeed}</span>
            </div>
          `;
        })}
      ` : ''}
    </div>
  `;
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
}

// Regex to detect Latin script characters for uppercase formatting (ES2019 compatible)
WeatherChartCard.LATIN_SCRIPT_REGEX = /^[A-Za-z]+$/;

export default WeatherChartCard;

if (!customElements.get('weather-chart-card-ha')) {
  customElements.define('weather-chart-card-ha', WeatherChartCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "weather-chart-card-ha",
  name: "Enhanced Weather Chart Card",
  description: "Enhanced custom weather card with charts.",
  preview: true,
  documentationURL: "https://github.com/w4mhi/weather-chart-card-ha",
});
