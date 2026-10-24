import resolve from '@rollup/plugin-node-resolve';
import serve from 'rollup-plugin-serve';
import copy from 'rollup-plugin-copy';
import terser from '@rollup/plugin-terser';
import cardVersion from './rollup.version.mjs';

const dev = process.env.ROLLUP_WATCH;

const serveopts = {
  contentBase: ['./dist'],
  host: '0.0.0.0',
  port: 5500,
  allowCrossOrigin: true,
  headers: {
    'Access-Control-Allow-Origin': '*',
  },
};

export default {
  input: 'src/main.js',
  output: {
    file: 'dist/weather-chart-card-ha.js',
    format: 'iife',
    name: 'WeatherChartCard',
    sourcemap: dev ? true : false,
  },
  plugins: [
    resolve(),
    cardVersion(),
    !dev && terser(),
    dev && serve(serveopts),
    copy({
      targets: [
        { src: 'src/icons/*', dest: 'dist/icons' },
        { src: 'src/icons2/*', dest: 'dist/icons2' }
      ]
    })
  ],
};
