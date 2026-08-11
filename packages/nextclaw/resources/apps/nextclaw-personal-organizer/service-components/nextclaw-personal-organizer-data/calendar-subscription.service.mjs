import { randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_ICS_BYTES = 5 * 1024 * 1024;

export class CalendarSubscriptionService {
  constructor({ normalizeHttpUrl, now, toIso }) {
    this.normalizeHttpUrl = normalizeHttpUrl;
    this.now = now;
    this.toIso = toIso;
  }

  sync = async (state, subscription) => {
    try {
      const content = await this.fetchCalendarText(subscription.url);
      const events = this.parseIcs(content, subscription);
      state.items = state.items.filter((item) => item.subscriptionId !== subscription.id);
      state.items.push(...events);
      subscription.lastSyncedAt = this.now();
      subscription.lastError = "";
    } catch (error) {
      subscription.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  };

  fetchCalendarText = async (url) => {
    let currentUrl = await this.requirePublicHttpUrl(url);
    for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
      const response = await fetch(currentUrl, {
        redirect: "manual",
        signal: globalThis.AbortSignal.timeout(12_000),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirectCount === 3) {
          throw new Error("calendar redirected too many times");
        }
        currentUrl = await this.requirePublicHttpUrl(
          new URL(location, currentUrl).toString(),
        );
        continue;
      }
      if (!response.ok) {
        throw new Error(`calendar returned HTTP ${response.status}`);
      }
      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_ICS_BYTES) {
        throw new Error(`calendar exceeds ${MAX_ICS_BYTES} bytes`);
      }
      const content = await response.text();
      if (Buffer.byteLength(content, "utf8") > MAX_ICS_BYTES) {
        throw new Error(`calendar exceeds ${MAX_ICS_BYTES} bytes`);
      }
      return content;
    }
    throw new Error("calendar redirect resolution failed");
  };

  requirePublicHttpUrl = async (value) => {
    const url = new URL(this.normalizeHttpUrl(value));
    if (url.username || url.password) {
      throw new Error("calendar url cannot include credentials");
    }
    const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
      throw new Error("calendar url must use a public host");
    }
    const addresses = isIP(hostname)
      ? [{ address: hostname }]
      : await lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicIpAddress(address))) {
      throw new Error("calendar url must resolve to a public host");
    }
    return url.toString();
  };

  parseIcs = (raw, subscription) => {
    const lines = raw.replace(/\r\n[ \t]/g, "").split(/\r?\n/);
    const events = [];
    let current = null;
    for (const line of lines) {
      if (line === "BEGIN:VEVENT") {
        current = {};
      } else if (line === "END:VEVENT" && current) {
        if (current.DTSTART && current.SUMMARY) {
          const start = this.parseIcsDate(current.DTSTART);
          events.push({
            id: `ics:${subscription.id}:${current.UID || randomUUID()}`,
            title: current.SUMMARY,
            start,
            end: this.parseIcsDate(current.DTEND || current.DTSTART),
            allDay: /^\d{8}$/.test(current.DTSTART),
            location: current.LOCATION || "",
            notes: current.DESCRIPTION || "",
            source: "ics",
            subscriptionId: subscription.id,
            subscriptionName: subscription.name,
            createdAt: this.now(),
            updatedAt: this.now(),
          });
        }
        current = null;
      } else if (current) {
        const separator = line.indexOf(":");
        if (separator > 0) {
          current[line.slice(0, separator).split(";")[0]] = line
            .slice(separator + 1)
            .replace(/\\n/g, "\n")
            .replace(/\\,/g, ",");
        }
      }
    }
    return events;
  };

  parseIcsDate = (value) => {
    if (/^\d{8}$/.test(value)) {
      return new Date(
        `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`,
      ).toISOString();
    }
    const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(value);
    if (!match) {
      return this.toIso(value, "ICS date");
    }
    const timezone = value.endsWith("Z") ? "Z" : "";
    return new Date(
      `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${timezone}`,
    ).toISOString();
  };
}

function isPublicIpAddress(address) {
  if (isIP(address) === 4) {
    const [first, second] = address.split(".").map(Number);
    return !(first === 0 || first === 10 || first === 127 || first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19)));
  }
  const normalized = address.toLowerCase();
  return isIP(address) === 6 &&
    normalized !== "::" && normalized !== "::1" &&
    !normalized.startsWith("fc") && !normalized.startsWith("fd") &&
    !normalized.startsWith("fe8") && !normalized.startsWith("fe9") &&
    !normalized.startsWith("fea") && !normalized.startsWith("feb") &&
    !normalized.startsWith("::ffff:");
}
