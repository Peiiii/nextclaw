import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolveRepoPath } from '../../shared/repo-paths.mjs';

const repoRoot = resolveRepoPath(import.meta.url);
const defaultRepository = 'Peiiii/nextclaw';
const defaultOutput = 'images/metrics/nextclaw-star-history.svg';

function readOption(name) {
  const exactIndex = process.argv.indexOf(name);
  if (exactIndex >= 0) {
    return process.argv[exactIndex + 1];
  }
  const inline = process.argv.find((argument) => argument.startsWith(`${name}=`));
  return inline?.slice(name.length + 1);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github.star+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'nextclaw-visual-assets'
  };
}

async function fetchGitHubJson(url, token) {
  const response = await fetch(url, { headers: githubHeaders(token) });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`GitHub API ${response.status} for ${url}: ${detail}`);
  }
  return { data: await response.json(), link: response.headers.get('link') || '' };
}

async function fetchStarHistory(repository, token) {
  const stars = [];
  for (let page = 1; page <= 100; page += 1) {
    const url = `https://api.github.com/repos/${repository}/stargazers?per_page=100&page=${page}`;
    const result = await fetchGitHubJson(url, token);
    if (!Array.isArray(result.data)) {
      throw new Error('GitHub stargazers response was not an array');
    }
    stars.push(...result.data);
    if (!result.link.includes('rel="next"')) {
      break;
    }
  }
  return stars
    .map((entry) => new Date(entry.starred_at))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());
}

function niceMaximum(value) {
  if (value <= 5) {
    return 5;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const multiplier = [1, 1.25, 1.5, 2, 2.5, 5, 10].find((candidate) => normalized <= candidate) || 10;
  return multiplier * magnitude;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

function formatUpdatedDate(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Shanghai'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function buildChartSvg({ repository, stars, repositoryInfo }) {
  const plot = { left: 72, right: 954, top: 118, bottom: 374 };
  const startDate = new Date(repositoryInfo.created_at);
  const endDate = new Date();
  const startTime = startDate.getTime();
  const endTime = Math.max(endDate.getTime(), startTime + 1);
  const totalStars = Math.max(repositoryInfo.stargazers_count, stars.length);
  const yMaximum = niceMaximum(totalStars);
  const x = (date) => plot.left + ((date.getTime() - startTime) / (endTime - startTime)) * (plot.right - plot.left);
  const y = (count) => plot.bottom - (count / yMaximum) * (plot.bottom - plot.top);
  const points = [{ date: startDate, count: 0 }, ...stars.map((date, index) => ({ date, count: index + 1 }))];
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.date).toFixed(1)} ${y(point.count).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${x(points.at(-1).date).toFixed(1)} ${plot.bottom} L ${plot.left} ${plot.bottom} Z`;
  const xTicks = Array.from({ length: 6 }, (_, index) => new Date(startTime + ((endTime - startTime) * index) / 5));
  const yTicks = Array.from({ length: 6 }, (_, index) => (yMaximum * index) / 5);
  const updatedDate = formatUpdatedDate(endDate);
  const finalPoint = points.at(-1);

  const grid = yTicks.map((value) => {
    const position = y(value).toFixed(1);
    return `<line x1="${plot.left}" y1="${position}" x2="${plot.right}" y2="${position}" stroke="#e5e7eb" stroke-width="1"/><text x="${plot.left - 14}" y="${Number(position) + 5}" text-anchor="end" font-size="13" fill="#6b7280">${Math.round(value)}</text>`;
  }).join('');
  const dates = xTicks.map((date, index) => {
    const position = x(date).toFixed(1);
    const anchor = index === 0 ? 'start' : index === xTicks.length - 1 ? 'end' : 'middle';
    return `<text x="${position}" y="${plot.bottom + 32}" text-anchor="${anchor}" font-size="13" fill="#6b7280">${escapeXml(formatDate(date))}</text>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="440" viewBox="0 0 1000 440" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(repository)} GitHub star history</title>
  <desc id="description">Cumulative GitHub stars from ${escapeXml(formatDate(startDate))} to ${updatedDate}, totaling ${totalStars} stars.</desc>
  <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f7d68" stop-opacity="0.28"/><stop offset="1" stop-color="#2f7d68" stop-opacity="0.03"/></linearGradient></defs>
  <rect x="0.5" y="0.5" width="999" height="439" rx="12" fill="#ffffff" stroke="#dfe3e8"/>
  <text x="48" y="50" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="26" font-weight="700" fill="#1f2937">NextClaw &#183; GitHub Stars</text>
  <text x="48" y="78" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="15" fill="#667085">Cumulative star growth over time</text>
  <text x="952" y="52" text-anchor="end" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="30" font-weight="700" fill="#2f7d68">&#9733; ${totalStars}</text>
  <text x="952" y="78" text-anchor="end" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="13" fill="#667085">Updated ${updatedDate}</text>
  <g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">${grid}${dates}</g>
  <path d="${areaPath}" fill="url(#area)"/>
  <path d="${linePath}" fill="none" stroke="#2f7d68" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${x(finalPoint.date).toFixed(1)}" cy="${y(finalPoint.count).toFixed(1)}" r="6" fill="#ffffff" stroke="#2f7d68" stroke-width="4"/>
</svg>`;
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: GITHUB_TOKEN=<token> pnpm run assets:refresh-star-history [-- --repo owner/name --output path]');
    return;
  }
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN or GH_TOKEN is required; locally use GITHUB_TOKEN=$(gh auth token)');
  }
  const repository = readOption('--repo') || process.env.STAR_HISTORY_REPOSITORY || defaultRepository;
  const output = readOption('--output') || defaultOutput;
  const repositoryResult = await fetchGitHubJson(`https://api.github.com/repos/${repository}`, token);
  const stars = await fetchStarHistory(repository, token);
  const svg = buildChartSvg({ repository, stars, repositoryInfo: repositoryResult.data });
  const outputPath = path.resolve(repoRoot, output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${svg}\n`, 'utf8');
  console.log(`[star-history] ${repository}: ${stars.length} timestamped stars`);
  console.log(`[star-history] updated ${path.relative(repoRoot, outputPath)}`);
}

await main().catch((error) => {
  console.error('[star-history] failed:', error);
  process.exitCode = 1;
});
