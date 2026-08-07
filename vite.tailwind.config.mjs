import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    outDir: 'public',
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/tailwind-entry.js',
      output: {
        entryFileNames: 'tailwind-entry.js',
        assetFileNames: (assetInfo) => assetInfo.name && assetInfo.name.endsWith('.css') ? 'tailwind.css' : '[name][extname]'
      }
    }
  }
});
