export const REMOTE_QUOTA_SUMMARY_FIXTURE = {
  costModel: {
    version: 2,
    verifiedAt: "2026-07-18",
    observedThrough: "2026-07-18T09:30:00.000Z",
    partialDay: false,
    stale: false
  },
  day: {
    startsAt: "2026-07-18T00:00:00.000Z",
    resetsAt: "2026-07-19T00:00:00.000Z",
    status: "normal",
    utilization: 0.001,
    limitingResource: "durable_object_requests",
    workerRequests: {
      limit: 20000,
      actualUsed: 12,
      reserved: 0,
      remaining: 19988
    },
    durableObjectRequests: {
      limit: 20000,
      actualUsed: 12.05,
      reserved: 1.5,
      remaining: 19986.45
    }
  },
  recent: {
    bucketSeconds: 300,
    last30Minutes: { workerRequests: 8, durableObjectRequests: 8.25 },
    lastHour: { workerRequests: 12, durableObjectRequests: 12.05 },
    buckets: []
  },
  protection: {
    runawayGuard: "shadow",
    activeUntil: null
  },
  activeBrowserConnections: 2
};

export async function assertQuotaResponsiveLayout(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    progressWidths: Array.from(document.querySelectorAll('[role="progressbar"]'))
      .map((element) => element.getBoundingClientRect().width)
  }));
  if (metrics.scrollWidth !== metrics.clientWidth) {
    throw new Error(`Mobile dashboard overflows horizontally: ${JSON.stringify(metrics)}`);
  }
  if (metrics.progressWidths.length !== 3 || metrics.progressWidths.some((width) => width < 200)) {
    throw new Error(`Mobile quota progress bars collapsed: ${JSON.stringify(metrics)}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}
