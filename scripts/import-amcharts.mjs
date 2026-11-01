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
import { fileURLToPath, pathToFileURL } from 'node:url';

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

// The amCharts artwork fills only about 55% of its 64x64 frame, against 70-80%
// for the style1 icons, so it looked small at the same icons_size. Every icon
// is cropped to the same CROP_SIZE square (one scale for all), centred on its
// own content. Centres are the middle of each icon's bounding box, measured in
// Chromium over 6 s of animation so moving parts (rain, rays) stay inside; the
// largest icon is 43 units wide, so 46 leaves a margin.
export const CROP_SIZE = 46;
export const CROP_CENTERS = {
  'cloudy': [32.5, 31.5],
  'cloudy-day-1': [28.5, 30.5],
  'cloudy-night-1': [36, 31.5],
  'day': [32, 32],
  'night': [33.5, 35],
  'rainy-3': [27.5, 34],
  'rainy-5': [32, 38],
  'rainy-6': [32, 38.5],
  'rainy-7': [32, 38.5],
  'snowy-5': [33, 38.5],
  'thunder': [31.5, 38.5],
};

/**
 * Make an amCharts SVG fit the card: crop it to CROP_SIZE around `center`,
 * written as `viewBox` (SVG is case sensitive and the files say `viewbox`;
 * Chrome forgives it, Firefox and Safari do not scale the icon), and
 * the -webkit-/-moz-/-ms- copies of every CSS property are dropped, since each
 * has an unprefixed twin that all current browsers use.
 */
export function cleanSvg(svg, center = [32, 32]) {
  const [x, y] = center.map((c) => c - CROP_SIZE / 2);
  return svg
    .replace(/\bviewbox="[^"]*"/i, `viewBox="${x} ${y} ${CROP_SIZE} ${CROP_SIZE}"`)
    .split('\n')
    .filter((line) => !/^\s*-(webkit|moz|ms)-[a-z-]+\s*:[^;]*;\s*$/.test(line))
    .join('\n');
}

/**
 * Writes the mapped icons from an amCharts `animated` folder to `target`.
 * Every file is read and cleaned before the target is touched, so a wrong
 * path or a missing SVG leaves the current icons as they were.
 */
export function importIcons(source, target) {
  const icons = Object.entries(AMCHARTS_MAPPING).map(([name, file]) => [
    `${name}.svg`,
    cleanSvg(readFileSync(join(source, `${file}.svg`), 'utf8'), CROP_CENTERS[file]),
  ]);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target);
  for (const [name, svg] of icons) {
    writeFileSync(join(target, name), svg);
  }
  return icons.length;
}

// pathToFileURL encodes the path (spaces, Windows drive letters) like import.meta.url.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const reference = readdirSync(new URL('../src/icons/', import.meta.url)).filter((f) => f.endsWith('.svg')).sort();
  const names = Object.keys(AMCHARTS_MAPPING).map((name) => `${name}.svg`).sort();
  if (JSON.stringify(reference) !== JSON.stringify(names)) {
    throw new Error('The mapping must cover exactly the file names in src/icons.');
  }
  const count = importIcons(join(process.argv[2] || '', 'animated'), fileURLToPath(new URL('../src/icons3/', import.meta.url)));
  console.log(`Wrote ${count} icons to src/icons3`);
}
