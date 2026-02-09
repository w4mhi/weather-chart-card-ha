<h1 align="center">Enhanced Weather Chart Card</h1>

## Maintained Fork
This is an actively maintained fork of the original weather-chart-card project. We've added several improvements including timezone support, temperature unit conversion, and enhanced clock functionality. This version continues to receive updates and bug fixes to ensure compatibility with the latest Home Assistant releases.

[![hacs_badge](https://img.shields.io/badge/HACS-Default-41BDF5.svg)](https://github.com/hacs/integration)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/mlamberts78/weather-chart-card?style=flat-square)](https://github.com/mlamberts78/weather-chart-card/releases/latest)
![GitHub downloads](https://img.shields.io/github/downloads/mlamberts78/weather-chart-card/total?style=flat-square)
![GitHub release (latest by SemVer including pre-releases)](https://img.shields.io/github/downloads/mlamberts78/weather-chart-card/latest/total)
[![HACS Validate](https://github.com/mlamberts78/weather-chart-card/actions/workflows/validate.yaml/badge.svg)](https://github.com/mlamberts78/weather-chart-card/actions/workflows/validate.yaml)

![weather-chart-card](https://github.com/mlamberts78/weather-chart-card/assets/93537082/bd5b9f6e-4125-4a19-9773-463e6d054bce)
![15-days](https://github.com/mlamberts78/weather-chart-card/assets/93537082/f4de6060-7005-4a6d-b1f3-3aa17c856c73)

## Recent Updates

### New Features
- **Temperature Gradient Colors**: Automatic color-coded temperature lines based on comfort levels (6-level spectrum)
  - High/day temperature line displays with gradient colors from cold (blue) to hot (red)
  - Low/night temperature line displays as a dashed line in solid color for easy distinction
- **Date Labels**: Display date numbers below weekday labels in daily forecast view
- **Enhanced Visual Design**: 
  - Gradient colors based on actual temperature comfort: < 5°C (Cold/Dark Blue), 5-15°C (Cool/Light Blue), 15-22°C (Comfortable/Green), 22-26°C (Pleasant/Yellow), 26-32°C (Hot/Orange), > 32°C (Very Hot/Red)
  - Dashed border for night temperature line for better visual distinction
  - Solid border for day temperature line with gradient colors
- **Development Tools**: Local test server for easier development without Home Assistant installation

## Installation

### HACS

This enhanced card is not available in HACS (Home Assistant Community Store).
HACS is a third party community store and is not included in Home Assistant out of the box.

#### Configuration variables:

##### Card options

| Name                  | Type    | Default                  | Description                                                                                        |
| ----------------------| ------- | -------------------------|--------------------------------------------------------------------------------------------------- |
| type                  | string  | **Required**             | Should be `custom:weather-chart-card`.                                                             |
| entity                | string  | **Required**             | An entity_id with the `weather` domain.                                                            |
| temp                  | string  | none                     | An entity_id for a custom temperature sensor.                                                      |
| press                 | string  | none                     | An entity_id for a custom pressure sensor.                                                         |
| humid                 | string  | none                     | An entity_id for a custom humidity sensor.                                                         |
| uv                    | string  | none                     | An entity_id for a custom UV index sensor.                                                         |
| winddir               | string  | none                     | An entity_id for a custom wind bearing sensor. Sensor should have value in degrees                 |
| windspeed             | string  | none                     | An entity_id for a custom wind speed sensor.                                                       |
| feels_like            | string  | none                     | An entity_id for a custom feels like temperature sensor.                                           |
| dew_point             | string  | none                     | An entity_id for a custom dew point sensor.                                                        |
| wind_gust_speed       | string  | none                     | An entity_id for a custom wind gust speed sensor.                                                  |
| visibility            | string  | none                     | An entity_id for a custom visibility sensor.                                                       |
| description           | string  | none                     | An entity_id for a custom weather description sensor.                                              |
| title                 | string  | none                     | Card title.                                                                                        |
| show_main             | boolean | true                     | Show or hide a section with current weather condition and temperature.                             |
| show_temperature      | boolean | true                     | Show or hide the current temperature.                                                              |
| show_current_condition| boolean | true                     | Show or hide the current weather condition.                                                        |
| show_attributes       | boolean | true                     | Show or hide a section with attributes such as pressure, humidity, wind direction and speed, etc.  |
| show_sun              | boolean | true                     | Show or hide the sunset information                                                                |
| show_time             | boolean | false                    | Show or hide the current time on the card.                                                         |
| show_time_seconds     | boolean | false                    | Show or hide seconds for the current time on the card.                                             |
| show_day              | boolean | false                    | Show or hide the current day on the card. (Only visible when show_time is true.)                   |
| show_date             | boolean | false                    | Show or hide the current date the card. (Only visible when show_time is true.)                     |
| show_humidity         | boolean | true                     | Show or hide humidity on the card.                                                                 |
| show_pressure         | boolean | true                     | Show or hide pressure on the card.                                                                 |
| show_wind_direction   | boolean | true                     | Show or hide wind_direction on the card.                                                           |
| show_wind_speed       | boolean | true                     | Show or hide wind_speed on the card.                                                               |
| show_feels_like       | boolean | false                    | Show or hide feels like temperature on the card.                                                   |
| show_dew_point        | boolean | false                    | Show or hide dew point on the card.                                                                |
| show_wind_gust_speed  | boolean | false                    | Show or hide wind gust speed on the card.                                                          |
| show_visibility       | boolean | false                    | Show or hide visibility on the card.                                                               |
| show_description      | boolean | false                    | Show or hide the weather description on the card.                                                  |
| show_last_changed     | boolean | false                    | Show or hide when last data changed on the card.                                                   |
| use_12hour_format     | boolean | false                    | Display time in 12-hour format (AM/PM) instead of 24-hour format.                                  |
| timezone              | string  | none                     | Set a specific timezone (e.g., 'America/New_York'). Defaults to system timezone if not specified.  |
| icons                 | string  | none                     | Path to the location of custom icons in svg format, for example `/local/weather-icons/`.           |
| animated_icons        | boolean | false                    | Enable the use of animated icons                                                                   |
| icon_style            | string  | 'style1'                 | Options are 'style1' and'style2' for different set of animated icons.                              |
| icons_size            | number  | 25                       | The size of the animated or custom icons in pixels.                                                |
| current_temp_size     | number  | 28                       | The size of the current temperature in pixels.                                                     |
| time_size             | number  | 26                       | The size of the current time in pixels.                                                            |
| day_date_size         | number  | 15                       | The size of the current day and date in pixels.                                                    |
| forecast              | object  | none                     | See [forecast options](#forecast-options) for available options.                                   |
| units                 | object  | none                     | See [units of measurement](#units-of-measurement) for available options.                           |
| locale                | string  | none                     | See [Supported languages](#Supported-languages) for available languages                            |
| autoscroll            | boolean | false                    | Update the chart each hour, hiding prior forecast datapoints                                       |

##### Forecast options

| Name                 | Type    | Default                  | Description                                                                                        |
| -------------------- | ------- | -------------------------|--------------------------------------------------------------------------------------------------- |
| precipitation_type   | string  | rainfall                 | Show precipitation in 'rainfall' or 'probability'.                                                 |
| show_probability     | boolean | false                    | Also show probability value when precipitation_type = rainfall. (Only when available)              |
| labels_font_size     | number  | 11                       | Font size for temperature and precipitation labels.                                                |
| precip_bar_size      | number  | 100                      | Adjusts the thickness of precipitation bars (1-100).                                               |
| temperature1_color   | string  | rgba(255, 152, 0, 1.0)   | High/day temperature line color (used when use_color_thresholds is false).                         |
| temperature2_color   | string  | rgba(68, 115, 158, 1.0)  | Low/night temperature line color.                                                                  |
| precipitation_color  | string  | rgba(132, 209, 253, 1.0) | Precipitation bar chart color.                                                                     |
| use_color_thresholds | boolean | true                     | Enable automatic temperature-based gradient colors for high temperature line (6 comfort levels).   |
| chart_datetime_color | string  | primary-text-color       | Chart day or hour color                                                                            |
| chart_text_color     | string  | none                     | Chart text color                                                                                   |
| chart_height         | number  | 180                      | Adjust the forecast chart height                                                                   |
| condition_icons      | boolean | true                     | Show or hide forecast condition icons.                                                             |
| condition_icon_size_multiplier | number | 2.0             | Multiplier for condition icon size relative to icons_size.                                         |
| show_wind_forecast   | boolean | true                     | Show or hide wind forecast on the card.                                                            |
| round_temp           | boolean | false                    | Option for rounding the forecast temperatures                                                      |
| style                | string  | style1                   | Change chart style, options: 'style1' or 'style2'                                                  |
| type                 | string  | daily                    | Show daily or hourly forecast if available, options: 'daily' or 'hourly'                           |
| number_of_forecasts  | number  | 0                        | Overrides the number of forecasts to display. Set to "0" for automatic mode.                       |
| disable_animation    | boolean | false                    | Disable the chart animation.                                                                       |
| show_date_labels     | boolean | true                     | Show date numbers below weekday labels in daily forecast view.                                     |

##### Units of measurement

| Name                 | Type    | Default                  | Description                                                                                        |
| -------------------- | ------- | -------------------------|--------------------------------------------------------------------------------------------------- |
| pressure             | string  | none                     | Convert to 'hPa' or 'mmHg' or 'inHg'                                                               |
| speed                | string  | none                     | Convert to 'km/h' or 'm/s' or 'Bft' or 'mph'                                                       |
| temperature          | string  | none                     | Convert to '°C' or '°F'. Applies to current temp, feels like, and forecast temperatures.           |

###### What custom icons can I use?
Icons should be in svg format. Icons should have names as shown [here](https://github.com/mlamberts78/weather-chart-card/blob/master/src/const.js#L24). Example:
![130360372-76d70c42-986c-46e3-b9b5-810f0317f94f](https://github.com/mlamberts78/weather-chart-card/assets/93537082/d3ee55a2-e64f-4354-b36d-9faf6ea37361)

#### Example usage:
###### Card with current time, date and day
![date-time](https://github.com/mlamberts78/weather-chart-card/assets/93537082/ab2c32f7-8c6a-4a7e-84fc-f857a519a725)
```yaml
type: custom:weather-chart-card
entity: weather.weather_home
show_time: true
show_day: true
show_date: true
animated_icons: true
icon_style: style1

```
###### Style2 chart
![style2](https://github.com/mlamberts78/weather-chart-card/assets/93537082/3067cc43-0e80-492c-b4a5-771b1e44ea17)
```yaml
type: custom:weather-chart-card
entity: weather.my_home
forecast:
  style: style2
```
###### Chart only
![Chart-only](https://github.com/mlamberts78/weather-chart-card/assets/93537082/c99d85a4-30d1-4fd9-90ff-877421b39e9b)
```yaml
type: custom:weather-chart-card
entity: weather.my_home
show_main: false
show_attributes: false
forecast:
  condition_icons: false
  show_wind_forecast: false
```

###### Custom units
![Units](https://github.com/mlamberts78/weather-chart-card/assets/93537082/e72862ee-9bb7-4f97-9a3c-b17663c458aa)
```yaml
type: custom:weather-chart-card
entity: weather.my_home
units:
  pressure: mmHg
  speed: m/s
  temperature: °F
```

###### Custom timezone
```yaml
type: custom:weather-chart-card
entity: weather.my_home
show_time: true
show_day: true
show_date: true
timezone: America/New_York
```

###### Temperature gradient colors (automatic comfort-based thresholds)
The card automatically colors the high temperature line based on comfort levels with a 6-level spectrum:
- **< 5°C**: Dark Blue (Cold)
- **5-15°C**: Light Blue (Cool)  
- **15-22°C**: Green (Comfortable - good weather range)
- **22-26°C**: Yellow (Pleasant/Warm)
- **26-32°C**: Orange (Hot)
- **> 32°C**: Red (Very Hot)

The night temperature line displays as a dashed line in solid color for easy distinction.

Enabled by default. Example configuration:
```yaml
type: custom:weather-chart-card
entity: weather.my_home
forecast:
  use_color_thresholds: true  # Enable gradient colors (default)
  style: style2
```

To disable automatic gradients and use solid colors:
```yaml
type: custom:weather-chart-card
entity: weather.my_home
forecast:
  use_color_thresholds: false
  temperature1_color: rgba(255, 152, 0, 1.0)
  temperature2_color: rgba(68, 115, 158, 1.0)
```

###### Date labels in daily forecast
Show date numbers below weekday labels for better context:
```yaml
type: custom:weather-chart-card
entity: weather.my_home
forecast:
  type: daily
  show_date_labels: true  # Shows "MON" and "8" on separate lines
```

## Development

### Local Testing Without Home Assistant
For developers who want to test changes without installing the card in Home Assistant:

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Open `test.html` in your browser at `http://localhost:5500/test.html`

The development server includes:
- Automatic rebuilding on file changes
- Source maps for debugging
- Mock weather data for testing
- Theme toggle (light/dark mode)
- All card features enabled

###### Supported languages:
| Language         | Locale  |
| ---------------- | ------- |
| Bulgarian        | bg      |
| Catalan          | ca      |
| Czech            | cs      |
| Danish           | da      |
| Dutch            | nl      |
| English          | en      |
| Finnish          | fi      |
| French           | fr      |
| German           | de      |
| Greek            | el      |
| Hungarian        | hu      |
| Italian          | it      |
| Lithuanian       | lt      |
| Norwegian        | no      |
| Polish           | pl      |
| Portuguese       | pt      |
| Romanian         | ro      |
| Russian          | ru      |
| Slovak           | sk      |
| Spanish          | es      |
| Swedish          | sv      |
| Ukrainian        | uk      |
| 한국어           | ko      |
