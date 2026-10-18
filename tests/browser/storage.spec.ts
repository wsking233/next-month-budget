import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
const key = 'next-month-budget:ledger';
async function nav(page: Page, name: string) { await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name, exact: true }).click(); }
async function addPool(page: Page, name: string) {
  await nav(page, '资金池');
  await page.getByRole('button', { name: '创建资金池', exact: true }).click();
  await page.getByLabel('资金池名称').fill(name);
  await page.getByRole('button', { name: '确认添加', exact: true }).click();
}
async function upload(page: Page, raw: string) {
  await page.getByLabel('选择 JSON 备份恢复', { exact: true }).setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
}
async function stored(page: Page) { return page.evaluate(storageKey => localStorage.getItem(storageKey), key); }
const heading = (page: Page, name: string) => page.getByRole('heading', { name, exact: true });

for (const width of [375, 768, 1440]) {
  test(`${width}px 本地保存、关闭重开、导出恢复与取消覆盖`, async ({ page, context }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./#/');
    await addPool(page, '备份中的资金池');
    await nav(page, '预算计划');
    await page.getByRole('button', { name: '创建预算周期', exact: true }).first().click();
    await page.getByLabel('周期名称').fill('备份周期');
    await page.getByLabel('开始日期').fill('2027-01-01');
    await page.getByLabel('结束日期').fill('2027-01-31');
    await page.getByRole('button', { name: '确认添加', exact: true }).click();
    await page.getByRole('button', { name: '预算拨款', exact: true }).click();
    await page.getByLabel('资金池', { exact: true }).selectOption({ label: '备份中的资金池' });
    await page.getByLabel('金额（元）', { exact: true }).fill('123.45');
    await page.getByRole('button', { name: '确认拨款' }).click();
    await nav(page, '设置');
    const waitDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出 JSON 备份', exact: true }).click();
    const download = await waitDownload;
    const path = await download.path();
    expect(path).toBeTruthy();
    const raw = await readFile(path!, 'utf8');
    const backup = JSON.parse(raw);
    expect(backup.schemaVersion).toBe(3);
    expect(backup.workspace.ledger.entries[0].amount).toBe(12345);
    await addPool(page, '恢复时应替换的资金池');
    const before = await stored(page);
    await nav(page, '设置');
    await upload(page, '{bad-json');
    await expect(page.getByRole('alert')).toContainText('JSON');
    expect(await stored(page)).toBe(before);
    const future = { ...backup, schemaVersion: 999 };
    await upload(page, JSON.stringify(future));
    await expect(page.getByRole('alert')).toContainText('版本不兼容');
    expect(await stored(page)).toBe(before);
    const broken = structuredClone(backup);
    broken.workspace.ledger.entries[0].poolId = 'missing';
    await upload(page, JSON.stringify(broken));
    await expect(page.getByRole('alert')).toContainText('引用失效');
    expect(await stored(page)).toBe(before);
    await upload(page, raw);
    const modal = page.getByRole('dialog', { name: '确认覆盖本地账本？' });
    await expect(modal).toContainText('1 条流水');
    await page.getByRole('button', { name: '取消恢复' }).click();
    expect(await stored(page)).toBe(before);
    await upload(page, raw);
    expect(await modal.evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`restore-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: '确认覆盖并恢复' }).click();
    await expect(page.getByText('备份已恢复并保存到此浏览器。')).toBeVisible();
    expect(JSON.parse((await stored(page))!).workspace).toEqual(backup.workspace);
    await page.reload();
    await nav(page, '资金池');
    await expect(heading(page, '备份中的资金池')).toBeVisible();
    await expect(heading(page, '恢复时应替换的资金池')).toHaveCount(0);
    await expect(page.getByText('¥123.45', { exact: true }).first()).toBeVisible();
    const next = await context.newPage();
    await page.close();
    await next.goto('./#/pools');
    await expect(heading(next, '备份中的资金池')).toBeVisible();
    await expect(next.getByLabel('查看预算周期')).toContainText('备份周期');
  });
}

test('配额失败保留表单和旧数据，恢复与清空失败不覆盖', async ({ page }) => {
  await page.goto('./#/');
  await addPool(page, '原账本');
  const before = await stored(page);
  await nav(page, '设置');
  // Valid replacement with an empty ledger, generated from the saved schema.
  const replacement = JSON.parse(before!);
  replacement.workspace = { ledger: { periods: [], pools: [], statements: [], entries: [], audit: [] }, currentPeriod: '' };
  await page.evaluate(storageKey => {
    const original = Storage.prototype.setItem;
    (window as Window & { restoreWrite?: () => void }).restoreWrite = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (name, value) {
      if (name === storageKey) throw new DOMException('quota', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, key);
  await nav(page, '资金池');
  await page.getByRole('button', { name: '创建资金池', exact: true }).click();
  await page.getByLabel('资金池名称').fill('未保存的输入');
  await page.getByRole('button', { name: '确认添加', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('未保存');
  await expect(page.getByLabel('资金池名称')).toHaveValue('未保存的输入');
  expect(await stored(page)).toBe(before);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '清空当前账本' }).click();
  await page.getByRole('button', { name: '确认清除并继续' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('未保存');
  expect(await stored(page)).toBe(before);
  await page.keyboard.press('Escape');
  await nav(page, '设置');
  await upload(page, JSON.stringify(replacement));
  await page.getByRole('button', { name: '确认覆盖并恢复' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('未保存');
  expect(await stored(page)).toBe(before);
  await page.evaluate(() => (window as Window & { restoreWrite?: () => void }).restoreWrite?.());
  await page.getByRole('button', { name: '确认覆盖并恢复' }).click();
  await expect(page.getByText('备份已恢复并保存到此浏览器。')).toBeVisible();
  await page.reload();
  await nav(page, '资金池');
  await expect(page.getByText('给生活留一个预算空间')).toBeVisible();
});

for (const damaged of ['{bad', JSON.stringify({ schemaVersion: 999 })]) {
  test(`本地${damaged.startsWith('{bad') ? '损坏' : '未知版本'}数据不被空账本覆盖`, async ({ page }) => {
    await page.goto('./#/');
    await page.evaluate(([storageKey, raw]) => localStorage.setItem(storageKey, raw), [key, damaged]);
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('已暂停写入');
    await nav(page, '资金池');
    await page.getByRole('button', { name: '创建资金池', exact: true }).click();
    await page.getByLabel('资金池名称').fill('禁止覆盖');
    await page.getByRole('button', { name: '确认添加', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('尚未安全读取');
    expect(await stored(page)).toBe(damaged);
    await page.keyboard.press('Escape');
    await nav(page, '设置');
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载原始存储' }).click();
    const path = await (await pending).path();
    expect(await readFile(path!, 'utf8')).toBe(damaged);
    await page.getByRole('button', { name: '清空当前账本' }).click();
    await page.getByRole('button', { name: '确认清除并继续' }).click();
    await page.reload();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(JSON.parse((await stored(page))!).workspace.ledger.pools).toEqual([]);
  });
}

test('两个标签页并行编辑时阻止旧页面覆盖新账本', async ({ page, context }) => {
  await page.goto('./#/');
  await addPool(page, '原有池');
  const second = await context.newPage();
  await second.goto('./#/pools');
  await second.getByRole('button', { name: '创建资金池', exact: true }).click();
  await second.getByLabel('资金池名称').fill('旧页提交');
  await addPool(page, '另一页新建');
  await second.getByRole('button', { name: '确认添加', exact: true }).click();
  await expect(second.getByRole('dialog').getByRole('alert')).toContainText('尚未安全读取');
  await second.keyboard.press('Escape');
  await second.getByRole('button', { name: '重新读取本地账本', exact: true }).click();
  await expect(heading(second, '另一页新建')).toBeVisible();
  await expect(heading(second, '旧页提交')).toHaveCount(0);
});
