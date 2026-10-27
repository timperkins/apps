import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // react-three-fiber works by mutating live GPU objects: a render loop writes
    // straight into buffer attributes and renderer state rather than producing
    // new React state each frame. The compiler's purity and immutability rules
    // flag that pattern, so they are switched off for the 3D layer only.
    files: ["src/components/PaperModel.tsx", "src/components/Scene.tsx"],
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
    },
  },
]);

export default eslintConfig;
