// /frontend/.eslintrc.js
const { defineConfig } = require("eslint/config");

module.exports = defineConfig({
  root: true,
  ignorePatterns: ["playwright-report/", "tests/e2e/"],
  overrides: [
    {
      files: ["tests/e2e/**/*.ts", "tests/e2e/**/*.tsx"],
      rules: {
        "no-console": "off",
        "@typescript-eslint/restrict-template-expressions": "off",
      },
    },
    {
      files: ["**/*.ts", "**/*.tsx"],
      rules: {
        // main project rules here
      },
    },
  ],
});
