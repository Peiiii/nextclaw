#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import sys
import tempfile
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from socketserver import ThreadingMixIn
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlsplit
from urllib.request import Request, urlopen

SOURCE_BASE_URL = os.environ.get("NEXTCLAW_MARKETPLACE_SOURCE", "https://marketplace-api.nextclaw.io")
DATA_DIR = Path(os.environ.get("NEXTCLAW_MARKETPLACE_MIRROR_DIR", "/opt/nextclaw-marketplace-mirror"))
CACHE_DIR = DATA_DIR / "cache"
RESPONSES_DIR = CACHE_DIR / "responses"
MANIFEST_PATH = DATA_DIR / "manifest.json"
DEFAULT_TIMEOUT_SECONDS = 20
DEFAULT_PAGE_SIZE = 100
DEFAULT_CACHE_TTL_SECONDS = int(os.environ.get("NEXTCLAW_MARKETPLACE_MIRROR_CACHE_TTL", "600"))

JSON_ALLOWED_PREFIXES = (
    "/api/v1/skills/",
    "/api/v1/plugins/",
    "/api/v1/mcp/",
)


def utc_now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def atomic_write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("wb", dir=str(path.parent), delete=False) as handle:
        handle.write(content)
        temp_name = handle.name
    os.replace(temp_name, path)


def canonical_path_query(path_query):
    parsed = urlsplit(path_query)
    query = urlencode(sorted(parse_qsl(parsed.query, keep_blank_values=True)))
    return parsed.path + (f"?{query}" if query else "")


def cache_key(path_query):
    return hashlib.sha256(canonical_path_query(path_query).encode("utf-8")).hexdigest()


def cache_paths(path_query):
    key = cache_key(path_query)
    return RESPONSES_DIR / f"{key}.body", RESPONSES_DIR / f"{key}.meta.json"


def load_json(path, default):
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        return default
    except json.JSONDecodeError:
        return default


def json_bytes(payload):
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def source_url(path_query):
    return f"{SOURCE_BASE_URL.rstrip('/')}{canonical_path_query(path_query)}"


def fetch_source(path_query, timeout=DEFAULT_TIMEOUT_SECONDS, attempts=3):
    request = Request(source_url(path_query), headers={"user-agent": "nextclaw-marketplace-mirror/1.0"})
    last_error = None
    for attempt in range(1, attempts + 1):
        try:
            with urlopen(request, timeout=timeout) as response:
                body = response.read()
                return {
                    "status": response.status,
                    "contentType": response.headers.get("content-type", "application/octet-stream"),
                    "contentDisposition": response.headers.get("content-disposition"),
                    "skillFileSha256": response.headers.get("x-skill-file-sha256"),
                    "body": body,
                }
        except HTTPError as error:
            body = error.read()
            return {
                "status": error.code,
                "contentType": error.headers.get("content-type", "application/json"),
                "contentDisposition": error.headers.get("content-disposition"),
                "skillFileSha256": error.headers.get("x-skill-file-sha256"),
                "body": body,
            }
        except (OSError, TimeoutError, URLError) as error:
            last_error = error
            if attempt < attempts:
                time.sleep(min(attempt * 2, 5))
    raise URLError(last_error)


def write_cache(path_query, fetched):
    path_query = canonical_path_query(path_query)
    body_path, meta_path = cache_paths(path_query)
    atomic_write(body_path, fetched["body"])
    meta = {
        "path": path_query,
        "source": source_url(path_query),
        "status": fetched["status"],
        "contentType": fetched["contentType"],
        "contentDisposition": fetched["contentDisposition"],
        "skillFileSha256": fetched["skillFileSha256"],
        "cachedAt": utc_now_iso(),
        "sizeBytes": len(fetched["body"]),
    }
    atomic_write(meta_path, json_bytes(meta))
    return meta


def read_cache(path_query):
    path_query = canonical_path_query(path_query)
    body_path, meta_path = cache_paths(path_query)
    if not body_path.exists() or not meta_path.exists():
        return None
    return {
        "body": body_path.read_bytes(),
        "meta": load_json(meta_path, {}),
    }


def fetch_and_cache(path_query):
    path_query = canonical_path_query(path_query)
    fetched = fetch_source(path_query)
    meta = write_cache(path_query, fetched)
    return {
        "body": fetched["body"],
        "meta": meta,
    }


def cache_is_fresh(cached, now=None):
    cached_at = cached.get("meta", {}).get("cachedAt")
    if not cached_at:
        return False
    try:
        timestamp = datetime.fromisoformat(cached_at.replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return False
    current_time = time.time() if now is None else now
    return current_time - timestamp < DEFAULT_CACHE_TTL_SECONDS


def resolve_cached_response(path_query):
    path_query = canonical_path_query(path_query)
    cached = read_cache(path_query)
    if cached is None:
        return fetch_and_cache(path_query), "miss-filled"
    if cache_is_fresh(cached):
        return cached, "hit"
    try:
        return fetch_and_cache(path_query), "stale-refreshed"
    except (URLError, TimeoutError, RuntimeError, OSError):
        return cached, "stale-if-error"


def json_from_cached(path_query):
    cached = read_cache(path_query)
    if cached is None:
        cached = fetch_and_cache(path_query)
    try:
        return json.loads(cached["body"].decode("utf-8"))
    except json.JSONDecodeError as error:
        raise RuntimeError(f"invalid json from {path_query}: {error}") from error


def prewarm_path(path_query):
    cached = fetch_and_cache(path_query)
    status = cached["meta"].get("status", 0)
    if status < 200 or status >= 300:
        raise RuntimeError(f"{path_query} returned HTTP {status}")
    return cached


def sync_snapshot():
    started_at = utc_now_iso()
    prewarm_path("/health")
    scenes = prewarm_path("/api/v1/skills/scenes")
    recommendations = prewarm_path("/api/v1/skills/recommendations")

    slugs = []
    failed = []
    total = 0
    total_pages = 1
    page = 1
    while page <= total_pages:
        path_query = f"/api/v1/skills/items?page={page}&pageSize={DEFAULT_PAGE_SIZE}"
        cached = prewarm_path(path_query)
        payload = json.loads(cached["body"].decode("utf-8"))
        data = payload.get("data", {})
        total = data.get("total", total)
        total_pages = data.get("totalPages", total_pages)
        for item in data.get("items", []):
            slug = item.get("slug")
            if slug:
                slugs.append(slug)
        page += 1

    file_count = 0
    for slug in sorted(set(slugs)):
        try:
            prewarm_path(f"/api/v1/skills/items/{slug}")
            prewarm_path(f"/api/v1/skills/items/{slug}/content")
            files_payload = json_from_cached(f"/api/v1/skills/items/{slug}/files")
            files_data = files_payload.get("data", {})
            for file_item in files_data.get("files", []):
                download_path = file_item.get("downloadPath")
                if download_path:
                    prewarm_path(download_path)
                    file_count += 1
        except (RuntimeError, URLError, TimeoutError, OSError) as error:
            failed.append({"slug": slug, "error": str(error)})
            print(f"sync warning: {slug}: {error}", file=sys.stderr)

    manifest = {
        "schemaVersion": 1,
        "source": SOURCE_BASE_URL,
        "storage": "snapshot-mirror",
        "startedAt": started_at,
        "generatedAt": utc_now_iso(),
        "skills": {
            "total": total,
            "pages": total_pages,
            "slugs": sorted(set(slugs)),
            "fileCount": file_count,
            "failed": failed,
        },
        "prewarmed": {
            "scenesBytes": scenes["meta"].get("sizeBytes", 0),
            "recommendationsBytes": recommendations["meta"].get("sizeBytes", 0),
        },
    }
    atomic_write(MANIFEST_PATH, json_bytes(manifest))
    return manifest


class MirrorHandler(BaseHTTPRequestHandler):
    server_version = "NextClawMarketplaceMirror/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - - [%s] %s\n" % (self.address_string(), self.log_date_time_string(), fmt % args))

    def add_common_headers(self):
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-headers", "authorization, content-type")
        self.send_header("access-control-allow-methods", "GET,HEAD,OPTIONS")
        self.send_header("x-nextclaw-marketplace-mirror", "read-only")

    def write_json(self, status, payload):
        body = json_bytes(payload)
        self.send_response(status)
        self.add_common_headers()
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.add_common_headers()
        self.end_headers()

    def do_HEAD(self):
        self.do_GET()

    def do_POST(self):
        self.write_json(405, read_only_error())

    def do_PUT(self):
        self.write_json(405, read_only_error())

    def do_PATCH(self):
        self.write_json(405, read_only_error())

    def do_DELETE(self):
        self.write_json(405, read_only_error())

    def do_GET(self):
        parsed = urlsplit(self.path)
        path_query = canonical_path_query(parsed.path + (f"?{parsed.query}" if parsed.query else ""))
        if parsed.path == "/health":
            self.write_json(200, health_payload())
            return
        if not is_allowed_read_path(parsed.path):
            self.write_json(404, {
                "ok": False,
                "error": {
                    "code": "MIRROR_NOT_FOUND",
                    "message": "domestic marketplace mirror only serves public read endpoints",
                },
            })
            return

        try:
            cached, cache_status = resolve_cached_response(path_query)
        except (URLError, TimeoutError, RuntimeError, OSError) as error:
            self.write_json(502, {
                "ok": False,
                "error": {
                    "code": "MIRROR_CACHE_MISS",
                    "message": "requested resource is not cached and source fetch failed",
                },
                "source": SOURCE_BASE_URL,
                "detail": str(error),
            })
            return

        meta = cached["meta"]
        body = cached["body"]
        self.send_response(int(meta.get("status", 200)))
        self.add_common_headers()
        self.send_header("content-type", meta.get("contentType") or "application/octet-stream")
        self.send_header("content-length", str(len(body)))
        self.send_header("x-nextclaw-mirror-cache", cache_status)
        self.send_header("x-nextclaw-mirror-cached-at", meta.get("cachedAt", "unknown"))
        if meta.get("contentDisposition"):
            self.send_header("content-disposition", meta["contentDisposition"])
        if meta.get("skillFileSha256"):
            self.send_header("x-skill-file-sha256", meta["skillFileSha256"])
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


def read_only_error():
    return {
        "ok": False,
        "error": {
            "code": "MIRROR_READ_ONLY",
            "message": "domestic marketplace mirror is read-only",
        },
    }


def is_allowed_read_path(path):
    return path == "/health" or any(path.startswith(prefix) for prefix in JSON_ALLOWED_PREFIXES)


def health_payload():
    manifest = load_json(MANIFEST_PATH, {})
    return {
        "ok": True,
        "status": "ok",
        "service": "nextclaw-marketplace-mirror",
        "storage": "snapshot-mirror",
        "source": SOURCE_BASE_URL,
        "generatedAt": manifest.get("generatedAt"),
        "skills": manifest.get("skills"),
    }


def serve(host, port):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    RESPONSES_DIR.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((host, port), MirrorHandler)
    print(f"serving NextClaw marketplace mirror on {host}:{port}", flush=True)
    server.serve_forever()


def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command")
    serve_parser = subparsers.add_parser("serve")
    serve_parser.add_argument("--host", default="127.0.0.1")
    serve_parser.add_argument("--port", type=int, default=8787)
    subparsers.add_parser("sync")
    args = parser.parse_args()
    if args.command is None:
        parser.error("command is required")

    if args.command == "serve":
        serve(args.host, args.port)
    elif args.command == "sync":
        manifest = sync_snapshot()
        print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
