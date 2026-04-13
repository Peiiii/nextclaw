import js from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";
import tsEslintPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import { FILE_DIRECTORY_BASENAME_COLLISION_ALLOWLIST } from "./scripts/governance/file-directory-basename-collision-shared.mjs";
import noFileDirectoryBasenameCollisionRule from "./scripts/governance/eslint-rules/no-file-directory-basename-collision-rule.mjs";
import preferTopLevelContextDestructuringRule from "./scripts/governance/eslint-rules/prefer-top-level-context-destructuring-rule.mjs";
import reactComponentPropsDestructuringRule from "./scripts/governance/eslint-rules/react-component-props-destructuring-rule.mjs";

const jsWorkspaceFiles = [
  "apps/**/*.{js,jsx,mjs}",
  "packages/**/*.{js,jsx,mjs}",
  "workers/**/*.{js,jsx,mjs}",
  "scripts/**/*.{js,jsx,mjs}"
];
const commonJsWorkspaceFiles = ["apps/**/*.cjs", "packages/**/*.cjs", "workers/**/*.cjs", "scripts/**/*.cjs"];
const nodeRuntimeJsFiles = [
  "scripts/**/*.{js,mjs,cjs}",
  "apps/**/scripts/**/*.{js,mjs,cjs}",
  "packages/**/scripts/**/*.{js,mjs,cjs}",
  "workers/**/scripts/**/*.{js,mjs,cjs}",
  "apps/**/{tests,__tests__}/**/*.{js,mjs,cjs}",
  "packages/**/{tests,__tests__}/**/*.{js,mjs,cjs}",
  "workers/**/{tests,__tests__}/**/*.{js,mjs,cjs}"
];
const mixedModuleConfigFiles = [
  "apps/**/tailwind.config.js",
  "apps/**/postcss.config.js",
  "packages/**/tailwind.config.js",
  "packages/**/postcss.config.js",
  "workers/**/tailwind.config.js",
  "workers/**/postcss.config.js"
];
const tsWorkspaceFiles = [
  "apps/**/*.{ts,tsx,mts,cts}",
  "packages/**/*.{ts,tsx,mts,cts}",
  "workers/**/*.{ts,tsx,mts,cts}",
  "scripts/**/*.{ts,tsx,mts,cts}"
];
const workspaceCodeFiles = [...jsWorkspaceFiles, ...commonJsWorkspaceFiles, ...tsWorkspaceFiles];
const testFiles = [
  "apps/**/*.test.{ts,tsx,mts,cts}",
  "apps/**/*.spec.{ts,tsx,mts,cts}",
  "packages/**/*.test.{ts,tsx,mts,cts}",
  "packages/**/*.spec.{ts,tsx,mts,cts}",
  "workers/**/*.test.{ts,tsx,mts,cts}",
  "workers/**/*.spec.{ts,tsx,mts,cts}",
  "apps/**/{__tests__,tests}/**/*.{ts,tsx,mts,cts}",
  "packages/**/{__tests__,tests}/**/*.{ts,tsx,mts,cts}",
  "workers/**/{__tests__,tests}/**/*.{ts,tsx,mts,cts}"
];
const uiComponentFiles = [
  "packages/nextclaw-ui/src/components/**/*.tsx",
  "packages/nextclaw-ui/src/App.tsx",
  "packages/nextclaw-agent-chat-ui/src/components/**/*.tsx"
];
const orchestratorComplexityFiles = [
  "packages/nextclaw/**/*.{ts,mts,cts}",
  "packages/nextclaw-core/**/*.{ts,mts,cts}",
  "packages/nextclaw-server/**/*.{ts,mts,cts}",
  "packages/nextclaw-openclaw-compat/**/*.{ts,mts,cts}",
  "workers/**/*.{ts,mts,cts}",
  "packages/extensions/nextclaw-channel-runtime/**/*.{ts,mts,cts}"
];

const tsEslintRecommendedOverrideRules = tsEslintPlugin.configs["eslint-recommended"].overrides?.[0]?.rules ?? {};

const sharedJsGlobals = {
  AbortController: "readonly",
  Buffer: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  console: "readonly",
  clearInterval: "readonly",
  clearTimeout: "readonly",
  fetch: "readonly",
  process: "readonly",
  setInterval: "readonly",
  setTimeout: "readonly",
  structuredClone: "readonly",
  TextDecoder: "readonly",
  TextEncoder: "readonly"
};

const browserJsGlobals = {
  CustomEvent: "readonly",
  document: "readonly",
  Event: "readonly",
  HTMLElement: "readonly",
  location: "readonly",
  navigator: "readonly",
  Node: "readonly",
  window: "readonly"
};

const commonJsGlobals = {
  __dirname: "readonly",
  __filename: "readonly",
  exports: "readonly",
  module: "readonly",
  require: "readonly"
};

const jsBaseRules = {
  ...js.configs.recommended.rules,
  ...prettier.rules,
  "max-lines": ["warn", { max: 800, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": [
    "warn",
    { max: 150, skipBlankLines: true, skipComments: true, IIFEs: true }
  ],
  "max-statements": ["warn", 30],
  "max-depth": ["warn", 4],
  "no-param-reassign": ["warn", { props: false }]
};

const baseRules = {
  ...js.configs.recommended.rules,
  ...tsEslintRecommendedOverrideRules,
  ...tsEslintPlugin.configs.recommended.rules,
  ...prettier.rules,
  "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  "@typescript-eslint/consistent-type-imports": "error",
  "max-lines": ["warn", { max: 800, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": [
    "warn",
    { max: 150, skipBlankLines: true, skipComments: true, IIFEs: true }
  ],
  "max-statements": ["warn", 30],
  "max-depth": ["warn", 4],
  "no-param-reassign": ["warn", { props: false }]
};

const nextclawPlugin = {
  rules: {
    "no-file-directory-basename-collision": noFileDirectoryBasenameCollisionRule,
    "prefer-top-level-context-destructuring": preferTopLevelContextDestructuringRule,
    "react-component-props-destructuring": reactComponentPropsDestructuringRule
  }
};

const nextclawContextDestructuringRule = [
  "warn",
  {
    objectNames: ["params", "options", "context"],
    minAccesses: 4
  }
];

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "dist/**",
      "**/*.d.ts",
      "**/.wrangler/**",
      "apps/desktop/release/**",
      "packages/nextclaw/ui-dist/**"
    ]
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off"
    }
  },
  {
    files: workspaceCodeFiles,
    plugins: {
      nextclaw: nextclawPlugin
    },
    rules: {
      "nextclaw/no-file-directory-basename-collision": [
        "error",
        {
          allowFilePaths: FILE_DIRECTORY_BASENAME_COLLISION_ALLOWLIST
        }
      ]
    }
  },
  {
    files: jsWorkspaceFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: sharedJsGlobals
    },
    rules: jsBaseRules
  },
  {
    files: commonJsWorkspaceFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...sharedJsGlobals,
        ...commonJsGlobals
      }
    },
    rules: jsBaseRules
  },
  {
    files: nodeRuntimeJsFiles,
    languageOptions: {
      globals: {
        ...sharedJsGlobals,
        ...browserJsGlobals
      }
    },
    rules: jsBaseRules
  },
  {
    files: mixedModuleConfigFiles,
    languageOptions: {
      globals: {
        ...sharedJsGlobals,
        ...commonJsGlobals
      }
    },
    rules: jsBaseRules
  },
  {
    files: tsWorkspaceFiles,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tsEslintPlugin,
      nextclaw: nextclawPlugin
    },
    rules: {
      ...baseRules,
      "nextclaw/prefer-top-level-context-destructuring": nextclawContextDestructuringRule
    }
  },
  {
    files: testFiles,
    rules: {
      "max-lines-per-function": [
        "warn",
        { max: 220, skipBlankLines: true, skipComments: true, IIFEs: true }
      ],
      "max-statements": ["warn", 45]
    }
  },
  {
    files: [
      "packages/nextclaw-openclaw-compat/**/*.{ts,tsx,mts,cts}",
      "packages/extensions/nextclaw-engine-plugin-codex-sdk/**/*.{ts,tsx,mts,cts}",
      "packages/extensions/nextclaw-engine-plugin-claude-agent-sdk/**/*.{ts,tsx,mts,cts}"
    ],
    rules: {
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "max-lines-per-function": ["warn", { max: 150, skipBlankLines: true, skipComments: true }]
    }
  },
  {
    files: ["apps/platform-console/**/*.{ts,tsx,mts,cts}", "apps/platform-admin/**/*.{ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "off"
    }
  },
  {
    files: ["workers/**/*.{ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error"
    }
  },
  {
    files: ["packages/nextclaw-ui/**/*.{ts,tsx,mts,cts}", "packages/nextclaw-agent-chat-ui/**/*.{ts,tsx,mts,cts}"],
    plugins: {
      "react-hooks": reactHooks,
      nextclaw: nextclawPlugin
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/set-state-in-effect": "off",
      "nextclaw/react-component-props-destructuring": "warn",
      "prefer-destructuring": [
        "warn",
        {
          VariableDeclarator: {
            array: false,
            object: true
          },
          AssignmentExpression: {
            array: false,
            object: false
          }
        }
      ]
    }
  },
  {
    files: uiComponentFiles,
    plugins: {
      sonarjs
    },
    rules: {
      "max-lines-per-function": [
        "warn",
        { max: 300, skipBlankLines: true, skipComments: true, IIFEs: true }
      ],
      "max-statements": ["warn", 60],
      "sonarjs/cognitive-complexity": ["warn", 18]
    }
  },
  {
    files: orchestratorComplexityFiles,
    plugins: {
      sonarjs
    },
    rules: {
      "sonarjs/cognitive-complexity": ["warn", 18]
    }
  }
];
