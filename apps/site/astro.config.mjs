import { defineConfig } from 'astro/config';
export default defineConfig({
  base: process.env.FOLIO_BASE || '/',
  ...(process.env.FOLIO_CACHE_DIR ? { cacheDir: process.env.FOLIO_CACHE_DIR } : {}),
  output: 'static',
  trailingSlash: 'always',
  outDir: process.env.FOLIO_OUTPUT ? process.env.FOLIO_OUTPUT : './dist',
  build: { inlineStylesheets: 'never' },
  vite: {
    ...(process.env.FOLIO_CACHE_DIR ? { cacheDir: `${process.env.FOLIO_CACHE_DIR}/vite` } : {}),
    server: { fs: { allow: ['../..'] } },
  },
});
