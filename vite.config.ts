import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // Use relative paths for Electron packaging
  base: './',

  // Path aliases
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Standard Vite configuration
  clearScreen: false,
  server: {
    port: 3000,  // Standard React dev server port
    strictPort: true,
    hmr: {
      port: 3001,
    },
  },
  
  build: {
    outDir: 'dist',
  },
}));
