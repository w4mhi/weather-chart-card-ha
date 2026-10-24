# Changelog

## 1.10.0

### Added
- `tap_action`, `hold_action` and `double_tap_action` on the current conditions and the chart, with every standard Home Assistant action.
- `forecast.night_shading`: shade sunset to sunrise on the hourly chart.
- `forecast.fill_temperature_range`: shade between the high and low lines.
- `forecast.show_probability_line`: precipitation probability as a line over the rainfall bars.
- Editor switches for the three chart options.

### Changed
- The animated icons are bundled inside the card. They no longer come from a CDN, so they work offline and always match the installed version.
- Condition names use Home Assistant's own translations when the card shows Home Assistant's language.
- `forecast.round_temp` also rounds the current temperature and feels like (11.3 → 11, 11.6 → 12).
- The bundle is minified: 789 KB before, 473 KB now (118 KB gzipped), icons included.

### Fixed
- A feels-like temperature of exactly 0° was hidden.
- A forecast day without a low temperature shifted every later low one column left; a missing low was drawn as 0.

### Development
- ESLint 9 flat config, `@rollup/plugin-node-resolve`, terser, Node 22 in CI.
- CI runs `npm audit`, the unit tests, and checks that the committed `dist/` matches the source.

## 1.9.0
- Auto-rotate takes minutes plus seconds (`auto_rotate`, `auto_rotate_seconds`); the daily/hourly button stays clickable and restarts the timer.

## 1.8.0
- Fixed 18 bugs from the 2026-10-21 audit (autoscroll, timezone-aware day and month names, column alignment with autoscroll, unavailable sensors, editor defaults, resize after view changes, Norwegian, units on first load, theme colors, precipitation units, pressure units, and more).
- The card shows its version.
- Since 1.7.4: `forecast.extra_rows`, `forecast.highlight_today`, RTL fixes, Traditional Chinese.
