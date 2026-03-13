import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
function isModule(id, pkg) {
    return id.includes(`/node_modules/${pkg}`) || id.includes(`\\node_modules\\${pkg}`);
}
export default defineConfig({
    plugins: [react()],
    server: {
        host: "127.0.0.1",
        port: 5173,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    // React runtime — tiny, load first, long-cached
                    if (isModule(id, "react") || isModule(id, "react-dom") || isModule(id, "react-is")) {
                        return "react";
                    }
                    // Recharts + all D3 sub-packages — heavy, chart-only
                    if (isModule(id, "recharts") || isModule(id, "victory-vendor")) {
                        return "recharts";
                    }
                    if (id.includes("node_modules/d3-") || id.includes("node_modules\\d3-")) {
                        return "recharts";
                    }
                    // Radix UI primitives — medium weight, shared across all views
                    if (isModule(id, "@radix-ui")) {
                        return "radix";
                    }
                    // date-fns — sizeable, changes infrequently
                    if (isModule(id, "date-fns")) {
                        return "date-fns";
                    }
                    // Form stack
                    if (isModule(id, "react-hook-form") || isModule(id, "@hookform") || isModule(id, "zod")) {
                        return "forms";
                    }
                    // UI widgets used by specific views
                    if (isModule(id, "vaul") || isModule(id, "cmdk") || isModule(id, "react-day-picker")) {
                        return "ui-widgets";
                    }
                    // qrcode (settings only)
                    if (isModule(id, "qrcode")) {
                        return "qrcode";
                    }
                },
            },
        },
    },
});
