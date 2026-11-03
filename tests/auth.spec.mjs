import { test, expect } from '@playwright/test';

test.use({ extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? {
  'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET
} : {} });

test('admin login, protected routes, persistent session and logout', async ({ page, request }) => {
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:5173';
  const unauthorized = await request.get(`${baseUrl}/api/v1/ollama/models`);
  expect(unauthorized.status()).toBe(401);
  const forged = await request.get(`${baseUrl}/api/v1/ollama/models`, {
    headers: { 'x-user-role': 'ADMIN', authorization: 'Bearer dev-token-forged' }
  });
  expect(forged.status()).toBe(401);
  const invalidCookie = await request.get(`${baseUrl}/api/v1/ollama/models`, {
    headers: { cookie: 'support_session=invalid' }
  });
  expect(invalidCookie.status()).toBe(401);
  await page.goto(`${baseUrl}/agents`);
  await expect(page.locator('#login-submit')).toBeVisible();
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('incorrect');
  await page.locator('#login-submit').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.locator('#password').fill('admin');
  await page.locator('#login-submit').click();
  await expect(page.locator('#logout')).toBeVisible();
  await page.reload();
  await expect(page.locator('#logout')).toBeVisible();
  const session = await page.request.get(`${baseUrl}/api/v1/auth/session`);
  expect(await session.json()).toEqual({ username: 'admin' });
  const customers = await page.request.get(`${baseUrl}/api/v1/customers?limit=1`);
  expect(customers.status()).toBe(200);
  await page.locator('#logout').click();
  await expect(page.locator('#login-submit')).toBeVisible();
  const signedOut = await page.request.get(`${baseUrl}/api/v1/ollama/models`);
  expect(signedOut.status()).toBe(401);
});

test('support data, system health and real model inference', async ({ request }) => {
  test.setTimeout(90000);
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:5173';
  const login = await request.post(`${baseUrl}/api/v1/auth/login`, { data: { username: 'admin', password: 'admin' } });
  expect(login.status()).toBe(200);
  const endpoints = ['/customers?limit=1', '/orders?limit=1', '/tickets?limit=1', '/refunds?limit=1', '/knowledge-base', '/agents', '/agents/executions', '/ollama/models'];
  await Promise.all(endpoints.map(async (endpoint) => {
    const response = await request.get(`${baseUrl}/api/v1${endpoint}`);
    expect(response.status(), endpoint).toBe(200);
  }));
  const health = await request.get(`${baseUrl}/api/v1/health/detailed`);
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ database: 'connected', ollama: 'connected' });
  const inference = await request.post(`${baseUrl}/api/v1/ollama/test`, {
    data: { prompt: 'Say hello in three words.' }, timeout: 60000
  });
  expect(inference.status(), await inference.text()).toBe(200);
  expect(await inference.json()).toMatchObject({ success: true });
});


test('four agent cards expose tracking and persistent pause, stop and activation controls', async ({ page }) => {
  test.setTimeout(60000);
  const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:5173';
  await page.goto(baseUrl);
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('admin');
  await page.locator('#login-submit').click();
  await expect(page.getByTestId(/^agent-.*-00[1-4]$/)).toHaveCount(4);
  const id = 'support-agent-001';
  const card = page.getByTestId(`agent-${id}`);
  try {
    await page.getByTestId(`pause-${id}`).click();
    await expect(card).toContainText('PAUSED');
    await page.reload();
    await expect(card).toContainText('PAUSED');
    await page.getByTestId(`stop-${id}`).click();
    await expect(card).toContainText('STOPPED');
    await page.getByTestId(`activate-${id}`).click();
    await expect(card).toContainText('ACTIVE');
    await page.getByTestId(`track-${id}`).click();
    await expect(page.locator('#agent-message')).toBeVisible();
    await expect(page.getByTestId('detail-stop')).toBeVisible();
    await page.getByRole('button', { name: 'Close agent details', exact: true }).click();
    await expect(page.locator('#agent-message')).toHaveCount(0);
  } finally {
    const response = await page.request.post(`${baseUrl}/api/v1/agents/${id}/activate`, { data: {} });
    expect(response.status()).toBe(200);
  }
});
