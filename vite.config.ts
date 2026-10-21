import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import hacs from './hacs.json' with { type: 'json' };
import { TAG_NAMES_DEV, TAG_NAMES_PROD } from './src/config/tag-names.ts';

export default defineConfig(({ mode }) => {
  const isDevBuild = mode === 'development';

  return {
    define: {
      __DEV_BUILD__: JSON.stringify(isDevBuild),
    },
    plugins: [
      {
        name: 'dev-card-css-scope',
        enforce: 'pre',
        transform(code, id) {
          if (isDevBuild && id.split('?')[0].endsWith('/ui/styles.css')) {
            return code.replaceAll(TAG_NAMES_PROD.card, TAG_NAMES_DEV.card);
          }
        },
        transformIndexHtml(html) {
          return isDevBuild ? html.replaceAll(TAG_NAMES_PROD.card, TAG_NAMES_DEV.card) : html;
        },
      },
      isDevBuild && visualizer({ filename: 'dist/bundle-stats.html', open: false, gzipSize: true, template: 'treemap' }),
    ],
    build: {
      outDir: 'dist',
      lib: {
        entry: 'src/main.ts',
        formats: ['es'],
        fileName: () => (isDevBuild ? hacs.filename.replace(/\.js$/, '-dev.js') : hacs.filename),
      },
    },
  };
});
