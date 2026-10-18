import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createDemoLedger } from '../../src/fixtures/demo-ledger';
import { recordStatement, settleStatement } from '../../src/domain/budget';
import { linkStatementAccount, recordRepayment, saveCreditAccount } from '../../src/domain/credit';
import { applyIncome, cancelIncome, saveBudgetTemplate } from '../../src/domain/income';
import { serializeSnapshot } from '../../src/storage/snapshot';
const ledgerKey = 'next-month-budget:ledger';
const backupKey = 'next-month-budget:backup-status';
const nav = async (page: Page, title: string) => page.getByRole('navigation').getByRole('link', { name: title, exact: true }).click();
const stored = (page: Page) => page.evaluate(key => localStorage.getItem(key), ledgerKey);
function fixture() {
  let ledger = createDemoLedger();
  for (const [id, name] of [['all', '稳定卡 A'], ['second', '稳定卡 B']]) ledger = saveCreditAccount(ledger, { id, name, active: true });
  ledger = linkStatementAccount(ledger, 'a', 'all', '核对历史名称');
  ledger = linkStatementAccount(ledger, 'b', 'second', '核对历史名称');
  ledger = recordRepayment(ledger, { id: 'paid-a', statementId: 'a', reference: '全额', paidOn: '2026-10-25', amount: 260000 });
  ledger = settleStatement(ledger, 'b', [{ id: 'allocation', poolId: 'daily', periodId: 'oct', amount: 310000 }]);
  ledger = recordRepayment(ledger, { id: 'partial-b', statementId: 'b', reference: '首笔', paidOn: '2026-11-01', amount: 100000 });
  ledger = recordStatement(ledger, { id: 'c', accountId: '旧账户文字', fingerprint: 'OLD', amount: 10000, dueOn: '2026-10-20' });
  ledger = applyIncome(ledger, { id: 'salary', periodId: 'oct', reference: '工资', receivedOn: '2026-10-10', amount: 100000, plannedSavings: 50000, allocations: [{ poolId: 'daily', amount: 50000 }] });
  ledger = applyIncome(ledger, { id: 'bonus', periodId: 'nov', reference: '奖金', receivedOn: '2026-11-10', amount: 80000, plannedSavings: 30000, allocations: [{ poolId: 'digital', amount: 50000 }] });
  ledger = applyIncome(ledger, { id: 'cancelled', periodId: 'oct', reference: '旧收入', receivedOn: '2026-10-10', amount: 10000, plannedSavings: 10000, allocations: [] });
  ledger = cancelIncome(ledger, 'cancelled', '错录');
  return saveBudgetTemplate(ledger, { plannedSavings: 10000, allocations: [{ poolId: 'daily', amount: 20000 }] });
}
async function start(page: Page, route = 'statements') {
  await page.goto('./#/');
  const raw = serializeSnapshot({ ledger: fixture(), currentPeriod: 'oct' });
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: ledgerKey, raw });
  await page.goto(`./#/${route}`); await page.reload();
  return raw;
}

test('还款、预算、稳定账户及排序组合筛选无账务写入', async ({ page }) => {
  const before = await start(page);
  const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: '信用卡账单', exact: true }) });
  await page.getByLabel('账单状态', { exact: true }).selectOption('recorded');
  await page.getByLabel('实际还款状态', { exact: true }).selectOption('paid');
  await expect(panel.getByRole('heading', { name: '稳定卡 A', exact: true })).toBeVisible();
  await expect(panel.getByRole('article')).toHaveCount(1);
  await page.getByLabel('实际还款状态', { exact: true }).selectOption('partial');
  await expect(panel.getByRole('article')).toHaveCount(0);
  await page.getByLabel('账单状态', { exact: true }).selectOption('全部');
  await expect(panel.getByRole('heading', { name: '稳定卡 B', exact: true })).toBeVisible();
  await page.getByLabel('信用卡账户筛选').selectOption('account:all');
  await expect(panel.getByRole('article')).toHaveCount(0);
  await page.getByLabel('实际还款状态', { exact: true }).selectOption('all');
  await expect(panel.getByRole('heading', { name: '稳定卡 A', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '清空筛选', exact: true }).click();
  await page.getByLabel('账单排序').selectOption('due-asc');
  await expect(panel.getByRole('article').getByRole('heading')).toHaveText(['旧账户文字', '稳定卡 A', '稳定卡 B']);
  await page.getByLabel('信用卡账户筛选').selectOption('unlinked');
  await expect(panel.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: '清空筛选', exact: true }).click();
  await expect(page.getByLabel('账单排序')).toHaveValue('recorded');
  expect(await stored(page)).toBe(before);
});

test('收入历史组合检索、模板合计及复制来源不改变账务', async ({ page }) => {
  const before = await start(page, 'plans');
  await page.getByLabel('收入归属周期筛选').selectOption('');
  await page.getByLabel('收入状态筛选').selectOption('applied');
  await page.getByLabel('搜索收入标识').fill('奖');
  await expect(page.getByRole('heading', { name: '奖金 · 已应用', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '工资 · 已应用', exact: true })).toHaveCount(0);
  await page.getByLabel('收入归属周期筛选').selectOption('oct');
  await expect(page.getByText('暂无匹配的收入', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重置收入筛选' }).click();
  await expect(page.getByRole('heading', { name: '旧收入 · 已撤销', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑固定金额模板' }).click();
  await expect(page.getByRole('dialog')).toContainText('合计需收入 ¥300.00');
  await page.getByRole('button', { name: '复制所选周期净拨款' }).click();
  await expect(page.getByRole('dialog')).toContainText('已复制来源周期「十月预算」');
  await expect(page.getByRole('dialog')).toContainText('合计需收入 ¥6,100.00');
  expect((await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  expect(await stored(page)).toBe(before);
});

test('填充未还金额无写入，实际提交才追加还款，预算流水不变', async ({ page }) => {
  const before = await start(page);
  const bill = page.getByRole('article').filter({ has: page.getByRole('heading', { name: '稳定卡 B', exact: true }) });
  await bill.getByRole('button', { name: '登记实际还款', exact: true }).click();
  await page.getByRole('button', { name: '填入当前未还金额' }).click();
  await expect(page.getByLabel('实际还款金额（元）')).toHaveValue('2100.00');
  await expect(page.getByLabel('实际还款日期')).toHaveValue('');
  expect(await stored(page)).toBe(before);
  await page.getByLabel('实际还款日期').fill('2026-11-08');
  await page.getByLabel('还款标识', { exact: true }).fill('余款');
  await page.getByRole('button', { name: '确认记录还款' }).click();
  await expect(bill).toContainText('已还清');
  const saved = JSON.parse((await stored(page))!);
  expect(saved.workspace.ledger.entries).toEqual(JSON.parse(before).workspace.ledger.entries);
  expect(saved.workspace.ledger.credit.repayments).toHaveLength(3);
});

test('备份摘要仅比较账务，切周期及演示不污染，变更可提醒并关闭', async ({ page }) => {
  await start(page, 'settings');
  await expect(page.getByText('尚无生成备份文件的记录。', { exact: true })).toBeVisible();
  const before = await stored(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON 备份', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
  await expect(page.getByText('当前账务内容与上次生成的备份一致，请确认文件已保管。', { exact: true })).toBeVisible();
  expect(await stored(page)).toBe(before);
  const metadata = await page.evaluate(key => localStorage.getItem(key), backupKey);
  expect(JSON.parse(metadata!).digest).toMatch(/^[a-f0-9]{64}$/);
  await page.getByLabel('查看预算周期').selectOption('nov');
  await expect(page.getByText('当前账务内容与上次生成的备份一致，请确认文件已保管。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '查看独立演示' }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), backupKey)).toBe(metadata);
  await page.getByRole('button', { name: '返回本地账本' }).click();
  await nav(page, '资金池');
  await page.getByRole('button', { name: '创建资金池', exact: true }).click();
  await page.getByLabel('资金池名称').fill('备份后新增');
  await page.getByRole('button', { name: '确认添加', exact: true }).click();
  await nav(page, '设置');
  await expect(page.getByText('上次生成备份后有账务变更，建议再次导出。', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭页面内备份提示' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '开启页面内备份提示' })).toBeVisible();
  await expect(page.getByText('上次生成备份后有账务变更，建议再次导出。', { exact: true })).toHaveCount(0);
});

test('备份偏好写入失败不阻止导出或账本保存', async ({ page }) => {
  await page.addInitScript(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new Error('preference quota'); original.call(this, name, value); };
  }, backupKey);
  const before = await start(page, 'settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON 备份', exact: true }).click();
  await download;
  await expect(page.getByText('备份文件已生成，请确认浏览器已下载，并妥善保管。', { exact: true })).toBeVisible();
  await expect(page.getByText('备份提示状态仅在本页保留，未能保存偏好；账本与文件生成不受影响。', { exact: true })).toBeVisible();
  expect(await stored(page)).toBe(before);
  await nav(page, '资金池');
  await page.getByRole('button', { name: '创建资金池', exact: true }).click();
  await page.getByLabel('资金池名称').fill('偏好不影响账本');
  await page.getByRole('button', { name: '确认添加', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '偏好不影响账本', exact: true })).toBeVisible();
});

test('摘要能力不可用时仍可导出，旧备份预览显示源版本与覆盖范围且取消无写入', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window.crypto, 'subtle', { get: () => undefined }); });
  const before = await start(page, 'settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON 备份', exact: true }).click();
  await download;
  await expect(page.getByText('无法比较备份后的变更，请按需再次导出。', { exact: true })).toBeVisible();
  const snapshot = JSON.parse(serializeSnapshot({ ledger: createDemoLedger(), currentPeriod: 'oct' }, true));
  snapshot.schemaVersion = 2;
  await page.getByLabel('选择 JSON 备份恢复', { exact: true }).setInputFiles({ name: 'v2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(snapshot)) });
  const dialog = page.getByRole('dialog', { name: '确认覆盖本地账本？' });
  await expect(dialog).toContainText('源文件格式版本 2 → 当前格式版本 3');
  await expect(dialog).toContainText('0 笔收入、0 笔还款');
  await page.getByRole('button', { name: '取消恢复' }).click();
  expect(await stored(page)).toBe(before);
});
