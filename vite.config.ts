import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // Path aliases
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Standard Vite configuration
  clearScreen: false,
  server: {
    port: 1420,  // Keep same port for consistency with Tauri version
    strictPort: true,
    hmr: {
      port: 1421,
    },
  },
  
  build: {
    outDir: 'dist',
  },
}));
