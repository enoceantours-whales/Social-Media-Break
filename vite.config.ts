import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During local dev, `vercel dev` serves the /api functions on the same origin.
// If you instead run `vite` standalone, set VITE_API_PROXY to your functions
// host (e.g. http://localhost:3000) to proxy /api calls there.
const apiProxy = process.env.VITE_API_PROXY;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: apiProxy
      ? {
          "/api": {
            target: apiProxy,
            changeOrigin: true,
          },
        }
      : undefined,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
