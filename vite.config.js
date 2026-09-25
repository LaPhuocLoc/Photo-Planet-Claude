import { defineConfig } from 'vite';

// base './' để build chạy được ở bất kỳ đâu (GitHub Pages, Netlify, mở thư mục con...)
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1200 },
});
