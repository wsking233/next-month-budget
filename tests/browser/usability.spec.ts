import { expect, test } from '@playwright/test';

test('建账引导按数据推进，取消不产生记录，刷新恢复进度和主题', async ({ page }) => {
  await page.goto('./#/');
  const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: '建账进度' }) });
  await expect(panel).toContainText('1 · 创建预算周期 · 待完成');
  await panel.getByRole('button', { name: '创建预算周期', exact: true }).click();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => localStorage.getItem('next-month-budget:ledger'))).toBeNull();
  await panel.getByRole('button', { name: '创建预算周期', exact: true }).click();
  await page.getByLabel('周期名称').fill('第一期');
  await page.getByLabel('开始日期').fill('2026-10-10');
  await page.getByLabel('结束日期').fill('2026-11-09');
  await page.getByRole('button', { name: '确认添加', exact: true }).click();
  await expect(panel).toContainText('1 · 创建预算周期 · 已完成');
  await panel.getByRole('button', { name: '创建资金池', exact: true }).click();
  await page.getByLabel('资金池名称').fill('生活');
  await page.getByRole('button', { name: '确认添加', exact: true }).click();
  await expect(panel.getByRole('button', { name: '预算拨款', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '切换深色主题' }).filter({ visible: true }).click();
  const raw = await page.evaluate(() => localStorage.getItem('next-month-budget:ledger'));
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(panel).toContainText('2 · 创建资金池 · 已完成');
  expect(await page.evaluate(() => localStorage.getItem('next-month-budget:ledger'))).toBe(raw);
  await page.getByRole('button', { name: '查看独立演示' }).click();
  await expect(panel).toHaveCount(0);
});

test('账单组合筛选及日期错误不修改账本，历史筛选可重置', async ({ page }) => {
  await page.goto('./#/');
  await page.getByRole('button', { name: '查看独立演示' }).click();
  await page.getByRole('navigation').getByRole('link', { name: '账单', exact: true }).click();
  await page.getByLabel('搜索账户').fill('信用卡 a');
  await expect(page.getByRole('heading', { name: '演示信用卡 A', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '演示信用卡 B', exact: true })).toHaveCount(0);
  await page.getByLabel('还款日起').fill('2026-10-25');
  await page.getByLabel('还款日止').fill('2026-10-25');
  await expect(page.getByText('匹配 1 / 2 张账单')).toBeVisible();
  await page.getByLabel('账单状态').selectOption('settled');
  await expect(page.getByText('匹配 0 / 2 张账单')).toBeVisible();
  await page.getByLabel('还款日止').fill('2026-10-24');
  await expect(page.getByRole('alert')).toContainText('不能晚于');
  await page.getByRole('button', { name: '清空筛选' }).click();
  await expect(page.getByText('匹配 2 / 2 张账单')).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: '历史记录', exact: true }).click();
  await page.getByLabel('搜索记录').fill('不会存在的内容');
  await expect(page.getByText('匹配 0 条记录')).toBeVisible();
  await page.getByRole('button', { name: '清空筛选' }).click();
  await expect(page.getByText('匹配 9 条记录')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('next-month-budget:ledger'))).toBeNull();
});

test('偏好存储不可用时主题仍可切换且账本可正常保存', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'next-month-budget:theme') throw new DOMException('Preference blocked');
      original.call(this, key, value);
    };
  });
  await page.goto('./#/pools');
  await page.getByRole('button', { name: '切换深色主题' }).filter({ visible: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: '创建资金池', exact: true }).click();
  await page.getByLabel('资金池名称').fill('偏好独立');
  await page.getByRole('button', { name: '确认添加', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: '偏好独立', exact: true })).toBeVisible();
});
