#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const INCLUDED_ROOTS = new Set(["packages", "apps", "workers"])
const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"])
const IGNORED_DIRS = new Set([
  ".git",
  ".changeset",
  "node_modules",
  "dist",
  "coverage",
  "build",
  "ui-dist",
  ".turbo",
  "release",
  "out",
  ".next",
  ".wrangler",
  ".temp",
])

const TEST_FILE_WARNING_LINES = 300
const TEST_FILE_BLOCKER_LINES = 500
const TEST_FILE_WARNING_CASES = 15
const TEST_FILE_BLOCKER_CASES = 25
const TEST_FILE_WARNING_MOCKS = 5
const TEST_FILE_BLOCKER_MOCKS = 10

const PACKAGE_RATIO_WARNING = 0.35
const PACKAGE_RATIO_BLOCKER = 0.5
const PACKAGE_WARNING_TEST_LINES = 1000
const PACKAGE_BLOCKER_TEST_LINES = 1500

function parseArgs(argv) {
  return {
    json: argv.includes("--json"),
    failOnThresholds: argv.includes("--fail-on-thresholds"),
  }
}

function shouldSkipDirectory(dirPath) {
  return dirPath.split(path.sep).some((segment) => IGNORED_DIRS.has(segment))
}

function isCodeFile(fileName) {
  return CODE_EXTENSIONS.has(path.extname(fileName))
}

function isTestFile(fileName) {
  return fileName.includes(".test.") || fileName.includes(".spec.") || fileName.endsWith("-test.mjs")
}

function isTrackedSourcePath(relativePath) {
  const normalized = relativePath.split(path.sep).join(path.posix.sep)
  return normalized.includes("/src/") || normalized.includes("/tests/")
}

function resolveScope(relativePath) {
  const parts = relativePath.split(path.sep)
  if (parts[0] === "packages" && (parts[1] === "extensions" || parts[1] === "ncp-packages")) {
    return parts.slice(0, 3).join("/")
  }
  if (parts[0] === "apps" && parts[1] === "ncp-demo") {
    return parts.slice(0, 3).join("/")
  }
  return parts.slice(0, 2).join("/")
}

function countMatches(text, pattern) {
  return (text.match(pattern) ?? []).length
}

function detectStatus(blockerReasons, warningReasons) {
  if (blockerReasons.length > 0) {
    return "blocker"
  }
  if (warningReasons.length > 0) {
    return "warning"
  }
  return "ok"
}

function severityWeight(status) {
  if (status === "blocker") {
    return 2
  }
  if (status === "warning") {
    return 1
  }
  return 0
}

function formatRatio(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00"
}

function collectMetrics() {
  const packageMetrics = new Map()
  const testFiles = []
  let repositorySourceLines = 0
  let repositoryTestLines = 0
  let repositoryTestFiles = 0

  function ensureScope(scope) {
    if (!packageMetrics.has(scope)) {
      packageMetrics.set(scope, {
        scope,
        sourceLines: 0,
        testLines: 0,
        sourceFiles: 0,
        testFiles: 0,
      })
    }
    return packageMetrics.get(scope)
  }

  function walk(currentDir) {
    if (shouldSkipDirectory(currentDir)) {
      return
    }

    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(absolutePath)
        continue
      }
      if (!entry.isFile() || !isCodeFile(entry.name)) {
        continue
      }

      const relativePath = path.relative(ROOT, absolutePath)
      const topLevel = relativePath.split(path.sep)[0]
      if (!INCLUDED_ROOTS.has(topLevel) || !isTrackedSourcePath(relativePath)) {
        continue
      }

      const scope = resolveScope(relativePath)
      const scopeMetrics = ensureScope(scope)
      const text = fs.readFileSync(absolutePath, "utf8")
      const lineCount = text.split(/\r?\n/).length

      if (isTestFile(entry.name)) {
        const testCaseCount = countMatches(text, /\b(?:it|test)\s*\(/g)
        const mockCount = countMatches(text, /\b(?:vi|jest)\.(?:mock|spyOn)\s*\(/g)
        const setupCount = countMatches(text, /\b(?:beforeEach|afterEach|beforeAll|afterAll)\s*\(/g)
        const blockerReasons = []
        const warningReasons = []

        if (lineCount >= TEST_FILE_BLOCKER_LINES) {
          blockerReasons.push(`lines>=${TEST_FILE_BLOCKER_LINES}`)
        } else if (lineCount >= TEST_FILE_WARNING_LINES) {
          warningReasons.push(`lines>=${TEST_FILE_WARNING_LINES}`)
        }

        if (testCaseCount >= TEST_FILE_BLOCKER_CASES) {
          blockerReasons.push(`cases>=${TEST_FILE_BLOCKER_CASES}`)
        } else if (testCaseCount >= TEST_FILE_WARNING_CASES) {
          warningReasons.push(`cases>=${TEST_FILE_WARNING_CASES}`)
        }

        if (mockCount >= TEST_FILE_BLOCKER_MOCKS) {
          blockerReasons.push(`mocks>=${TEST_FILE_BLOCKER_MOCKS}`)
        } else if (mockCount >= TEST_FILE_WARNING_MOCKS) {
          warningReasons.push(`mocks>=${TEST_FILE_WARNING_MOCKS}`)
        }

        testFiles.push({
          path: relativePath.split(path.sep).join(path.posix.sep),
          scope,
          lines: lineCount,
          cases: testCaseCount,
          mocks: mockCount,
          setups: setupCount,
          blockerReasons,
          warningReasons,
          status: detectStatus(blockerReasons, warningReasons),
        })

        scopeMetrics.testLines += lineCount
        scopeMetrics.testFiles += 1
        repositoryTestLines += lineCount
        repositoryTestFiles += 1
      } else {
        scopeMetrics.sourceLines += lineCount
        scopeMetrics.sourceFiles += 1
        repositorySourceLines += lineCount
      }
    }
  }

  walk(ROOT)

  const packages = [...packageMetrics.values()]
    .map((entry) => {
      const ratio = entry.sourceLines > 0 ? entry.testLines / entry.sourceLines : 0
      const blockerReasons = []
      const warningReasons = []

      if (entry.testLines >= PACKAGE_BLOCKER_TEST_LINES && ratio >= PACKAGE_RATIO_BLOCKER) {
        blockerReasons.push(`ratio>=${PACKAGE_RATIO_BLOCKER}`)
      } else if (entry.testLines >= PACKAGE_WARNING_TEST_LINES && ratio >= PACKAGE_RATIO_WARNING) {
        warningReasons.push(`ratio>=${PACKAGE_RATIO_WARNING}`)
      }

      return {
        ...entry,
        ratio,
        blockerReasons,
        warningReasons,
        status: detectStatus(blockerReasons, warningReasons),
      }
    })
    .filter((entry) => entry.testFiles > 0)
    .sort((left, right) => {
      const severityDiff = severityWeight(right.status) - severityWeight(left.status)
      if (severityDiff !== 0) {
        return severityDiff
      }
      if (right.ratio !== left.ratio) {
        return right.ratio - left.ratio
      }
      return right.testLines - left.testLines
    })

  const fileHotspots = testFiles.sort((left, right) => {
    const severityDiff = severityWeight(right.status) - severityWeight(left.status)
    if (severityDiff !== 0) {
      return severityDiff
    }
    if (right.lines !== left.lines) {
      return right.lines - left.lines
    }
    return right.cases - left.cases
  })

  return {
    generatedAt: new Date().toISOString(),
    thresholds: {
      testFile: {
        warningLines: TEST_FILE_WARNING_LINES,
        blockerLines: TEST_FILE_BLOCKER_LINES,
        warningCases: TEST_FILE_WARNING_CASES,
        blockerCases: TEST_FILE_BLOCKER_CASES,
        warningMocks: TEST_FILE_WARNING_MOCKS,
        blockerMocks: TEST_FILE_BLOCKER_MOCKS,
      },
      package: {
        warningRatio: PACKAGE_RATIO_WARNING,
        blockerRatio: PACKAGE_RATIO_BLOCKER,
        warningTestLines: PACKAGE_WARNING_TEST_LINES,
        blockerTestLines: PACKAGE_BLOCKER_TEST_LINES,
      },
    },
    totals: {
      sourceLines: repositorySourceLines,
      testLines: repositoryTestLines,
      testFiles: repositoryTestFiles,
      ratio: repositorySourceLines > 0 ? repositoryTestLines / repositorySourceLines : 0,
    },
    packages,
    fileHotspots,
  }
}

function printHuman(report) {
  console.log("Test governance report")
  console.log(`Generated at: ${report.generatedAt}`)
  console.log(
    `Repository ratio: ${formatRatio(report.totals.ratio)} (${report.totals.testLines} test lines / ${report.totals.sourceLines} source lines)`
  )
  console.log(`Test files scanned: ${report.totals.testFiles}`)

  const packageAlerts = report.packages.filter((entry) => entry.status !== "ok")
  console.log("")
  console.log(`Package hotspots: ${packageAlerts.length}`)
  for (const entry of packageAlerts.slice(0, 10)) {
    const reasons = [...entry.blockerReasons, ...entry.warningReasons].join(", ")
    console.log(
      `- [${entry.status}] ${entry.scope} ratio=${formatRatio(entry.ratio)} testLines=${entry.testLines} sourceLines=${entry.sourceLines} reasons=${reasons}`
    )
  }

  const fileAlerts = report.fileHotspots.filter((entry) => entry.status !== "ok")
  console.log("")
  console.log(`Test file hotspots: ${fileAlerts.length}`)
  for (const entry of fileAlerts.slice(0, 15)) {
    const reasons = [...entry.blockerReasons, ...entry.warningReasons].join(", ")
    console.log(
      `- [${entry.status}] ${entry.path} lines=${entry.lines} cases=${entry.cases} mocks=${entry.mocks} setups=${entry.setups} reasons=${reasons}`
    )
  }

  console.log("")
  console.log("Governance rules of thumb")
  console.log(`- warning package ratio: >= ${PACKAGE_RATIO_WARNING} with at least ${PACKAGE_WARNING_TEST_LINES} test lines`)
  console.log(`- blocker package ratio: >= ${PACKAGE_RATIO_BLOCKER} with at least ${PACKAGE_BLOCKER_TEST_LINES} test lines`)
  console.log(`- warning test file: >= ${TEST_FILE_WARNING_LINES} lines, >= ${TEST_FILE_WARNING_CASES} cases, or >= ${TEST_FILE_WARNING_MOCKS} mocks`)
  console.log(`- blocker test file: >= ${TEST_FILE_BLOCKER_LINES} lines, >= ${TEST_FILE_BLOCKER_CASES} cases, or >= ${TEST_FILE_BLOCKER_MOCKS} mocks`)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const report = collectMetrics()
  const hasBlockers =
    report.packages.some((entry) => entry.status === "blocker") ||
    report.fileHotspots.some((entry) => entry.status === "blocker")

  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printHuman(report)
  }

  if (args.failOnThresholds && hasBlockers) {
    process.exit(1)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
