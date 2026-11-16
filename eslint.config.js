import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/"] },
  js.configs.recommended,
  {
    files: ["gunsnprices.user.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.greasemonkey,
        GM: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", { caughtErrors: "none" }],
      "max-len": ["error", { code: 240, ignoreRegExpLiterals: true, ignorePattern: "^// @(icon|require) " }],
    },
  },
  {
    files: ["test/**/*.js", "tools/**/*.mjs", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];
