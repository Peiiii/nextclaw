import {
  assertFixedDomainOpenUrlShape,
  assertInstanceDomainOpenUrlShape,
  assertRemoteOpenUrlShape,
  extractCookie,
  queryLocalD1,
  requestJson,
  requestResolvedHost,
} from "../remote-relay-smoke-support.mjs";

async function createAndValidateOwnerOpen({
  base,
  token,
  instance,
  stableDomain,
}) {
  const response = await requestJson({
    method: "POST",
    url: `${base}/platform/remote/instances/${encodeURIComponent(instance.id)}/open`,
    token,
    body: {},
    expectedStatus: 200,
  });
  const {
    openUrl,
    fixedDomainOpenUrl,
    systemDomainOpenUrl,
    customDomainOpenUrl,
    lastUsedAt,
  } = response.body?.data ?? {};
  if (
    !openUrl ||
    !fixedDomainOpenUrl ||
    !systemDomainOpenUrl ||
    !customDomainOpenUrl ||
    !lastUsedAt
  ) {
    throw new Error(
      `Incomplete owner session response: ${JSON.stringify(response.body)}`,
    );
  }
  const remoteOpenUrl = assertRemoteOpenUrlShape(openUrl, "owner openUrl");
  assertFixedDomainOpenUrlShape(fixedDomainOpenUrl, "owner fixedDomainOpenUrl");
  const systemOpenUrl = assertInstanceDomainOpenUrlShape(
    systemDomainOpenUrl,
    instance.systemDomain,
    "owner systemDomainOpenUrl",
  );
  const customOpenUrl = assertInstanceDomainOpenUrlShape(
    customDomainOpenUrl,
    stableDomain,
    "owner customDomainOpenUrl",
  );
  const secondResponse = await requestJson({
    method: "POST",
    url: `${base}/platform/remote/instances/${encodeURIComponent(instance.id)}/open`,
    token,
    body: {},
    expectedStatus: 200,
  });
  if (
    new URL(secondResponse.body?.data?.systemDomainOpenUrl).hostname !==
      systemOpenUrl.hostname ||
    new URL(secondResponse.body?.data?.customDomainOpenUrl).hostname !==
      customOpenUrl.hostname ||
    new URL(secondResponse.body?.data?.openUrl).hostname ===
      remoteOpenUrl.hostname
  ) {
    throw new Error(
      `Owner opens must keep the instance host stable while rotating session hosts: ${JSON.stringify(secondResponse.body)}`,
    );
  }
  return { customOpenUrl, lastUsedAt, remoteOpenUrl, systemOpenUrl };
}

async function assertStableOwnerProxy({
  persistDir,
  domainOpenUrl,
  backendPort,
  stableDomain,
}) {
  const sessionSql =
    "SELECT id, last_used_at, updated_at FROM remote_sessions ORDER BY created_at DESC LIMIT 1";
  const [sessionBefore] = queryLocalD1({ persistDir, sql: sessionSql });
  if (!sessionBefore) {
    throw new Error("Missing remote session row before proxied requests.");
  }
  const redirect = await requestResolvedHost({
    hostname: domainOpenUrl.hostname,
    port: backendPort,
    path: `${domainOpenUrl.pathname}${domainOpenUrl.search}`,
    expectedStatus: 302,
  });
  const cookie = extractCookie(redirect.headers.get("set-cookie"));
  const firstProbe = await requestResolvedHost({
    hostname: domainOpenUrl.hostname,
    port: backendPort,
    path: "/probe?hit=1",
    expectedStatus: 200,
    headers: { cookie },
  });
  const probeData = JSON.parse(firstProbe.text);
  if (
    !String(probeData?.cookie ?? "").includes("nextclaw_ui_bridge=smoke-bridge")
  ) {
    throw new Error(
      `Expected bridged local auth cookie, got ${firstProbe.text}`,
    );
  }
  if (String(probeData?.forwardedHost ?? "").split(":")[0] !== stableDomain) {
    throw new Error(
      `Wrangler did not exercise the stable remote host: ${firstProbe.text}`,
    );
  }
  const secondProbe = await requestResolvedHost({
    hostname: domainOpenUrl.hostname,
    port: backendPort,
    path: "/probe?hit=2",
    expectedStatus: 200,
    headers: { cookie },
  });
  if (!JSON.parse(secondProbe.text)?.ok) {
    throw new Error(`Second proxied request failed: ${secondProbe.text}`);
  }
  return { sessionBefore, sessionSql };
}

async function assertPanelSandboxAccess({
  persistDir,
  instance,
  domainOpenUrl,
  backendPort,
  sessionBefore,
  sessionSql,
  sessionCreatedAt,
}) {
  const [binding] = queryLocalD1({
    persistDir,
    sql: `SELECT d.id AS instance_id,
                 domains.prefix AS domain_prefix,
                 s.id AS session_id,
                 s.source_type,
                 s.status,
                 s.revoked_at,
                 s.expires_at,
                 datetime(s.expires_at) > datetime('now') AS is_active
            FROM remote_devices d
            JOIN remote_instance_domains domains
              ON domains.instance_id = d.id
            LEFT JOIN remote_sessions s
              ON s.device_id = d.id
             AND s.source_type = 'owner_open'
             AND s.status = 'active'
             AND s.revoked_at IS NULL
           WHERE d.id = '${instance.id.replaceAll("'", "''")}'
             AND domains.prefix = '${domainOpenUrl.hostname.split(".")[0].replaceAll("'", "''")}'
           ORDER BY s.updated_at DESC, s.id DESC
           LIMIT 1`,
  });
  if (
    binding?.domain_prefix !== domainOpenUrl.hostname.split(".")[0] ||
    binding?.is_active !== 1
  ) {
    throw new Error(
      `Stable-domain panel binding is not active in D1: ${JSON.stringify(binding)}`,
    );
  }
  const response = await requestResolvedHost({
    hostname: domainOpenUrl.hostname,
    port: backendPort,
    path: "/api/panel-app-client-sdk.js",
    expectedStatus: 200,
  });
  if (!response.text.includes("__remotePanelSmoke")) {
    throw new Error(
      `Stable-domain panel sandbox returned unexpected content: ${response.text}`,
    );
  }
  const [sessionAfter] = queryLocalD1({ persistDir, sql: sessionSql });
  if (
    !sessionAfter ||
    sessionAfter.last_used_at !== sessionBefore.last_used_at ||
    sessionAfter.updated_at !== sessionBefore.updated_at
  ) {
    throw new Error(
      `Expected throttled session touch, before=${JSON.stringify(sessionBefore)}, after=${JSON.stringify(sessionAfter)}, sessionCreatedAt=${sessionCreatedAt}`,
    );
  }
}

export async function assertOwnerRemoteAccess(params) {
  const ownerOpen = await createAndValidateOwnerOpen(params);
  const customProxyState = await assertStableOwnerProxy({
    ...params,
    ...ownerOpen,
    domainOpenUrl: ownerOpen.customOpenUrl,
  });
  await assertPanelSandboxAccess({
    ...params,
    ...ownerOpen,
    ...customProxyState,
    domainOpenUrl: ownerOpen.customOpenUrl,
  });
  return { ownerSessionHostname: ownerOpen.remoteOpenUrl.hostname };
}

async function createAndValidateShareOpen({
  base,
  token,
  instanceId,
  ownerSessionHostname,
}) {
  const created = await requestJson({
    method: "POST",
    url: `${base}/platform/remote/instances/${encodeURIComponent(instanceId)}/shares`,
    token,
    body: {},
    expectedStatus: 200,
  });
  const { shareUrl, id: grantId } = created.body?.data ?? {};
  if (!shareUrl || !grantId) {
    throw new Error(
      `Missing share grant payload: ${JSON.stringify(created.body)}`,
    );
  }
  const parsedShareUrl = new URL(shareUrl);
  if (
    parsedShareUrl.origin !== "https://platform.nextclaw.io" ||
    !parsedShareUrl.pathname.startsWith("/share/")
  ) {
    throw new Error(
      `Share URL must stay on platform.nextclaw.io/share/<token>, got ${shareUrl}`,
    );
  }
  const grantToken = parsedShareUrl.pathname.split("/").filter(Boolean).at(-1);
  if (!grantToken) {
    throw new Error(`Missing grant token in share URL: ${shareUrl}`);
  }
  const opened = await requestJson({
    method: "POST",
    url: `${base}/platform/share/${encodeURIComponent(grantToken)}/open`,
    expectedStatus: 200,
  });
  const {
    openUrl,
    fixedDomainOpenUrl,
    systemDomainOpenUrl,
    customDomainOpenUrl,
  } = opened.body?.data ?? {};
  if (systemDomainOpenUrl !== null || customDomainOpenUrl !== null) {
    throw new Error(
      `Share sessions must not expose the owner stable domain: ${JSON.stringify(opened.body)}`,
    );
  }
  if (!openUrl || !fixedDomainOpenUrl) {
    throw new Error(
      `Incomplete share open response: ${JSON.stringify(opened.body)}`,
    );
  }
  const parsedOpenUrl = assertRemoteOpenUrlShape(openUrl, "share openUrl");
  assertFixedDomainOpenUrlShape(fixedDomainOpenUrl, "share fixedDomainOpenUrl");
  if (parsedOpenUrl.hostname === ownerSessionHostname) {
    throw new Error(
      `Share openUrl must allocate a distinct access-session host, owner=${ownerSessionHostname}, share=${openUrl}`,
    );
  }
  return { grantId, grantToken, parsedOpenUrl };
}

async function assertSharedSessionProxy({ parsedOpenUrl, backendPort }) {
  const redirect = await requestResolvedHost({
    hostname: parsedOpenUrl.hostname,
    port: backendPort,
    path: `${parsedOpenUrl.pathname}${parsedOpenUrl.search}`,
    expectedStatus: 302,
  });
  const cookie = extractCookie(redirect.headers.get("set-cookie"));
  const probe = await requestResolvedHost({
    hostname: parsedOpenUrl.hostname,
    port: backendPort,
    path: "/probe?share=1",
    expectedStatus: 200,
    headers: { cookie },
  });
  if (
    !String(JSON.parse(probe.text)?.cookie ?? "").includes(
      "nextclaw_ui_bridge=smoke-bridge",
    )
  ) {
    throw new Error(
      `Expected bridged cookie for shared probe, got ${probe.text}`,
    );
  }
  return cookie;
}

async function revokeAndAssertShare({
  base,
  token,
  grantId,
  grantToken,
  parsedOpenUrl,
  backendPort,
  cookie,
}) {
  await requestJson({
    method: "POST",
    url: `${base}/platform/remote/shares/${encodeURIComponent(grantId)}/revoke`,
    token,
    body: {},
    expectedStatus: 200,
  });
  const revokedProbe = await requestResolvedHost({
    hostname: parsedOpenUrl.hostname,
    port: backendPort,
    path: "/probe?share=2",
    expectedStatus: 410,
    headers: { cookie },
  });
  if (!revokedProbe.text.includes("revoked")) {
    throw new Error(
      `Expected revoked shared session response, got ${revokedProbe.text}`,
    );
  }
  await requestJson({
    method: "POST",
    url: `${base}/platform/share/${encodeURIComponent(grantToken)}/open`,
    expectedStatus: 410,
  });
}

export async function assertRemoteShareLifecycle(params) {
  const share = await createAndValidateShareOpen(params);
  const cookie = await assertSharedSessionProxy({ ...params, ...share });
  await revokeAndAssertShare({ ...params, ...share, cookie });
}
