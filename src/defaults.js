// Single source of truth for option defaults. The card (`setConfig`), the card
// picker stub (`getStubConfig`), the editor (switch and field states) and the
// README defaults test all read from here, so they cannot drift apart again.

export const FORECAST_DEFAULTS = {
  type: 'daily',
  style: 'style2',
  precipitation_type: 'rainfall',
  show_probability: false,
  show_precipitation_labels: true,
  labels_font_size: 11,
  chart_height: 180,
  precip_bar_size: 100,
  temperature1_color: 'rgba(255, 152, 0, 1.0)',
  temperature2_color: 'rgba(68, 115, 158, 1.0)',
  precipitation_color: 'rgba(132, 209, 253, 1.0)',
  use_color_thresholds: true,
  gradient_mode: 'classic',
  gradient_preset: 'temperate',
  condition_icons: true,
  show_wind_forecast: true,
  round_temp: false,
  number_of_forecasts: 0,
  disable_animation: false,
  show_date_labels: true,
  highlight_today: false,
  night_shading: false,
  fill_temperature_range: false,
  show_probability_line: false,
  auto_rotate: 0,
  auto_rotate_seconds: 0,
};

export const UNITS_DEFAULTS = {
  pressure: 'hPa',
};

export const DEFAULTS = {
  title: 'Weather',
  show_main: true,
  show_forecast: true,
  show_temperature: true,
  show_current_condition: true,
  show_attributes: true,
  show_humidity: true,
  show_pressure: true,
  show_uv: true,
  show_sun: true,
  show_wind_direction: true,
  show_wind_speed: true,
  show_feels_like: false,
  show_description: false,
  show_dew_point: false,
  show_wind_gust_speed: false,
  show_visibility: false,
  show_last_changed: false,
  show_forecast_toggle: false,
  show_time: false,
  show_time_seconds: false,
  show_hour_leading_zero: true,
  show_day: false,
  show_date: false,
  use_12hour_format: false,
  autoscroll: false,
  animated_icons: true,
  icon_style: 'style1',
  icons_size: 30,
  main_icon_size: 150,
  current_temp_size: 35,
  time_size: 26,
  day_date_size: 15,
  forecast: FORECAST_DEFAULTS,
  units: UNITS_DEFAULTS,
};

/**
 * Value of a dotted option path (`'forecast.round_temp'`) from a config,
 * falling back to its default when the key is absent.
 */
export function configValue(config, path) {
  const read = (source) => path.split('.').reduce(
    (level, key) => (level && typeof level === 'object' ? level[key] : undefined),
    source
  );
  const value = read(config);
  return value === undefined || value === null || value === '' ? read(DEFAULTS) : value;
}
