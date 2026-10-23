import { defineConfig } from 'astro/config';
export default defineConfig({
  output: 'static',
  trailingSlash: 'always',
  outDir: process.env.FOLIO_OUTPUT ? process.env.FOLIO_OUTPUT : './dist',
  build: { inlineStylesheets: 'never' },
  vite: { server: { fs: { allow: ['../..'] } } },
});
