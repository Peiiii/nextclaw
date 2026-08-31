import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const metricKeys = ["rssMiB", "pssMiB", "physicalFootprintMiB"];

export async function stableMetrics(pid) {
  const samples = [];
  for (let index = 0; index < 5; index += 1) {
    await delay(120);
    samples.push(await readMetrics(pid));
  }
  return medianMetrics(samples);
}

export async function stableTotalMetrics(pids) {
  const samples = [];
  for (let index = 0; index < 5; index += 1) {
    await delay(120);
    samples.push(sumMetrics(await Promise.all(pids.map(readMetrics))));
  }
  return medianMetrics(samples);
}

export function subtractMetrics(left, right) {
  return mapMetrics((key) => left[key] === null || right[key] === null
    ? null
    : roundMiB(left[key] - right[key]));
}

export function divideMetrics(metrics, divisor) {
  return mapMetrics((key) => metrics[key] === null ? null : roundMiB(metrics[key] / divisor));
}

async function readMetrics(pid) {
  const result = spawnSync("ps", ["-o", "rss=", "-p", String(pid)], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error(`unable to read RSS for pid ${pid}: ${result.stderr}`);
  }
  return {
    rssMiB: roundMiB(Number.parseInt(result.stdout.trim(), 10) / 1024),
    pssMiB: process.platform === "linux" ? await linuxPssMiB(pid) : null,
    physicalFootprintMiB: process.platform === "darwin" ? darwinPhysicalFootprintMiB(pid) : null,
  };
}

async function linuxPssMiB(pid) {
  try {
    const content = await readFile(`/proc/${pid}/smaps_rollup`, "utf8");
    const match = content.match(/^Pss:\s+(\d+)\s+kB$/m);
    return match ? roundMiB(Number.parseInt(match[1], 10) / 1024) : null;
  } catch {
    return null;
  }
}

function darwinPhysicalFootprintMiB(pid) {
  const result = spawnSync("footprint", ["--noCategories", "-f", "bytes", "-p", String(pid)], {
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  const match = result.stdout.match(/phys_footprint:\s+(\d+)\s+B/);
  return match ? roundMiB(Number.parseInt(match[1], 10) / (1024 * 1024)) : null;
}

function sumMetrics(metrics) {
  return mapMetrics((key) => metrics.some((value) => value[key] === null)
    ? null
    : roundMiB(metrics.reduce((sum, value) => sum + value[key], 0)));
}

function medianMetrics(samples) {
  return mapMetrics((key) => {
    const values = samples
      .map((sample) => sample[key])
      .filter((value) => value !== null)
      .sort((a, b) => a - b);
    return values.length ? values[Math.floor(values.length / 2)] : null;
  });
}

function mapMetrics(mapper) {
  return Object.fromEntries(metricKeys.map((key) => [key, mapper(key)]));
}

function roundMiB(value) {
  return Math.round(value * 100) / 100;
}
