import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { site, base } from './src/lib/site.mjs';
export default defineConfig({
  site: site.origin, base, output: 'static', trailingSlash: 'always',
  integrations: [mdx()],
  devToolbar: { enabled: false },
  markdown: { shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } } },
});
