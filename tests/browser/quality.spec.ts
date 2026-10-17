import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const width of [375, 1440]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`${width}px ${theme} 六页 WCAG AA 检查`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('./#/');
      await page.getByRole('button', { name: '查看独立演示' }).click();
      for (const title of ['概览', '资金池', '账单', '预算计划', '历史记录', '设置']) {
        await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: title, exact: true }).click();
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })), title).toEqual([]);
      }
    });
  }
}

test('键盘跳至内容、焦点约束、Escape 返回与无效表单可修正', async ({ page }) => {
  await page.goto('./#/pools');
  const url = page.url();
  await page.getByRole('link', { name: '跳至主要内容' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  expect(page.url()).toBe(url);
  const trigger = page.getByRole('button', { name: '创建资金池', exact: true });
  await trigger.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: '创建资金池' });
  await expect(dialog).toBeVisible();
  const result = await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBeTruthy();
  }
  await page.getByLabel('资金池名称').fill('   ');
  await page.getByRole('button', { name: '确认添加', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('不能为空');
  await page.getByLabel('资金池名称').fill('键盘验收');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('heading', { name: '键盘验收', exact: true })).toHaveCount(0);
});

test('触摸窄屏与长文本布局、深层刷新和静态资源', async ({ browser, browserName }) => {
  const touch = browserName !== 'firefox';
  const context = await browser.newContext({ viewport: { width: 320, height: 740 }, hasTouch: touch, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const failures: string[] = [];
  page.on('pageerror', e => failures.push(e.message));
  page.on('response', response => { if (response.status() >= 400) failures.push(String(response.status())); });
  await page.goto('http://127.0.0.1:4173/#/pools');
  const create = page.getByRole('button', { name: '创建资金池', exact: true });
  if (touch) await create.tap(); else await create.click();
  await page.getByLabel('资金池名称').fill('一个没有空格的特别长的资金池名称ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  const confirm = page.getByRole('button', { name: '确认添加', exact: true });
  if (touch) await confirm.tap(); else await confirm.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('heading', { name: /^一个没有空格/ })).toBeVisible();
  const settings = page.getByRole('navigation').getByRole('link', { name: '设置', exact: true });
  if (touch) await settings.tap(); else await settings.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(failures).toEqual([]);
  await context.close();
});
