module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  settings: {
    react: {
      version: "detect"
    }
  },
  ignorePatterns: ["dist", "node_modules", "tailwind.config.js"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react-hooks/set-state-in-effect": "off",
    "prefer-destructuring": ["warn", {
      "VariableDeclarator": {
        "array": false,
        "object": true
      },
      "AssignmentExpression": {
        "array": false,
        "object": false
      }
    }],
    "max-lines": ["warn", { "max": 800, "skipBlankLines": true, "skipComments": true }],
    "max-lines-per-function": ["warn", { "max": 150, "skipBlankLines": true, "skipComments": true, "IIFEs": true }]
  },
  overrides: [
    {
      files: ["src/components/**/*.tsx", "src/App.tsx"],
      rules: {
        "max-lines-per-function": ["warn", { "max": 300, "skipBlankLines": true, "skipComments": true, "IIFEs": true }]
      }
    }
  ]
};
