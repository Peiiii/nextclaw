export const redactBrowserUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname
      .split("/")
      .map(redactPathSegment)
      .join("/");
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
};

const redactPathSegment = (segment: string): string => {
  if (/^sid_[A-Za-z0-9_-]+$/.test(segment)) {
    return "sid_redacted";
  }

  return segment;
};
