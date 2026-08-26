import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  settings: {
    react: {
      version: "19.0.0"
    }
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "no-console": ["warn", { "allow": ["warn", "error", "info"] }]
  }
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "eslint.config.mjs"]
}];

export default eslintConfig;
