import { expect, test } from '@playwright/test';

const routes = [
  ['/', '概览'], ['/pools', '资金池'], ['/statements', '账单'],
  ['/plans', '预算计划'], ['/history', '历史记录'], ['/settings', '设置'],
];

for (const width of [375, 768, 1440]) {
  test(`${width}px 路由、主题与布局`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const [path, title] of routes) {
      await page.goto(`./#${path}`);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      const links = page.getByRole('navigation', { name: '主导航' }).getByRole('link');
      for (const link of await links.all()) await expect(link).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    }
    await page.reload();
    await expect(page.getByRole('heading', { name: '设置', exact: true })).toBeVisible();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.reload();
    await page.getByRole('button', { name: '切换深色主题' }).filter({ visible: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: '切换浅色主题' }).filter({ visible: true }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.goto('./#/unknown');
    await page.getByRole('link', { name: '返回概览' }).click();
    await expect(page.getByRole('heading', { name: '概览', exact: true })).toBeVisible();
    await page.getByRole('navigation').getByRole('link', { name: '资金池', exact: true }).click();
    await expect(page.getByRole('heading', { name: '资金池', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/shell-${width}.png`, fullPage: true });
  });
}
