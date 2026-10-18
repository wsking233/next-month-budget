import { expect, test, type Page } from '@playwright/test';

async function navigate(page: Page, name: string) {
  await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name, exact: true }).click();
}
async function addPeriod(page: Page, name: string, start: string, end: string) {
  await navigate(page, '预算计划');
  await page.getByRole('button', { name: '创建预算周期', exact: true }).first().click();
  await page.getByLabel('周期名称').fill(name);
  await page.getByLabel('开始日期').fill(start);
  await page.getByLabel('结束日期').fill(end);
  await page.getByRole('button', { name: '确认添加', exact: true }).click();
}
async function addPool(page: Page, name: string) {
  await navigate(page, '资金池');
  await page.getByRole('button', { name: '创建资金池', exact: true }).click();
  await page.getByLabel('资金池名称').fill(name);
  await page.getByRole('button', { name: '确认添加', exact: true }).click();
}
async function fund(page: Page, pool: string, value: string) {
  await page.getByRole('button', { name: '预算拨款', exact: true }).click();
  await page.getByLabel('资金池', { exact: true }).selectOption({ label: pool });
  await page.getByLabel('金额（元）', { exact: true }).fill(value);
  await page.getByRole('button', { name: '确认拨款' }).click();
}
const poolCard = (page: Page, name: string) => page.getByRole('article').filter({ has: page.getByRole('heading', { name, exact: true }) });

for (const width of [375, 768, 1440]) {
  test(`${width}px 领域结算、跨期更正、撤销、独立演示与本地恢复`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('./#/');
    await expect(page.getByText('本地账本 · 自动保存在此浏览器')).toBeVisible();
    await addPool(page, '我的测试池');
    await page.getByRole('button', { name: '查看独立演示' }).click();
    for (const title of ['资金池', '账单', '预算计划', '历史记录', '设置', '概览']) {
      await navigate(page, title);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.screenshot({ path: testInfo.outputPath(`ledger-${width}-${title}.png`), fullPage: true });
    }
    await navigate(page, '账单');
    await page.getByRole('button', { name: '拆分核对' }).first().click();
    const dialog = page.getByRole('dialog');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: '拆分核对' }).first()).toBeFocused();
    await page.getByRole('button', { name: '拆分核对' }).first().click();
    await page.getByLabel('分配金额 1（元）').fill('2000.001');
    await expect(page.getByRole('button', { name: '核对分配', exact: true })).toBeDisabled();
    await page.getByLabel('分配金额 1（元）').fill('2000.01');
    await page.getByRole('button', { name: '添加分配行' }).click();
    await page.getByLabel('资金池 2', { exact: true }).selectOption('travel');
    await page.getByLabel('归属周期 2', { exact: true }).selectOption('nov');
    await page.getByLabel('分配金额 2（元）').fill('599.98');
    await expect(page.getByRole('button', { name: '核对分配', exact: true })).toBeDisabled();
    await page.getByLabel('分配金额 2（元）').fill('599.99');
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
    await page.getByRole('button', { name: '核对分配', exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText('还款状态不变');
    await page.getByRole('button', { name: '确认结算', exact: true }).click();
    const bill = poolCard(page, '演示信用卡 A');
    await expect(bill.getByText('已结算', { exact: true })).toBeVisible();
    await expect(bill.getByRole('button', { name: '拆分核对' })).toHaveCount(0);
    await navigate(page, '资金池');
    await expect(poolCard(page, '远行与探索').locator('p.money')).toHaveText('¥0.00');
    await page.getByLabel('查看预算周期').selectOption('nov');
    await expect(poolCard(page, '远行与探索').locator('p.money')).toHaveText('-¥599.99');
    await page.getByLabel('查看预算周期').selectOption('oct');
    await navigate(page, '账单');
    await bill.getByRole('button', { name: '更正分配' }).click();
    await page.getByLabel('资金池 1', { exact: true }).selectOption('digital');
    await page.getByLabel('更正原因').fill('调整分类');
    await page.getByRole('button', { name: '核对分配', exact: true }).click();
    await page.getByRole('button', { name: '确认更正', exact: true }).click();
    await navigate(page, '资金池');
    await expect(poolCard(page, '日常生活').locator('p.money')).toHaveText('¥3,500.00');
    await expect(poolCard(page, '数码兴趣').locator('p.money')).toHaveText('-¥0.01');
    await navigate(page, '账单');
    await bill.getByRole('button', { name: '撤销结算', exact: true }).click();
    await page.getByLabel('撤销原因').fill('取消本次分配');
    await page.getByRole('button', { name: '确认撤销结算' }).click();
    await expect(bill.getByText('已撤销', { exact: true })).toBeVisible();
    await navigate(page, '资金池');
    await page.getByLabel('查看预算周期').selectOption('nov');
    await expect(poolCard(page, '数码兴趣').locator('p.money')).toHaveText('¥2,000.00');
    await expect(poolCard(page, '远行与探索').locator('p.money')).toHaveText('¥0.00');
    await navigate(page, '历史记录');
    await page.getByLabel('操作类型').selectOption('settlement_corrected');
    await expect(page.getByText(/原分配：.*日常生活.*新分配：.*数码兴趣/).filter({ visible: true })).toBeVisible();
    await page.getByLabel('搜索记录').fill('不存在');
    await expect(page.getByText('暂时没有匹配的记录')).toBeVisible();
    await page.getByRole('button', { name: '返回本地账本' }).click();
    await navigate(page, '资金池');
    await expect(poolCard(page, '我的测试池')).toBeVisible();
    await expect(poolCard(page, '日常生活')).toHaveCount(0);
    await page.reload();
    await expect(poolCard(page, '我的测试池')).toBeVisible();
    await expect(poolCard(page, '日常生活')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('从空账本完整闭环：独立拨款、未来隔离、负数结转、资料修订、调拨与停用', async ({ page }) => {
  await page.goto('./#/');
  await addPeriod(page, '一月', '2027-01-10', '2027-02-09');
  await addPeriod(page, '二月', '2027-02-10', '2027-03-09');
  await addPool(page, '日常测试');
  await addPool(page, '数码测试');
  await expect(poolCard(page, '日常测试').locator('p.money')).toHaveText('¥0.00');
  await fund(page, '日常测试', '20.00'); // February funding.
  await page.getByLabel('查看预算周期').selectOption({ label: '一月 · 2027-01-10 — 2027-02-09' });
  await expect(poolCard(page, '日常测试').locator('p.money')).toHaveText('¥0.00');
  await page.getByRole('button', { name: '预算拨款', exact: true }).click();
  await page.getByLabel('资金池', { exact: true }).selectOption({ label: '日常测试' });
  await page.getByLabel('金额（元）', { exact: true }).fill('100.001');
  await page.getByRole('button', { name: '确认拨款' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('金额（元）', { exact: true })).toHaveValue('100.001');
  await page.getByLabel('金额（元）', { exact: true }).fill('100.01');
  await page.getByRole('button', { name: '确认拨款' }).click();
  await expect(poolCard(page, '日常测试').locator('p.money')).toHaveText('¥100.01');
  await navigate(page, '账单');
  await page.getByRole('button', { name: '登记账单', exact: true }).click();
  await page.getByLabel('账户名称', { exact: true }).fill('测试卡');
  await page.getByLabel('账单标识').fill('TEST-001');
  await page.getByLabel('账单日', { exact: true }).fill('2027-01-17');
  await page.getByLabel('还款日', { exact: true }).fill('2027-01-25');
  await page.getByLabel('金额（元）', { exact: true }).fill('120.01');
  await page.getByRole('button', { name: '确认添加', exact: true }).click();
  await page.getByRole('button', { name: '拆分核对' }).click();
  await page.getByLabel('分配金额 1（元）').fill('120.01');
  await page.getByRole('button', { name: '核对分配', exact: true }).click();
  await page.getByRole('button', { name: '确认结算', exact: true }).click();
  await navigate(page, '资金池');
  await expect(poolCard(page, '日常测试').locator('p.money')).toHaveText('-¥20.00');
  await page.getByLabel('查看预算周期').selectOption({ label: '二月 · 2027-02-10 — 2027-03-09' });
  await expect(poolCard(page, '日常测试').locator('p.money')).toHaveText('¥0.00');
  await navigate(page, '账单');
  await page.getByRole('button', { name: '撤销结算', exact: true }).click();
  await page.getByLabel('撤销原因').fill('总额录入错误');
  await page.getByRole('button', { name: '确认撤销结算' }).click();
  await page.getByRole('button', { name: '修改账单资料', exact: true }).click();
  await page.getByLabel('金额（元）', { exact: true }).fill('110.01');
  await page.getByLabel('操作原因').fill('更正原总额');
  await page.getByRole('button', { name: '确认修改资料' }).click();
  await page.getByRole('button', { name: '拆分核对' }).click();
  await page.getByLabel('分配金额 1（元）').fill('110.01');
  await page.getByRole('button', { name: '核对分配', exact: true }).click();
  await page.getByRole('button', { name: '确认结算', exact: true }).click();
  await navigate(page, '资金池');
  await expect(poolCard(page, '日常测试').locator('p.money')).toHaveText('¥10.00');
  await page.getByRole('button', { name: '资金池调拨', exact: true }).click();
  await page.getByLabel('来源资金池').selectOption({ label: '日常测试' });
  await page.getByLabel('目标资金池').selectOption({ label: '日常测试' });
  await page.getByLabel('金额（元）', { exact: true }).fill('10.00');
  await page.getByLabel('操作原因').fill('清零并停用');
  await page.getByRole('button', { name: '确认调拨' }).click();
  await expect(page.getByRole('alert')).toContainText('不能相同');
  await page.getByLabel('目标资金池').selectOption({ label: '数码测试' });
  await page.getByRole('button', { name: '确认调拨' }).click();
  await expect(poolCard(page, '日常测试').locator('p.money')).toHaveText('¥0.00');
  await expect(poolCard(page, '数码测试').locator('p.money')).toHaveText('¥10.00');
  await poolCard(page, '日常测试').getByRole('button', { name: '编辑资金池' }).click();
  await page.getByLabel('启用此资金池').uncheck();
  await page.getByRole('button', { name: '保存资金池' }).click();
  await expect(poolCard(page, '日常测试').getByText('已停用', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '预算拨款', exact: true }).click();
  await expect(page.getByLabel('资金池', { exact: true }).getByRole('option', { name: '日常测试', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await navigate(page, '历史记录');
  await page.getByLabel('操作类型').selectOption('statement_revised');
  await expect(page.getByText(/原：.*120.01.*新：.*110.01/).filter({ visible: true })).toBeVisible();
  await page.getByRole('button', { name: '清空当前账本' }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '清空当前账本' }).click();
  await page.getByRole('button', { name: '确认清除并继续' }).click();
  await expect(page.getByText('暂时没有匹配的记录')).toBeVisible();
});
