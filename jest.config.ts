import type { Config } from "jest";

const config: Config = {
  // Use ts-jest to handle TypeScript source files
  preset: "ts-jest",

  // jsdom for component tests, node for pure logic tests
  // Individual test files can override with @jest-environment docblock
  testEnvironment: "node",

  // Map the @/* path alias to match tsconfig
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  // Only look for tests in __tests__ directory
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],

  // Transform TS/TSX with ts-jest
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },

  // Don't try to transform node_modules
  transformIgnorePatterns: ["/node_modules/"],

  // Register @testing-library/jest-dom custom matchers (toBeInTheDocument etc.)
  // after the test framework is set up in jsdom
  setupFilesAfterFramework: ["@testing-library/jest-dom"],
};

export default config;
