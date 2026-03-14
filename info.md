# Weather Chart Card

An enhanced weather forecast card for Home Assistant with advanced features and customization options.

## ✨ Features

- 🌡️ **Temperature Gradient Colors** - Visual temperature ranges with automatic color coding (blue→green→yellow→orange→red)
- 📅 **Date Labels** - Day names with date numbers for easy reference
- 🌤️ **Large Animated Weather Icons** - Beautiful Basmilius weather icons with customizable sizes
- 🌙 **Day/Night Temperature Distinction** - Dashed lines clearly differentiate night temperatures from day temperatures
- 🌍 **Timezone Support** - Display weather for multiple locations with proper timezone handling
- 🌡️ **Smart Unit Conversion** - Automatic temperature (°F ↔ °C), pressure (inHg ↔ mmHg ↔ hPa), and speed conversion
- 🎨 **Highly Customizable** - Adjust icon sizes, colors, chart styles, and layouts to match your theme
- ⚡ **Fast & Lightweight** - Optimized performance with efficient rendering
- 📊 **Multiple Display Styles** - Choose between different label and chart presentation styles

Perfect for dual-location weather monitoring or detailed single-location forecasts!

## 🚀 Quick Start

```yaml
type: custom:weather-chart-card-ha
entity: weather.your_weather_entity
location_name: "Home"
timezone: "America/Los_Angeles"
forecast:
  show_date_labels: true
  condition_icon_size_multiplier: 2.0
  use_color_thresholds: true
```

## 📖 Documentation

For complete configuration options, examples, and troubleshooting, see the [full README](https://github.com/w4mhi/weather-chart-card-ha).

## 🙏 Credits

- Original card by [mlamberts78](https://github.com/mlamberts78/weather-chart-card)
- Weather icons by [Basmilius](https://github.com/basmilius/weather-icons)
- Enhanced by [W4MHI](https://github.com/w4mhi)

## 📄 License

MIT License - Free to use and modify