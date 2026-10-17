import { expect, test } from '@playwright/test';

for (const width of [375, 768, 1440]) {
  test(`${width}px 统计账本一致，负结转及只读预测不写入本地`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./#/pools');
    await page.getByRole('button', { name: '创建资金池', exact: true }).click();
    await page.getByLabel('资金池名称').fill('用户账本');
    await page.getByRole('button', { name: '确认添加', exact: true }).click();
    const original = await page.evaluate(() => localStorage.getItem('next-month-budget:ledger'));
    await page.getByRole('button', { name: '查看独立演示' }).click();
    const nav = page.getByRole('navigation', { name: '主导航' });
    await nav.getByRole('link', { name: '账单', exact: true }).click();
    await page.getByRole('button', { name: '拆分核对' }).first().click();
    await page.getByLabel('资金池 1', { exact: true }).selectOption('digital');
    await page.getByLabel('分配金额 1（元）').fill('2600');
    await page.getByRole('button', { name: '核对分配', exact: true }).click();
    await page.getByRole('button', { name: '确认结算', exact: true }).click();
    await nav.getByRole('link', { name: '概览', exact: true }).click();
    const bridge = page.locator('section').filter({ has: page.getByRole('heading', { name: '本期预算收支桥梁', exact: true }) });
    await expect(bridge.getByText('¥5,500.00', { exact: true })).toBeVisible();
    await expect(bridge.getByText('¥2,600.00', { exact: true })).toBeVisible();
    await expect(bridge.getByText('¥2,900.00', { exact: true })).toBeVisible();
    await page.getByLabel('趋势资金池').selectOption('digital');
    await expect(page.getByRole('img', { name: '预算期末余额趋势；精确金额见下方周期明细' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/statistics-${width}.png`, fullPage: true });
    await nav.getByRole('link', { name: '预算计划', exact: true }).click();
    await expect(page.getByText('模拟结果 · 未保存，未创建周期或账务流水。结果不代表现金、储蓄或实际可还款金额。')).toHaveCount(0);
    await page.getByLabel('数码兴趣 · 每期额外拨款（元）').fill('200.001');
    await page.getByRole('button', { name: '生成只读模拟' }).click();
    await expect(page.getByRole('alert')).toContainText('最多两位小数');
    await page.getByLabel('数码兴趣 · 每期额外拨款（元）').fill('200');
    await page.getByRole('button', { name: '生成只读模拟' }).click();
    await expect(page.getByText('数码兴趣 · -¥400.00', { exact: true })).toBeVisible();
    await expect(page.getByText('数码兴趣 · -¥200.00', { exact: true })).toBeVisible();
    await expect(page.getByText('数码兴趣 · ¥0.00', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('next-month-budget:ledger'))).toBe(original);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.screenshot({ path: `test-results/forecast-${width}.png`, fullPage: true });
    await page.getByLabel('模拟周期数').selectOption('1');
    await expect(page.getByText('数码兴趣 · -¥400.00', { exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByText('先建立周期与启用资金池', { exact: true })).toBeVisible();
  });
}
