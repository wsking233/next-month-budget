import { expect, test } from '@playwright/test';
const key = 'next-month-budget:ledger';

test('标签页独占编辑：等待页不能提交/清空/恢复，关闭编辑页后自动接力', async ({ page, context }) => {
  await page.goto('./#/pools');
  await page.getByRole('button', { name: '创建资金池', exact: true }).click();
  await page.getByLabel('资金池名称', { exact: true }).fill('第一标签页');
  await page.getByRole('button', { name: '确认添加', exact: true }).click();
  await expect(page.getByRole('heading', { name: '第一标签页', exact: true })).toBeVisible();
  const original = await page.evaluate(k => localStorage.getItem(k), key);
  const second = await context.newPage(); await second.goto('./#/pools');
  await expect(second.getByText(/正在等待本地账本编辑权限/)).toBeVisible();
  await second.getByRole('button', { name: '创建资金池', exact: true }).click();
  await second.getByLabel('资金池名称', { exact: true }).fill('等待时不能保存');
  await second.getByRole('button', { name: '确认添加', exact: true }).click();
  await expect(second.getByRole('dialog').getByRole('alert')).toContainText('其他标签页');
  expect(await second.evaluate(k => localStorage.getItem(k), key)).toBe(original);
  await second.keyboard.press('Escape');
  await second.getByRole('button', { name: '清空当前账本', exact: true }).click();
  await second.getByRole('button', { name: '确认清除并继续', exact: true }).click();
  await expect(second.getByRole('dialog').getByRole('alert')).toContainText('其他标签页');
  await second.keyboard.press('Escape');
  await second.getByRole('navigation').getByRole('link', { name: '设置', exact: true }).click();
  await second.getByLabel('选择 JSON 备份恢复', { exact: true }).setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(original!) });
  await second.getByRole('button', { name: '确认覆盖并恢复', exact: true }).click();
  await expect(second.getByRole('dialog').getByRole('alert')).toContainText('其他标签页');
  await second.keyboard.press('Escape');
  await page.getByRole('button', { name: '创建资金池', exact: true }).click();
  await page.getByLabel('资金池名称', { exact: true }).fill('最新账务');
  await page.getByRole('button', { name: '确认添加', exact: true }).click();
  await expect(page.getByRole('heading', { name: '最新账务', exact: true })).toBeVisible();
  // Enter preview while still viewing the old ledger. Handover must invalidate it.
  await second.getByLabel('选择 JSON 备份恢复', { exact: true }).setInputFiles({ name: 'old.json', mimeType: 'application/json', buffer: Buffer.from(original!) });
  await page.close();
  await expect(second.getByText(/正在等待本地账本编辑权限/)).toHaveCount(0);
  await second.getByRole('button', { name: '确认覆盖并恢复', exact: true }).click();
  await expect(second.getByRole('dialog').getByRole('alert')).toContainText('预览后账本已变化');
  await second.keyboard.press('Escape');
  await second.getByRole('navigation').getByRole('link', { name: '资金池', exact: true }).click();
  await expect(second.getByRole('heading', { name: '最新账务', exact: true })).toBeVisible();
  await second.getByRole('button', { name: '创建资金池', exact: true }).click();
  await second.getByLabel('资金池名称', { exact: true }).fill('接力编辑');
  await second.getByRole('button', { name: '确认添加', exact: true }).click();
  await expect(second.getByRole('heading', { name: '接力编辑', exact: true })).toBeVisible();
  await second.reload();
  await expect(second.getByRole('heading', { name: '接力编辑', exact: true })).toBeVisible();
});

test('没有 Web Locks 时维持版本冲突保护并说明单页使用', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  await page.goto('./#/pools');
  await expect(page.getByText(/当前浏览器不支持独占编辑保护/)).toBeVisible();
  await page.getByRole('button', { name: '创建资金池', exact: true }).click();
  await page.getByLabel('资金池名称', { exact: true }).fill('兼容浏览器');
  await page.getByRole('button', { name: '确认添加', exact: true }).click();
  await expect(page.getByRole('heading', { name: '兼容浏览器', exact: true })).toBeVisible();
});

test('编辑锁请求失败时不降级为可写，仍可使用独立演示', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: { request: () => Promise.reject(new Error('denied')) } }));
  await page.goto('./#/pools');
  await expect(page.getByText(/浏览器编辑锁不可用/)).toBeVisible();
  await page.getByRole('button', { name: '创建资金池', exact: true }).click();
  await page.getByLabel('资金池名称', { exact: true }).fill('不应写入');
  await page.getByRole('button', { name: '确认添加', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('编辑锁');
  expect(await page.evaluate(k => localStorage.getItem(k), key)).toBeNull();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '查看独立演示', exact: true }).click();
  await expect(page.getByText('独立演示账本 · 刷新即清空', { exact: true })).toBeVisible();
});
