// vite.config.ts
import { defineConfig } from "file:///Y:/2026/ERP%20ESC%20LOG/Orbe/node_modules/vite/dist/node/index.js";
import react from "file:///Y:/2026/ERP%20ESC%20LOG/Orbe/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///Y:/2026/ERP%20ESC%20LOG/Orbe/node_modules/lovable-tagger/dist/index.js";
var __vite_injected_original_dirname = "Y:\\2026\\ERP ESC LOG\\Orbe";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false
    }
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      react: path.resolve(__vite_injected_original_dirname, "./node_modules/react"),
      "react-dom": path.resolve(__vite_injected_original_dirname, "./node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__vite_injected_original_dirname, "./node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(__vite_injected_original_dirname, "./node_modules/react/jsx-dev-runtime.js"),
      "react-dom/client": path.resolve(__vite_injected_original_dirname, "./node_modules/react-dom/client.js")
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"]
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJZOlxcXFwyMDI2XFxcXEVSUCBFU0MgTE9HXFxcXE9yYmVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIlk6XFxcXDIwMjZcXFxcRVJQIEVTQyBMT0dcXFxcT3JiZVxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vWTovMjAyNi9FUlAlMjBFU0MlMjBMT0cvT3JiZS92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0LXN3Y1wiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCB7IGNvbXBvbmVudFRhZ2dlciB9IGZyb20gXCJsb3ZhYmxlLXRhZ2dlclwiO1xuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4gKHtcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogXCI6OlwiLFxuICAgIHBvcnQ6IDgwODAsXG4gICAgaG1yOiB7XG4gICAgICBvdmVybGF5OiBmYWxzZSxcbiAgICB9LFxuICB9LFxuICBwbHVnaW5zOiBbcmVhY3QoKSwgbW9kZSA9PT0gXCJkZXZlbG9wbWVudFwiICYmIGNvbXBvbmVudFRhZ2dlcigpXS5maWx0ZXIoQm9vbGVhbiksXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXG4gICAgICByZWFjdDogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL25vZGVfbW9kdWxlcy9yZWFjdFwiKSxcbiAgICAgIFwicmVhY3QtZG9tXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9ub2RlX21vZHVsZXMvcmVhY3QtZG9tXCIpLFxuICAgICAgXCJyZWFjdC9qc3gtcnVudGltZVwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vbm9kZV9tb2R1bGVzL3JlYWN0L2pzeC1ydW50aW1lLmpzXCIpLFxuICAgICAgXCJyZWFjdC9qc3gtZGV2LXJ1bnRpbWVcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL25vZGVfbW9kdWxlcy9yZWFjdC9qc3gtZGV2LXJ1bnRpbWUuanNcIiksXG4gICAgICBcInJlYWN0LWRvbS9jbGllbnRcIjogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuL25vZGVfbW9kdWxlcy9yZWFjdC1kb20vY2xpZW50LmpzXCIpLFxuICAgIH0sXG4gICAgZGVkdXBlOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiLCBcInJlYWN0L2pzeC1ydW50aW1lXCIsIFwicmVhY3QvanN4LWRldi1ydW50aW1lXCIsIFwiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCIsIFwiQHRhbnN0YWNrL3F1ZXJ5LWNvcmVcIl0sXG4gIH0sXG59KSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXNRLFNBQVMsb0JBQW9CO0FBQ25TLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFIaEMsSUFBTSxtQ0FBbUM7QUFNekMsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixLQUFLO0FBQUEsTUFDSCxTQUFTO0FBQUEsSUFDWDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVMsQ0FBQyxNQUFNLEdBQUcsU0FBUyxpQkFBaUIsZ0JBQWdCLENBQUMsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUM5RSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsTUFDcEMsT0FBTyxLQUFLLFFBQVEsa0NBQVcsc0JBQXNCO0FBQUEsTUFDckQsYUFBYSxLQUFLLFFBQVEsa0NBQVcsMEJBQTBCO0FBQUEsTUFDL0QscUJBQXFCLEtBQUssUUFBUSxrQ0FBVyxxQ0FBcUM7QUFBQSxNQUNsRix5QkFBeUIsS0FBSyxRQUFRLGtDQUFXLHlDQUF5QztBQUFBLE1BQzFGLG9CQUFvQixLQUFLLFFBQVEsa0NBQVcsb0NBQW9DO0FBQUEsSUFDbEY7QUFBQSxJQUNBLFFBQVEsQ0FBQyxTQUFTLGFBQWEscUJBQXFCLHlCQUF5Qix5QkFBeUIsc0JBQXNCO0FBQUEsRUFDOUg7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
