import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { extname, join, relative } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

const DEFAULT_MINIMUM_BYTES = 1024;
const GZIP_SUFFIX = ".gz";
const COMPRESSIBLE_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".map",
  ".mjs",
  ".svg",
  ".txt",
  ".xml",
]);

function listFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files.sort();
}

export class UiDistPrecompressionManager {
  constructor({ minimumBytes = DEFAULT_MINIMUM_BYTES, rootDir }) {
    this.minimumBytes = minimumBytes;
    this.rootDir = rootDir;
  }

  prepare = () => {
    this.assertRoot();
    for (const filePath of listFiles(this.rootDir)) {
      if (filePath.endsWith(GZIP_SUFFIX)) {
        rmSync(filePath);
      }
    }
    for (const candidate of this.listCandidates()) {
      writeFileSync(candidate.sidecarPath, gzipSync(candidate.content, { level: 9 }));
    }
    return this.verify();
  };

  verify = () => {
    this.assertRoot();
    const candidates = this.listCandidates();
    if (candidates.length === 0) {
      throw new Error(`UI distribution has no precompression candidates in ${this.rootDir}.`);
    }
    const expectedSidecars = new Set(candidates.map((candidate) => candidate.sidecarPath));
    const actualSidecars = listFiles(this.rootDir).filter((filePath) =>
      filePath.endsWith(GZIP_SUFFIX)
    );
    for (const sidecarPath of actualSidecars) {
      if (!expectedSidecars.has(sidecarPath)) {
        throw new Error(
          `UI distribution contains an unexpected gzip sidecar: ${relative(this.rootDir, sidecarPath)}.`,
        );
      }
    }
    let gzipBytes = 0;
    let rawBytes = 0;
    for (const candidate of candidates) {
      if (!existsSync(candidate.sidecarPath)) {
        throw new Error(
          `UI distribution is missing gzip sidecar: ${relative(this.rootDir, candidate.sidecarPath)}.`,
        );
      }
      const compressed = readFileSync(candidate.sidecarPath);
      let decompressed;
      try {
        decompressed = gunzipSync(compressed);
      } catch (error) {
        throw new Error(
          `UI distribution has an invalid gzip sidecar: ${relative(this.rootDir, candidate.sidecarPath)}.`,
          { cause: error },
        );
      }
      if (!decompressed.equals(candidate.content)) {
        throw new Error(
          `UI distribution has a stale gzip sidecar: ${relative(this.rootDir, candidate.sidecarPath)}.`,
        );
      }
      gzipBytes += compressed.length;
      rawBytes += candidate.content.length;
    }
    return { fileCount: candidates.length, gzipBytes, rawBytes };
  };

  assertRoot = () => {
    if (!existsSync(this.rootDir)) {
      throw new Error(`UI distribution directory does not exist: ${this.rootDir}.`);
    }
  };

  listCandidates = () =>
    listFiles(this.rootDir)
      .filter((filePath) => !filePath.endsWith(GZIP_SUFFIX))
      .filter((filePath) => COMPRESSIBLE_EXTENSIONS.has(extname(filePath).toLowerCase()))
      .map((filePath) => ({
        content: readFileSync(filePath),
        filePath,
        sidecarPath: `${filePath}${GZIP_SUFFIX}`,
      }))
      .filter((candidate) => candidate.content.length >= this.minimumBytes);
}
