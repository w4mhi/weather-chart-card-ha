/**
 * Weather card constants
 * 
 * Weather icons by Bas Milius
 * https://github.com/basmilius/weather-icons
 * Licensed under MIT License
 */

const cardinalDirectionsIcon = [
  'arrow-down', 'arrow-bottom-left', 'arrow-left',
  'arrow-top-left', 'arrow-up', 'arrow-top-right',
  'arrow-right', 'arrow-bottom-right', 'arrow-down'
];

const weatherIcons = {
  'clear-night': 'hass:weather-night',
  'cloudy': 'hass:weather-cloudy',
  'exceptional': 'mdi:alert-circle-outline',
  'fog': 'hass:weather-fog',
  'hail': 'hass:weather-hail',
  'lightning': 'hass:weather-lightning',
  'lightning-rainy': 'hass:weather-lightning-rainy',
  'partlycloudy': 'hass:weather-partly-cloudy',
  'pouring': 'hass:weather-pouring',
  'rainy': 'hass:weather-rainy',
  'snowy': 'hass:weather-snowy',
  'snowy-rainy': 'hass:weather-snowy-rainy',
  'sunny': 'hass:weather-sunny',
  'windy': 'hass:weather-windy',
  'windy-variant': 'hass:weather-windy-variant'
};

const weatherIconsDay = {
  'clear-night': 'clear-night',
  'cloudy': 'cloudy',
  'exceptional': 'extreme-day',
  'fog': 'fog-day',
  'hail': 'hail',
  'lightning': 'thunderstorms-day',
  'lightning-rainy': 'thunderstorms-day-rain',
  'partlycloudy': 'partly-cloudy-day',
  'pouring': 'extreme-day-rain',
  'rainy': 'overcast-day-rain',
  'snowy': 'snow',
  'snowy-rainy': 'sleet',
  'sunny': 'clear-day',
  'windy': 'wind',
  'windy-variant': 'wind',
};

const weatherIconsNight = {
  ...weatherIconsDay,
  'exceptional': 'extreme-night',
  'fog': 'fog-night',
  'lightning': 'thunderstorms-night',
  'lightning-rainy': 'thunderstorms-night-rain',
  'partlycloudy': 'partly-cloudy-night',
  'pouring': 'extreme-night-rain',
  'rainy': 'overcast-night-rain',
  'sunny': 'clear-night',
};

const WeatherEntityFeature = {
  FORECAST_DAILY: 1,
  FORECAST_HOURLY: 2,
  FORECAST_TWICE_DAILY: 4,
};

export {
  cardinalDirectionsIcon,
  weatherIcons,
  weatherIconsDay,
  weatherIconsNight,
  WeatherEntityFeature
};
