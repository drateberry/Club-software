// Minimal flat ESLint config. eslint-config-expo doesn't yet ship a
// flat entry point in v8; rather than wrap it through @eslint/eslintrc,
// we keep linting light here and rely on TypeScript + tsc --noEmit
// for type safety. The web app (app/) carries the heavier ESLint setup.
module.exports = [
  {
    ignores: [
      "node_modules/**",
      ".expo/**",
      "dist/**",
      "ios/**",
      "android/**",
    ],
  },
];
