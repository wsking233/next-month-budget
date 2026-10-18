import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createDemoLedger } from '../../src/fixtures/demo-ledger';
import { serializeSnapshot } from '../../src/storage/snapshot';
const key = 'next-month-budget:ledger';
async function start(page: Page) {
  await page.goto('./#/');
  const snapshot = JSON.parse(serializeSnapshot({ ledger: createDemoLedger(), currentPeriod: 'oct' }));
  snapshot.schemaVersion = 1;
  const raw = JSON.stringify(snapshot);
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key, raw });
  await page.goto('./#/plans'); await page.reload();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
  return raw;
}
async function fillIncome(page: Page, amount: string) {
  await page.getByLabel('收入标识', { exact: true }).fill('工资');
  await page.getByLabel('实际收到日期').fill('2026-10-10');
  await page.getByLabel('实际收入（元）').fill(amount);
}

test('旧账本迁移、模板预览无拨款、确认防重及撤销恢复', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  const legacy = await start(page);
  await page.getByRole('button', { name: '编辑固定金额模板' }).click();
  await page.getByLabel('日常生活拨款（元）').fill('500');
  await page.getByLabel('计划储蓄（元）').fill('300');
  await page.getByRole('button', { name: '保存模板', exact: true }).click();
  const saved = await page.evaluate(key => localStorage.getItem(key), key);
  const snapshot = JSON.parse(saved!);
  expect(snapshot.schemaVersion).toBe(3);
  expect(snapshot.workspace.ledger.entries).toEqual(JSON.parse(legacy).workspace.ledger.entries);
  await page.getByRole('button', { name: '登记收入并分配' }).click();
  await fillIncome(page, '700');
  await page.getByRole('button', { name: '预览收入分配' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('收入不足');
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(saved);
  await page.getByLabel('实际收入（元）').fill('1000');
  await page.getByRole('button', { name: '预览收入分配' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('未分配 ¥200.00');
  expect((await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(saved);
  await page.getByRole('button', { name: '确认收入及拨款' }).click();
  await expect(page.getByRole('heading', { name: '工资 · 已应用', exact: true })).toBeVisible();
  const applied = await page.evaluate(key => localStorage.getItem(key), key);
  await page.getByRole('button', { name: '登记收入并分配' }).click();
  await fillIncome(page, '1000');
  await page.getByRole('button', { name: '预览收入分配' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('重复');
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(applied);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '撤销此收入及拨款' }).click();
  await page.getByLabel('收入撤销原因').fill('金额录错');
  await page.getByRole('button', { name: '确认撤销收入' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '工资 · 已撤销', exact: true })).toBeVisible();
  const final = JSON.parse((await page.evaluate(key => localStorage.getItem(key), key))!);
  expect(final.workspace.ledger.entries.filter((e: { kind: string }) => e.kind === 'income_reversal')).toHaveLength(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('收入保存失败无部分拨款，输入及预览保留，重试只记一次', async ({ page }) => {
  const original = await start(page);
  await page.getByRole('button', { name: '登记收入并分配' }).click();
  await fillIncome(page, '1000');
  await page.getByLabel('日常生活拨款（元）').fill('500');
  await page.getByRole('button', { name: '预览收入分配' }).click();
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    (window as Window & { restoreIncomeWrite?: () => void }).restoreIncomeWrite = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new Error('quota'); original.call(this, name, value); };
  }, key);
  await page.getByRole('button', { name: '确认收入及拨款' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('未保存');
  await expect(page.getByLabel('收入标识', { exact: true })).toHaveValue('工资');
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(original);
  await page.evaluate(() => (window as Window & { restoreIncomeWrite?: () => void }).restoreIncomeWrite?.());
  await page.getByRole('button', { name: '确认收入及拨款' }).click();
  const next = JSON.parse((await page.evaluate(key => localStorage.getItem(key), key))!);
  expect(next.workspace.ledger.planning.incomes).toHaveLength(1);
  expect(next.workspace.ledger.entries).toHaveLength(3);
});
