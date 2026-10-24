// Imports the amCharts animated weather icons (CC BY 4.0,
// https://www.amcharts.com/free-animated-svg-weather-icons/) into src/icons3,
// under the same 21 file names as src/icons and src/icons2, so `icon_style:
// style3` works with the card's condition mapping in const.js.
//
//   node scripts/import-amcharts.mjs ~/Downloads/amcharts_weather_icons_1.0.0
//
// The set has no fog, wind, hail or sleet artwork and no night rain, so those
// names get the nearest icon. One file serves day and night where the card
// uses one name for both (cloudy, snow, hail, sleet, wind).
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const AMCHARTS_MAPPING = {
  'clear-day': 'day',
  'clear-night': 'night',
  'cloudy': 'cloudy',
  'extreme-day': 'thunder',
  'extreme-night': 'thunder',
  'extreme-day-rain': 'rainy-6',
  'extreme-night-rain': 'rainy-6',
  'fog-day': 'cloudy',
  'fog-night': 'cloudy',
  'hail': 'rainy-7',
  'overcast-day-rain': 'rainy-3',
  'overcast-night-rain': 'rainy-5',
  'partly-cloudy-day': 'cloudy-day-1',
  'partly-cloudy-night': 'cloudy-night-1',
  'sleet': 'rainy-7',
  'snow': 'snowy-5',
  'thunderstorms-day': 'thunder',
  'thunderstorms-day-rain': 'thunder',
  'thunderstorms-night': 'thunder',
  'thunderstorms-night-rain': 'thunder',
  'wind': 'cloudy',
};

/**
 * Make an amCharts SVG fit the card: `viewbox` must be `viewBox` (SVG is case
 * sensitive; Chrome forgives it, Firefox and Safari do not scale the icon), and
 * the -webkit-/-moz-/-ms- copies of every CSS property are dropped, since each
 * has an unprefixed twin that all current browsers use.
 */
export function cleanSvg(svg) {
  return svg
    .replace(/\bviewbox=/, 'viewBox=')
    .split('\n')
    .filter((line) => !/^\s*-(webkit|moz|ms)-[a-z-]+\s*:[^;]*;\s*$/.test(line))
    .join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const source = join(process.argv[2] || '', 'animated');
  const target = new URL('../src/icons3/', import.meta.url);
  const reference = readdirSync(new URL('../src/icons/', import.meta.url)).filter((f) => f.endsWith('.svg')).sort();
  const names = Object.keys(AMCHARTS_MAPPING).map((name) => `${name}.svg`).sort();
  if (JSON.stringify(reference) !== JSON.stringify(names)) {
    throw new Error('The mapping must cover exactly the file names in src/icons.');
  }
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target);
  for (const [name, file] of Object.entries(AMCHARTS_MAPPING)) {
    writeFileSync(new URL(`${name}.svg`, target), cleanSvg(readFileSync(join(source, `${file}.svg`), 'utf8')));
  }
  console.log(`Wrote ${names.length} icons to src/icons3`);
}
