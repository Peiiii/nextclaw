export function ok(data) {
  return {
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({ ok: true, data })
  };
}

export function fail(status, message) {
  return {
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({ ok: false, error: { code: `E${status}`, message } })
  };
}

export function raw(status, contentType, body) {
  return { status, contentType, body };
}
