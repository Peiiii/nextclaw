import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ConfigSchema, saveConfig } from '@nextclaw/core'
import { EventBus } from '@nextclaw/shared'
import { afterEach, describe, expect, it } from 'vitest'

import { createUiRouter } from '@nextclaw-server/app/router.js'
import { createRouterTestKernel } from '@nextclaw-server/app/tests/router-test-kernel.js'

describe('product analytics status route', () => {
  const tempDirectories: string[] = []

  afterEach(() => {
    for (const directory of tempDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('returns the local anonymous analytics delivery status', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'nextclaw-product-analytics-status-'))
    tempDirectories.push(homeDir)
    const configPath = join(homeDir, 'config.json')
    saveConfig(ConfigSchema.parse({}), configPath)

    const router = createUiRouter({
      configPath,
      appEventBus: new EventBus(),
      kernel: createRouterTestKernel(),
      productActivity: {
        getStatus: () => ({
          lastAttemptAt: '2026-08-25T01:00:00.000Z',
          lastSuccessAt: '2026-08-25T01:00:01.000Z',
          lastError: null,
          pendingReceiptCount: 2,
        }),
      },
    })

    const response = await router.request('http://localhost/api/config/product-analytics/status')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        lastAttemptAt: '2026-08-25T01:00:00.000Z',
        lastSuccessAt: '2026-08-25T01:00:01.000Z',
        lastError: null,
        pendingReceiptCount: 2,
      },
    })
  })

  it('returns an empty status when the host has no reporter', async () => {
    const homeDir = mkdtempSync(join(tmpdir(), 'nextclaw-product-analytics-status-'))
    tempDirectories.push(homeDir)
    const configPath = join(homeDir, 'config.json')
    saveConfig(ConfigSchema.parse({}), configPath)

    const router = createUiRouter({
      configPath,
      appEventBus: new EventBus(),
      kernel: createRouterTestKernel(),
    })

    const response = await router.request('http://localhost/api/config/product-analytics/status')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastError: null,
        pendingReceiptCount: 0,
      },
    })
  })
})
