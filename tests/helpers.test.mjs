import assert from 'node:assert/strict';
import { test } from 'node:test';

// main.js registers itself on `window`; Lit's Node build shims the DOM classes.
globalThis.window = globalThis;
const { default: WeatherChartCard } = await import('../src/main.js');
const { DEFAULTS, FORECAST_DEFAULTS, configValue } = await import('../src/defaults.js');
const actions = await import('../src/actions.js');

// A card with config and hass applied, without rendering it.
function makeCard(config = {}, hass = {}) {
  const card = new WeatherChartCard();
  card.setConfig({ entity: 'weather.home', ...config });
  card._hass = {
    states: {},
    config: { time_zone: 'UTC', unit_system: { length: 'km', temperature: '°C' } },
    ...hass,
  };
  return card;
}

test('#1 turning autoscroll on starts the timer, turning it off cancels it', async () => {
  const card = makeCard({ autoscroll: true });
  const calls = [];
  card.autoscroll = () => calls.push('start');
  card.cancelAutoscroll = () => calls.push('cancel');
  card.drawChart = () => {};
  card.syncForecastSubscriptions = () => {};
  // updated() awaits updateComplete, which only settles once the card is connected.
  card.getUpdateComplete = async () => true;

  await card.updated(new Map([['config', { ...card.config, autoscroll: false }]]));
  card.config = { ...card.config, autoscroll: false };
  await card.updated(new Map([['config', { ...card.config, autoscroll: true }]]));
  assert.deepEqual(calls, ['start', 'cancel']);
});

test('#2 weekday and month follow the card timezone, not the browser', () => {
  const card = makeCard({ locale: 'en' });
  // 23:30 UTC on Saturday 31 October is already Sunday 1 November in Tokyo.
  const instant = new Date('2026-10-31T23:30:00Z');
  assert.deepEqual(card.getZonedDateIndices(instant, 'Asia/Tokyo'), { dayIndex: 0, monthIndex: 10 });
  assert.deepEqual(card.getZonedDateIndices(instant, 'America/Los_Angeles'), { dayIndex: 6, monthIndex: 9 });
  assert.equal(card.getLocalizedDayNameFull(instant, 'Asia/Tokyo'), 'Sunday');
  assert.equal(card.getLocalizedMonthName(instant, 'Asia/Tokyo'), 'November');
  assert.equal(card.getLocalizedMonthNameShort(instant, 'America/Los_Angeles'), 'OCT');
});

test('#3 autoscroll drops past slots before limiting the column count', () => {
  const card = makeCard({ autoscroll: true, forecast: { type: 'hourly' } });
  const hour = 60 * 60 * 1000;
  const now = Date.now();
  card.forecasts = [-3, -2, 0, 1, 2, 3].map((h) => ({ datetime: new Date(now + h * hour).toISOString(), temperature: 10 }));
  const visible = card.getVisibleForecast(3);
  assert.equal(visible.length, 3);
  assert.equal(visible[0], card.forecasts[2]);
  // The chart is built from the same slice as the icon and wind rows.
  assert.deepEqual(card.computeForecastData({ config: card.config, forecastItems: 3 }).forecast, visible);
});

test('#4 missing or unavailable alternative sensors fall back to the weather entity', () => {
  const card = makeCard();
  const hass = { states: {
    'sensor.ok': { state: '21.5', attributes: {} },
    'sensor.down': { state: 'unavailable', attributes: {} },
  } };
  assert.equal(card.readSensorState(hass, 'sensor.ok', 10), '21.5');
  assert.equal(card.readSensorState(hass, 'sensor.down', 10), 10);
  assert.equal(card.readSensorState(hass, 'sensor.renamed', 10), 10);
  assert.equal(card.readSensorState(hass, undefined, 10), 10);
});

test('#5 #13 the stub and the card share one set of defaults', () => {
  const stub = WeatherChartCard.getStubConfig({}, ['weather.home'], ['weather.home']);
  assert.equal(stub.entity, 'weather.home');
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (typeof value !== 'object') assert.equal(stub[key], value, key);
  }
  assert.deepEqual(stub.forecast, FORECAST_DEFAULTS);
  assert.equal(typeof stub.forecast.labels_font_size, 'number');
  assert.equal(makeCard().config.show_feels_like, false);
  // The editor reads absent keys from the same defaults.
  assert.equal(configValue({}, 'show_feels_like'), false);
  assert.equal(configValue({}, 'animated_icons'), true);
  assert.equal(configValue({ forecast: {} }, 'forecast.show_wind_forecast'), true);
  assert.equal(configValue({ forecast: { round_temp: true } }, 'forecast.round_temp'), true);
});

test('#7 Norwegian resolves through both nb and no', () => {
  assert.notEqual(makeCard({ locale: 'nb' }).ll('daily'), makeCard({ locale: 'en' }).ll('daily'));
  assert.equal(makeCard({ locale: 'no' }).ll('daily'), makeCard({ locale: 'nb' }).ll('daily'));
  assert.equal(makeCard({ locale: 'no' }).getLocaleArray('days')[0], makeCard({ locale: 'nb' }).getLocaleArray('days')[0]);
});

test('#10 precipitation bars use the display unit, with a matching axis ceiling', () => {
  const card = makeCard({ units: { precipitation: 'mm' } }, {
    states: { 'weather.home': { state: 'rainy', attributes: { precipitation_unit: 'in', supported_features: 1 } } },
  });
  card.forecasts = [{ datetime: '2026-10-21T00:00:00Z', temperature: 10, precipitation: 0.5 }];
  assert.deepEqual(card.computeForecastData({ config: card.config, forecastItems: 1 }).precip, [12.7]);
  assert.equal(card.getPrecipitationAxisMax('mm', true), 4);
  assert.equal(card.getPrecipitationAxisMax('mm', false), 20);
  assert.equal(card.getPrecipitationAxisMax('cm', false), 2);
  assert.equal(card.getPrecipitationAxisMax('in', false), 1);
});

test('#11 pressure converts between every Home Assistant unit', () => {
  const card = makeCard();
  assert.deepEqual(card.formatPressure(1013.25, 'hPa', 'inHg'), { value: '29.92', unit: 'inHg' });
  assert.deepEqual(card.formatPressure(1013.25, 'mbar', 'hPa'), { value: 1013, unit: 'hPa' });
  assert.deepEqual(card.formatPressure(101.325, 'kPa', 'hPa'), { value: 1013, unit: 'hPa' });
  assert.deepEqual(card.formatPressure(14.696, 'psi', 'mmHg'), { value: 760, unit: 'mmHg' });
  assert.deepEqual(card.formatPressure(1013.25, 'hPa', 'kPa'), { value: '101.3', unit: 'kPa' });
  // An unknown unit is shown as reported, labelled with its own unit.
  assert.deepEqual(card.formatPressure(1013.25, 'weird', 'hPa'), { value: 1013, unit: 'weird' });
  assert.deepEqual(card.formatPressure(undefined, 'hPa', 'hPa'), { value: undefined, unit: 'hPa' });
});

test('#16 unknown and unavailable conditions fall back to Home Assistant translations', () => {
  const card = makeCard({ locale: 'en' }, {
    localize: (key) => ({ 'state.default.unavailable': 'Unavailable' })[key] || '',
  });
  assert.equal(card.localizeCondition('rainy'), 'Rainy');
  assert.equal(card.localizeCondition('unavailable'), 'Unavailable');
  assert.equal(card.localizeCondition('unknown'), 'unknown');
});

test('#17 the card is listed in the picker once', () => {
  assert.equal(window.customCards.filter((card) => card.type === 'weather-chart-card-ha').length, 1);
});

test('#14 README option tables list the defaults the card uses', async () => {
  const { readFileSync } = await import('node:fs');
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const section = (heading) => readme.split(heading)[1].split('\n### ')[0];
  const tableDefaults = (text) => Object.fromEntries(text.split('\n')
    .filter((line) => /^\| [a-z_0-9]+ *\|/.test(line))
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .map(([, name, , value]) => [name, value.replace(/^'(.*)'$/, '$1')]));

  const tables = [
    [section('### Card Options'), DEFAULTS],
    [section('### Forecast Options'), FORECAST_DEFAULTS],
    [section('### Units of Measurement'), DEFAULTS.units],
  ];
  for (const [text, defaults] of tables) {
    const documented = tableDefaults(text);
    for (const [key, value] of Object.entries(defaults)) {
      if (typeof value === 'object') continue;
      assert.ok(key in documented, `${key} is not documented`);
      assert.equal(documented[key], String(value), `README default for ${key}`);
    }
  }
  assert.ok(!readme.includes('location_name') && !readme.includes('condition_icon_size_multiplier'));
});

test('auto-rotate interval is minutes plus 0/5/10/15/30 seconds, 5 s to 60 min 30 s', () => {
  const ms = (forecast) => makeCard({ forecast }).getAutoRotateMs();
  assert.equal(ms({}), 0);
  assert.equal(ms({ auto_rotate: 0, auto_rotate_seconds: 0 }), 0);
  assert.equal(ms({ auto_rotate: 0, auto_rotate_seconds: 5 }), 5000);
  assert.equal(ms({ auto_rotate: '2', auto_rotate_seconds: 30 }), 150000);
  assert.equal(ms({ auto_rotate: 60, auto_rotate_seconds: 30 }), 3630000);
  // Out of range minutes clamp; seconds outside the dropdown are ignored.
  assert.equal(ms({ auto_rotate: 90, auto_rotate_seconds: 7 }), 3600000);
});

test('auto-rotate keeps both subscriptions, switches instantly, and a click restarts the timer', (t) => {
  let now = 0;
  t.mock.method(Date, 'now', () => now);
  t.mock.timers.enable(['setTimeout']);
  const tick = (ms) => {
    now += ms;
    t.mock.timers.tick(ms);
  };
  const subscribed = [];
  const callbacks = {};
  const supported = { state: 'sunny', attributes: { supported_features: 3 } };
  const card = makeCard({ forecast: { auto_rotate: 0, auto_rotate_seconds: 10, type: 'daily' } }, {
    states: { 'weather.home': supported },
    connection: { subscribeMessage(callback, message) {
      subscribed.push(message.forecast_type);
      callbacks[message.forecast_type] = callback;
      return Promise.resolve(() => {});
    } },
  });
  card.drawChart = () => {};
  card.updateChart = () => {};

  card.syncForecastSubscriptions();
  assert.deepEqual(subscribed.sort(), ['daily', 'hourly']);
  const daily = [{ datetime: '2026-10-21T12:00:00Z', temperature: 20 }];
  const hourly = [{ datetime: '2026-10-21T13:00:00Z', temperature: 18 }];
  callbacks.daily({ forecast: daily });
  callbacks.hourly({ forecast: hourly });
  assert.equal(card.forecasts, daily);

  card.startAutoRotate();
  tick(10000);
  assert.equal(card.config.forecast.type, 'hourly');
  assert.equal(card.forecasts, hourly, 'switches to the cached payload at once');
  assert.equal(subscribed.length, 2, 'no re-subscribe on a rotation');

  // Click 4 s into the next interval: switch now, next auto switch 10 s later.
  tick(4000);
  card.handleForecastToggleClick();
  assert.equal(card.config.forecast.type, 'daily');
  tick(9999);
  assert.equal(card.config.forecast.type, 'daily');
  tick(1);
  assert.equal(card.config.forecast.type, 'hourly');
  card.stopAutoRotate();
});

test('without auto-rotate only the forecast on screen stays subscribed', () => {
  const subscribed = [];
  const card = makeCard({ forecast: { type: 'daily' } }, {
    states: { 'weather.home': { state: 'sunny', attributes: { supported_features: 3 } } },
    connection: { subscribeMessage(callback, message) {
      subscribed.push(message.forecast_type);
      return Promise.resolve(() => {});
    } },
  });
  card.syncForecastSubscriptions();
  card.handleForecastTypeToggle();
  assert.deepEqual(subscribed, ['daily', 'hourly']);
  assert.deepEqual(Object.keys(card._forecastSubscriptions), ['hourly']);
});

test('a single-point temperature gradient has a valid stop offset', () => {
  const card = makeCard();
  const stops = [];
  const ctx = { createLinearGradient: () => ({ addColorStop(offset, color) {
    // CanvasGradient.addColorStop throws on a non-finite offset.
    if (!Number.isFinite(offset) || offset < 0 || offset > 1) throw new RangeError(`bad offset ${offset}`);
    stops.push([offset, color]);
  } }) };
  const area = { left: 0, right: 100 };
  card.createTemperatureGradient([12], '°C', ctx, area);
  assert.deepEqual(stops.map(([offset]) => offset), [0]);
  stops.length = 0;
  card.createTemperatureGradient([12, 15, 18], '°C', ctx, area);
  assert.deepEqual(stops.map(([offset]) => offset), [0, 0.5, 1]);
});

test('auto-rotate targets the next boundary, so a late timeout does not drift', (t) => {
  // Hand-driven clock and timers, so a timeout can be delivered late.
  let now = 0;
  let pending = null;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => (pending = { callback, at: now + delay }));
  t.mock.method(globalThis, 'clearTimeout', () => { pending = null; });
  const fire = (at) => { now = at; const { callback } = pending; pending = null; callback(); };

  const card = makeCard({ forecast: { auto_rotate: 0, auto_rotate_seconds: 10 } }, {
    states: { 'weather.home': { state: 'sunny', attributes: { supported_features: 3 } } },
  });
  card.handleForecastTypeToggle = () => {};
  card.startAutoRotate();
  assert.equal(pending.at, 10000);
  fire(25000); // throttled: 15 s late
  assert.equal(pending.at, 30000, 'back on the shared boundary, not 35 s');
  fire(29999); // early by 1 ms: must not switch again for the same boundary
  assert.equal(pending.at, 40000);

  // A click 4 s after a boundary: full interval from the click, then that cadence.
  now = 44000;
  card.startAutoRotate({ fromNow: true });
  assert.equal(pending.at, 54000);
  fire(61000);
  assert.equal(pending.at, 64000);
  card.stopAutoRotate();
});

test('config changes select the cached forecast before redrawing', async () => {
  const callbacks = {};
  const supported = { state: 'sunny', attributes: { supported_features: 3 } };
  const card = makeCard({ forecast: { auto_rotate: 1, type: 'daily' } }, {
    states: { 'weather.home': supported },
    connection: { subscribeMessage(callback, message) {
      callbacks[message.forecast_type] = callback;
      return Promise.resolve(() => {});
    } },
  });
  const drawnForecasts = [];
  card.drawChart = () => drawnForecasts.push(card.forecasts);
  card.getUpdateComplete = async () => true;
  card.syncForecastSubscriptions();

  const daily = [{ datetime: '2026-10-21T12:00:00Z', temperature: 20 }];
  const hourly = [{ datetime: '2026-10-21T13:00:00Z', temperature: 18 }];
  callbacks.daily({ forecast: daily });
  callbacks.hourly({ forecast: hourly });

  const oldConfig = card.config;
  card.config = { ...oldConfig, forecast: { ...oldConfig.forecast, type: 'hourly', auto_rotate: 0 } };
  await card.updated(new Map([['config', oldConfig]]));

  assert.equal(card.forecasts, hourly);
  assert.equal(drawnForecasts.at(-1), hourly);
  assert.deepEqual(Object.keys(card._forecastSubscriptions), ['hourly']);
});

test('animated icons are bundled, in the configured style, with custom icons first', async () => {
  const { readFileSync } = await import('node:fs');
  const { generateIconModule } = await import('../scripts/build-icons.mjs');
  const generated = readFileSync(new URL('../src/icon-data.js', import.meta.url), 'utf8');
  assert.equal(generated, generateIconModule(), 'src/icon-data.js is stale: run npm run icons');

  const decode = (uri) => decodeURIComponent(uri.replace('data:image/svg+xml,', ''));
  const style1 = makeCard().getWeatherIcon('sunny', 'above_horizon');
  assert.match(style1, /^data:image\/svg\+xml,/);
  assert.equal(decode(style1), readFileSync(new URL('../src/icons/clear-day.svg', import.meta.url), 'utf8').trim());
  const style2 = makeCard({ icon_style: 'style2' }).getWeatherIcon('sunny', 'below_horizon');
  assert.equal(decode(style2), readFileSync(new URL('../src/icons2/clear-night.svg', import.meta.url), 'utf8').trim());

  assert.equal(makeCard({ icons: '/local/w/' }).getWeatherIcon('rainy', 'below_horizon'), '/local/w/overcast-night-rain.svg');
  assert.equal(makeCard({ animated_icons: false }).getWeatherIcon('rainy'), 'hass:weather-rainy');
  // A condition with no image (or no MDI icon) still gets an icon.
  assert.equal(makeCard().getWeatherIcon('unavailable'), 'mdi:weather-cloudy-alert');
  assert.equal(makeCard({ icons: '/local/w/' }).getWeatherIcon('unknown'), 'mdi:weather-cloudy-alert');
});

test('gestures: tap, hold and double tap, each only when configured', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { GestureDetector, HOLD_MS, DOUBLE_TAP_MS } = actions;
  const fired = [];
  let options = { hold: false, doubleTap: false };
  const g = new GestureDetector((action) => fired.push(action), () => options);

  // Nothing but a tap configured: a long press is still a tap, fired at once.
  g.down(0, 0); t.mock.timers.tick(HOLD_MS + 100); g.up();
  assert.deepEqual(fired, ['tap']);

  options = { hold: true, doubleTap: true };
  fired.length = 0;
  g.down(0, 0); t.mock.timers.tick(HOLD_MS); g.up();
  assert.deepEqual(fired, ['hold'], 'release after a hold is not also a tap');

  fired.length = 0;
  g.down(0, 0); g.up(); g.down(0, 0); g.up();
  assert.deepEqual(fired, ['double_tap']);

  fired.length = 0;
  g.down(0, 0); g.up(); t.mock.timers.tick(DOUBLE_TAP_MS);
  assert.deepEqual(fired, ['tap'], 'a single tap waits for a possible second one');

  fired.length = 0;
  g.down(0, 0); g.move(0, 30); g.up(); t.mock.timers.tick(HOLD_MS + DOUBLE_TAP_MS);
  assert.deepEqual(fired, [], 'a scroll is not a tap');
});

test('card actions fire hass-action with the entity, only for configured gestures', () => {
  const card = makeCard({ tap_action: { action: 'more-info' }, hold_action: { action: 'none' } });
  const events = [];
  card._fire = (type, detail) => events.push({ type, detail });
  assert.equal(card.hasCardActions(), true);
  card.handleCardAction('hold');
  card.handleCardAction('double_tap');
  card.handleCardAction('tap');
  assert.deepEqual(events, [{ type: 'hass-action', detail: {
    config: { entity: 'weather.home', tap_action: { action: 'more-info' }, hold_action: { action: 'none' }, double_tap_action: undefined },
    action: 'tap',
  } }]);
  assert.equal(makeCard().hasCardActions(), false);
});

test('condition names come from Home Assistant when the card shows its language', () => {
  const localize = (key) => ({ 'component.weather.entity_component._.state.rainy': 'Ploios' })[key] || '';
  assert.equal(makeCard({}, { language: 'ro', localize }).localizeCondition('rainy'), 'Ploios');
  assert.equal(makeCard({ locale: 'ro-RO' }, { language: 'ro', localize }).localizeCondition('rainy'), 'Ploios');
  // A card locale other than Home Assistant's keeps the card's own translation.
  assert.equal(makeCard({ locale: 'de' }, { language: 'ro', localize }).localizeCondition('rainy'), makeCard({ locale: 'de' }).ll('rainy'));
  // Without a Home Assistant translation the card's own is used.
  assert.equal(makeCard({ locale: 'en' }, { language: 'en', localize: () => '' }).localizeCondition('sunny'), 'Sunny');
});

test('a missing low leaves a gap instead of shifting later lows', () => {
  const card = makeCard({}, { states: { 'weather.home': { state: 'sunny', attributes: { supported_features: 1 } } } });
  card.forecasts = [
    { datetime: '2026-10-21T00:00:00Z', temperature: 20, precipitation_probability: 40 },
    { datetime: '2026-10-22T00:00:00Z', temperature: 18, templow: 9, precipitation_probability: null },
    { datetime: '2026-10-23T00:00:00Z', temperature: 17, templow: null },
  ];
  const data = card.computeForecastData({ config: card.config, forecastItems: 3 });
  assert.deepEqual(data.tempLow, [null, 9, null]);
  assert.deepEqual(data.probability, [40, null, null]);
});

test('hourly slots are night between sunset and sunrise at the card location', () => {
  const card = makeCard({ sun_latitude: 51.5, sun_longitude: 0, sun_timezone: 'Europe/London' });
  const location = { ...card.getSunLocation(), timeZone: card.getSunTimezone() };
  assert.equal(card.isForecastSlotDaytime(new Date('2026-06-21T12:00:00Z'), location), true);
  assert.equal(card.isForecastSlotDaytime(new Date('2026-06-21T23:00:00Z'), location), false);
  // No coordinates and no sun entity: treat as day rather than shading everything.
  const nowhere = makeCard();
  nowhere._hass.config = { time_zone: 'UTC' };
  assert.equal(nowhere.isForecastSlotDaytime(new Date('2026-06-21T23:00:00Z')), true);
});

test('withAlpha re-tints rgb, rgba and hex colors', () => {
  const card = makeCard();
  assert.equal(card.withAlpha('rgba(255, 152, 0, 1.0)', 0.2), 'rgba(255, 152, 0, 0.2)');
  assert.equal(card.withAlpha('rgb(1,2,3)', 0.5), 'rgba(1, 2, 3, 0.5)');
  assert.equal(card.withAlpha('#f80', 0.2), 'rgba(255, 136, 0, 0.2)');
  assert.equal(card.withAlpha('#4473a0', 0.2), 'rgba(68, 115, 160, 0.2)');
  assert.equal(card.withAlpha('orange', 0.2), 'rgba(127, 127, 127, 0.2)');
});

test('round_temp rounds the current temperature and feels like too', () => {
  assert.equal(makeCard({ forecast: { round_temp: true } }).roundTemperature(11.3), 11);
  assert.equal(makeCard({ forecast: { round_temp: true } }).roundTemperature(11.6), 12);
  assert.equal(String(makeCard({ forecast: { round_temp: true } }).roundTemperature(-0.4)), '0');
  assert.equal(makeCard().roundTemperature(11.36), 11.4);
  assert.ok(Number.isNaN(makeCard().roundTemperature(NaN)));
});
