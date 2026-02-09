import resolve from 'rollup-plugin-node-resolve';
import serve from 'rollup-plugin-serve';
import copy from 'rollup-plugin-copy';

export default {
  input: 'src/main.js',
  output: {
    file: 'dist/weather-chart-card.js',
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    resolve(),
    copy({
      targets: [
        { src: 'src/icons/*', dest: 'dist/icons' },
        { src: 'src/icons2/*', dest: 'dist/icons2' }
      ]
    }),
    serve({
      contentBase: ['dist', '.'],
      host: '0.0.0.0',
      port: 5500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }),
  ],
  watch: {
    include: 'src/**',
  },
};
