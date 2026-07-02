// vite.config.ts
import { defineConfig } from "file:///D:/Projects/only-training/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Projects/only-training/node_modules/@vitejs/plugin-react/dist/index.mjs";
import tailwindcss from "file:///D:/Projects/only-training/node_modules/@tailwindcss/vite/dist/index.mjs";
import { VitePWA } from "file:///D:/Projects/only-training/node_modules/vite-plugin-pwa/dist/index.js";
import { sentryVitePlugin } from "file:///D:/Projects/only-training/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
import { readFileSync } from "node:fs";
var __vite_injected_original_import_meta_url = "file:///D:/Projects/only-training/vite.config.ts";
var sentryEnabled = !!process.env.SENTRY_AUTH_TOKEN;
var pkg = JSON.parse(readFileSync(new URL("./package.json", __vite_injected_original_import_meta_url), "utf8"));
var vite_config_default = defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  base: "/",
  build: {
    sourcemap: sentryEnabled,
    // gerado só p/ upload; os .map são apagados antes do deploy
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@sentry")) return "sentry";
          if (id.includes("i18next") || id.includes("react-i18next")) return "i18n";
          if (id.includes("date-fns")) return "date";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("react-router")) return "router";
          return "vendor";
        }
      }
    }
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      includeAssets: ["favicon.png"],
      manifest: {
        id: "/",
        name: "OnlyTraining",
        short_name: "OnlyTraining",
        description: "Seu app de treino definitivo",
        lang: "pt-BR",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/?source=pwa",
        scope: "/",
        categories: ["health", "fitness", "lifestyle"],
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            // TODO(T2): substituir por um PNG maskable dedicado com safe-zone
            // (ícone ocupando ~80% central). Gerar em https://maskable.app
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"]
      }
    }),
    sentryEnabled && sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // gh-pages é público: sobe os maps pro Sentry e apaga do dist
      sourcemaps: { filesToDeleteAfterUpload: "dist/**/*.map" }
    })
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxQcm9qZWN0c1xcXFxvbmx5LXRyYWluaW5nXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxQcm9qZWN0c1xcXFxvbmx5LXRyYWluaW5nXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9Qcm9qZWN0cy9vbmx5LXRyYWluaW5nL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAnQHRhaWx3aW5kY3NzL3ZpdGUnXHJcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnXHJcbmltcG9ydCB7IHNlbnRyeVZpdGVQbHVnaW4gfSBmcm9tICdAc2VudHJ5L3ZpdGUtcGx1Z2luJ1xyXG5pbXBvcnQgeyByZWFkRmlsZVN5bmMgfSBmcm9tICdub2RlOmZzJ1xyXG5cclxuLy8gVXBsb2FkIGRlIHNvdXJjZSBtYXBzIHNcdTAwRjMgcXVhbmRvIG8gdG9rZW4gZXhpc3RlIChDSSk7IGJ1aWxkIGxvY2FsIGZpY2EgaWd1YWwuXHJcbmNvbnN0IHNlbnRyeUVuYWJsZWQgPSAhIXByb2Nlc3MuZW52LlNFTlRSWV9BVVRIX1RPS0VOXHJcblxyXG4vLyBMXHUwMEVBIGEgdmVyc1x1MDBFM28gZGlyZXRvIGRvIHBhY2thZ2UuanNvbiBubyBtb21lbnRvIGRvIGJ1aWxkIChyb2J1c3RvOiBwZWdhIG8gdmFsb3JcclxuLy8galx1MDBFMSBidW1wYWRvIHBlbG8gcHJlZGVwbG95LCBzZW0gZGVwZW5kZXIgZGEgZW52IHZhciBucG1fcGFja2FnZV92ZXJzaW9uKS5cclxuY29uc3QgcGtnID0gSlNPTi5wYXJzZShyZWFkRmlsZVN5bmMobmV3IFVSTCgnLi9wYWNrYWdlLmpzb24nLCBpbXBvcnQubWV0YS51cmwpLCAndXRmOCcpKVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBkZWZpbmU6IHtcclxuICAgIF9fQVBQX1ZFUlNJT05fXzogSlNPTi5zdHJpbmdpZnkocGtnLnZlcnNpb24pLFxyXG4gIH0sXHJcbiAgYmFzZTogJy8nLFxyXG4gIGJ1aWxkOiB7XHJcbiAgICBzb3VyY2VtYXA6IHNlbnRyeUVuYWJsZWQsIC8vIGdlcmFkbyBzXHUwMEYzIHAvIHVwbG9hZDsgb3MgLm1hcCBzXHUwMEUzbyBhcGFnYWRvcyBhbnRlcyBkbyBkZXBsb3lcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XHJcbiAgICAgICAgICBpZiAoIWlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKSkgcmV0dXJuXHJcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ0BzdXBhYmFzZScpKSByZXR1cm4gJ3N1cGFiYXNlJ1xyXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdAc2VudHJ5JykpIHJldHVybiAnc2VudHJ5J1xyXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdpMThuZXh0JykgfHwgaWQuaW5jbHVkZXMoJ3JlYWN0LWkxOG5leHQnKSkgcmV0dXJuICdpMThuJ1xyXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdkYXRlLWZucycpKSByZXR1cm4gJ2RhdGUnXHJcbiAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2x1Y2lkZS1yZWFjdCcpKSByZXR1cm4gJ2ljb25zJ1xyXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdyZWFjdC1yb3V0ZXInKSkgcmV0dXJuICdyb3V0ZXInXHJcbiAgICAgICAgICByZXR1cm4gJ3ZlbmRvcidcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9LFxyXG4gIHBsdWdpbnM6IFtcclxuICAgIHJlYWN0KCksXHJcbiAgICB0YWlsd2luZGNzcygpLFxyXG4gICAgVml0ZVBXQSh7XHJcbiAgICAgIHN0cmF0ZWdpZXM6ICdpbmplY3RNYW5pZmVzdCcsXHJcbiAgICAgIHNyY0RpcjogJ3NyYycsXHJcbiAgICAgIGZpbGVuYW1lOiAnc3cudHMnLFxyXG4gICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJyxcclxuICAgICAgaW5jbHVkZUFzc2V0czogWydmYXZpY29uLnBuZyddLFxyXG4gICAgICBtYW5pZmVzdDoge1xyXG4gICAgICAgIGlkOiAnLycsXHJcbiAgICAgICAgbmFtZTogJ09ubHlUcmFpbmluZycsXHJcbiAgICAgICAgc2hvcnRfbmFtZTogJ09ubHlUcmFpbmluZycsXHJcbiAgICAgICAgZGVzY3JpcHRpb246ICdTZXUgYXBwIGRlIHRyZWlubyBkZWZpbml0aXZvJyxcclxuICAgICAgICBsYW5nOiAncHQtQlInLFxyXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnIzBhMGEwYScsXHJcbiAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogJyMwYTBhMGEnLFxyXG4gICAgICAgIGRpc3BsYXk6ICdzdGFuZGFsb25lJyxcclxuICAgICAgICBvcmllbnRhdGlvbjogJ3BvcnRyYWl0JyxcclxuICAgICAgICBzdGFydF91cmw6ICcvP3NvdXJjZT1wd2EnLFxyXG4gICAgICAgIHNjb3BlOiAnLycsXHJcbiAgICAgICAgY2F0ZWdvcmllczogWydoZWFsdGgnLCAnZml0bmVzcycsICdsaWZlc3R5bGUnXSxcclxuICAgICAgICBpY29uczogW1xyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBzcmM6ICdwd2EtMTkyeDE5Mi5wbmcnLFxyXG4gICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxyXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcclxuICAgICAgICAgICAgcHVycG9zZTogJ2FueSdcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHNyYzogJ3B3YS01MTJ4NTEyLnBuZycsXHJcbiAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXHJcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxyXG4gICAgICAgICAgICBwdXJwb3NlOiAnYW55J1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgLy8gVE9ETyhUMik6IHN1YnN0aXR1aXIgcG9yIHVtIFBORyBtYXNrYWJsZSBkZWRpY2FkbyBjb20gc2FmZS16b25lXHJcbiAgICAgICAgICAgIC8vIChcdTAwRURjb25lIG9jdXBhbmRvIH44MCUgY2VudHJhbCkuIEdlcmFyIGVtIGh0dHBzOi8vbWFza2FibGUuYXBwXHJcbiAgICAgICAgICAgIHNyYzogJ3B3YS1tYXNrYWJsZS01MTJ4NTEyLnBuZycsXHJcbiAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXHJcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxyXG4gICAgICAgICAgICBwdXJwb3NlOiAnbWFza2FibGUnXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgXVxyXG4gICAgICB9LFxyXG4gICAgICB3b3JrYm94OiB7XHJcbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbJyoqLyoue2pzLGNzcyxodG1sLGljbyxwbmcsc3ZnfSddLFxyXG4gICAgICB9XHJcbiAgICB9KSxcclxuICAgIHNlbnRyeUVuYWJsZWQgJiYgc2VudHJ5Vml0ZVBsdWdpbih7XHJcbiAgICAgIG9yZzogcHJvY2Vzcy5lbnYuU0VOVFJZX09SRyxcclxuICAgICAgcHJvamVjdDogcHJvY2Vzcy5lbnYuU0VOVFJZX1BST0pFQ1QsXHJcbiAgICAgIGF1dGhUb2tlbjogcHJvY2Vzcy5lbnYuU0VOVFJZX0FVVEhfVE9LRU4sXHJcbiAgICAgIC8vIGdoLXBhZ2VzIFx1MDBFOSBwXHUwMEZBYmxpY286IHNvYmUgb3MgbWFwcyBwcm8gU2VudHJ5IGUgYXBhZ2EgZG8gZGlzdFxyXG4gICAgICBzb3VyY2VtYXBzOiB7IGZpbGVzVG9EZWxldGVBZnRlclVwbG9hZDogJ2Rpc3QvKiovKi5tYXAnIH0sXHJcbiAgICB9KVxyXG4gIF0sXHJcbn0pXHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBbVEsU0FBUyxvQkFBb0I7QUFDaFMsT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBQ3hCLFNBQVMsZUFBZTtBQUN4QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLG9CQUFvQjtBQUxrSSxJQUFNLDJDQUEyQztBQVFoTixJQUFNLGdCQUFnQixDQUFDLENBQUMsUUFBUSxJQUFJO0FBSXBDLElBQU0sTUFBTSxLQUFLLE1BQU0sYUFBYSxJQUFJLElBQUksa0JBQWtCLHdDQUFlLEdBQUcsTUFBTSxDQUFDO0FBRXZGLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFFBQVE7QUFBQSxJQUNOLGlCQUFpQixLQUFLLFVBQVUsSUFBSSxPQUFPO0FBQUEsRUFDN0M7QUFBQSxFQUNBLE1BQU07QUFBQSxFQUNOLE9BQU87QUFBQSxJQUNMLFdBQVc7QUFBQTtBQUFBLElBQ1gsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sYUFBYSxJQUFJO0FBQ2YsY0FBSSxDQUFDLEdBQUcsU0FBUyxjQUFjLEVBQUc7QUFDbEMsY0FBSSxHQUFHLFNBQVMsV0FBVyxFQUFHLFFBQU87QUFDckMsY0FBSSxHQUFHLFNBQVMsU0FBUyxFQUFHLFFBQU87QUFDbkMsY0FBSSxHQUFHLFNBQVMsU0FBUyxLQUFLLEdBQUcsU0FBUyxlQUFlLEVBQUcsUUFBTztBQUNuRSxjQUFJLEdBQUcsU0FBUyxVQUFVLEVBQUcsUUFBTztBQUNwQyxjQUFJLEdBQUcsU0FBUyxjQUFjLEVBQUcsUUFBTztBQUN4QyxjQUFJLEdBQUcsU0FBUyxjQUFjLEVBQUcsUUFBTztBQUN4QyxpQkFBTztBQUFBLFFBQ1Q7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQSxJQUNaLFFBQVE7QUFBQSxNQUNOLFlBQVk7QUFBQSxNQUNaLFFBQVE7QUFBQSxNQUNSLFVBQVU7QUFBQSxNQUNWLGNBQWM7QUFBQSxNQUNkLGVBQWUsQ0FBQyxhQUFhO0FBQUEsTUFDN0IsVUFBVTtBQUFBLFFBQ1IsSUFBSTtBQUFBLFFBQ0osTUFBTTtBQUFBLFFBQ04sWUFBWTtBQUFBLFFBQ1osYUFBYTtBQUFBLFFBQ2IsTUFBTTtBQUFBLFFBQ04sYUFBYTtBQUFBLFFBQ2Isa0JBQWtCO0FBQUEsUUFDbEIsU0FBUztBQUFBLFFBQ1QsYUFBYTtBQUFBLFFBQ2IsV0FBVztBQUFBLFFBQ1gsT0FBTztBQUFBLFFBQ1AsWUFBWSxDQUFDLFVBQVUsV0FBVyxXQUFXO0FBQUEsUUFDN0MsT0FBTztBQUFBLFVBQ0w7QUFBQSxZQUNFLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxZQUNOLFNBQVM7QUFBQSxVQUNYO0FBQUEsVUFDQTtBQUFBLFlBQ0UsS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFlBQ04sU0FBUztBQUFBLFVBQ1g7QUFBQSxVQUNBO0FBQUE7QUFBQTtBQUFBLFlBR0UsS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFlBQ04sU0FBUztBQUFBLFVBQ1g7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLE1BQ0EsU0FBUztBQUFBLFFBQ1AsY0FBYyxDQUFDLGdDQUFnQztBQUFBLE1BQ2pEO0FBQUEsSUFDRixDQUFDO0FBQUEsSUFDRCxpQkFBaUIsaUJBQWlCO0FBQUEsTUFDaEMsS0FBSyxRQUFRLElBQUk7QUFBQSxNQUNqQixTQUFTLFFBQVEsSUFBSTtBQUFBLE1BQ3JCLFdBQVcsUUFBUSxJQUFJO0FBQUE7QUFBQSxNQUV2QixZQUFZLEVBQUUsMEJBQTBCLGdCQUFnQjtBQUFBLElBQzFELENBQUM7QUFBQSxFQUNIO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
