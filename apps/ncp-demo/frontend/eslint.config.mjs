import baseConfig from "../../../eslint.config.mjs";
import unicorn from "eslint-plugin-unicorn";

export default [
  ...baseConfig,
  {
    files: ["**/*.{ts,tsx,mjs,cjs}"],
    plugins: { unicorn },
    rules: {
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
          ignore: [/^App\.tsx$/, /^main\.tsx$/, /^vite\.config\.ts$/, /^eslint\.config\.mjs$/, /^tsconfig.*\.json$/]
        }
      ]
    }
  }
];
