import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "components/brand/aelora-mark.tsx",
        "components/auth/sign-in-form.tsx",
        "components/auth/sign-up-form.tsx",
        "components/dashboard/dashboard-overview.tsx",
        "components/shell/app-shell.tsx",
        "components/shell/app-sidebar.tsx",
        "components/shell/page-placeholder.tsx",
        "lib/navigation.ts",
        "lib/dashboard/snapshot.ts",
        "lib/auth/authorization.ts",
        "lib/auth/route-access.ts",
        "lib/auth/validation.ts",
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
