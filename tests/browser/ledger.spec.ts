import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
const card = (page: Page, name: string) =>
  page.getByRole("heading", { name, exact: true }).locator("..");
async function period(page: Page, start = "2026-10-10", end = "2026-11-09") {
  await page.goto("/plans");
  const form = card(page, "创建预算周期");
  await form.getByLabel("开始日期", { exact: true }).fill(start);
  await form.getByLabel("结束日期", { exact: true }).fill(end);
  await form.getByRole("button", { name: "创建周期", exact: true }).click();
  await expect(
    page.getByText("操作已保存到当前浏览器。", { exact: true }),
  ).toBeVisible();
}
async function pool(page: Page, name: string) {
  await page.goto("/pools");
  const form = card(page, "创建资金池");
  await form.getByLabel("资金池名称", { exact: true }).fill(name);
  await form.getByRole("button", { name: "创建资金池", exact: true }).click();
  await expect(
    card(page, "我的资金池").getByText(name, { exact: true }),
  ).toBeVisible();
}
async function grant(
  page: Page,
  poolName: string,
  periodIndex: number,
  amount: string,
) {
  await page.goto("/plans");
  const form = card(page, "确认预算拨款");
  await form
    .getByLabel("拨款周期", { exact: true })
    .selectOption({ index: periodIndex });
  await form
    .getByLabel("拨款资金池", { exact: true })
    .selectOption({ label: poolName });
  await form.getByLabel("拨款金额（元）", { exact: true }).fill(amount);
  await form.getByRole("button", { name: "确认拨款", exact: true }).click();
  await expect(
    page.getByText("操作已保存到当前浏览器。", { exact: true }),
  ).toBeVisible();
}
async function statement(page: Page) {
  await page.goto("/statements");
  const form = card(page, "登记账单");
  await form.getByLabel("信用卡名称", { exact: true }).fill("日常信用卡");
  await form.getByLabel("银行账单标识 / 账期", { exact: true }).fill("2026-10");
  await form.getByLabel("账单金额（元）", { exact: true }).fill("4000");
  await form.getByLabel("还款日期", { exact: true }).fill("2026-10-25");
  await form.getByRole("button", { name: "登记账单", exact: true }).click();
}
for (const width of [375, 768, 1440]) {
  test(`${width}px 空账本→结算→负数结转→更正→还款→备份恢复`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await period(page);
    await period(page, "2026-11-10", "2026-12-09");
    await pool(page, "日常");
    await pool(page, "数码");
    await grant(page, "数码", 1, "2000");
    await statement(page);
    await page.getByRole("button", { name: "分配账单", exact: true }).click();
    await page
      .getByLabel("分配 1 资金池", { exact: true })
      .selectOption({ label: "数码" });
    await page.getByLabel("分配 1 金额（元）", { exact: true }).fill("3999");
    await expect(
      page.getByRole("button", { name: "确认结算", exact: true }),
    ).toBeDisabled();
    await page.getByLabel("分配 1 金额（元）", { exact: true }).fill("4000");
    await page.getByRole("button", { name: "确认结算", exact: true }).click();
    await expect(page.getByText("已结算预算", { exact: true })).toBeVisible();
    await page.goto("/");
    await page
      .getByLabel("查看预算周期", { exact: true })
      .selectOption({ index: 0 });
    await expect(
      card(page, "资金池概况").getByText("-¥2,000.00", { exact: true }),
    ).toBeVisible();
    await grant(page, "数码", 2, "2000");
    await page.goto("/");
    await page
      .getByLabel("查看预算周期", { exact: true })
      .selectOption({ index: 1 });
    await expect(
      card(page, "资金池概况").getByText("¥0.00", { exact: true }),
    ).toHaveCount(2);
    await page.goto("/statements");
    await page
      .getByRole("button", { name: "更正 / 撤销", exact: true })
      .click();
    await page
      .getByLabel("分配 1 资金池", { exact: true })
      .selectOption({ label: "日常" });
    await page.getByLabel("更正或撤销原因", { exact: true }).fill("分类修正");
    await page.getByRole("button", { name: "确认更正", exact: true }).click();
    await page
      .getByRole("button", { name: "账单详情 / 还款", exact: true })
      .click();
    await page.getByLabel("本次还款金额（元）", { exact: true }).fill("1000");
    await page.getByLabel("实际还款日期", { exact: true }).fill("2026-10-25");
    await page.getByRole("button", { name: "登记还款", exact: true }).click();
    await expect(page.getByText(/尚未还款 ¥3,000.00/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/尚未还款 ¥3,000.00/)).toBeVisible();
    await page.goto("/settings");
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "导出 JSON 备份", exact: true })
      .click();
    const download = await downloadPromise;
    const backup = await readFile((await download.path())!, "utf8");
    const expected = JSON.parse(backup).ledger;
    await page
      .getByRole("button", { name: "准备清空账本", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "确认清空", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("输入“清空账本”确认", { exact: true })
      .fill("清空账本");
    await page.getByRole("button", { name: "确认清空", exact: true }).click();
    await expect(
      page.getByText("0 个周期 · 0 个资金池 · 0 张账单 · 0 条流水", {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByLabel("选择备份文件", { exact: true })
      .setInputFiles({
        name: "backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(backup),
      });
    await expect(
      page.getByRole("heading", { name: "恢复预览", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "确认覆盖恢复", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("输入“覆盖账本”确认", { exact: true })
      .fill("覆盖账本");
    await page
      .getByRole("button", { name: "确认覆盖恢复", exact: true })
      .click();
    await page.reload();
    const actual = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("next-month-budget:ledger:v1")!).ledger,
    );
    expect(actual).toEqual(expected);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/settings-${width}.png`,
      fullPage: true,
    });
  });
}
test("演示隔离、损坏文件和配额失败均保全正式账本", async ({ page }) => {
  await pool(page, "正式池");
  const original = await page.evaluate(() =>
    localStorage.getItem("next-month-budget:ledger:v1"),
  );
  await page.getByRole("button", { name: "体验演示", exact: true }).click();
  const form = card(page, "创建资金池");
  await form.getByLabel("资金池名称", { exact: true }).fill("演示新池");
  await form.getByRole("button", { name: "创建资金池", exact: true }).click();
  await page.getByRole("button", { name: "退出演示", exact: true }).click();
  await expect(
    card(page, "我的资金池").getByText("正式池", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("演示新池", { exact: true })).toHaveCount(0);
  await page.goto("/settings");
  await page
    .getByLabel("选择备份文件", { exact: true })
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from("{broken"),
    });
  await expect(page.getByRole("alert")).toContainText("无法解析");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("next-month-budget:ledger:v1"),
    ),
  ).toBe(original);
  await page.goto("/pools");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "next-month-budget:ledger:v1")
        throw new DOMException("quota", "QuotaExceededError");
      original.call(this, key, value);
    };
  });
  await card(page, "创建资金池")
    .getByLabel("资金池名称", { exact: true })
    .fill("保存失败池");
  await card(page, "创建资金池")
    .getByRole("button", { name: "创建资金池", exact: true })
    .click();
  await expect(card(page, "创建资金池").getByRole("alert")).toContainText(
    "保存失败",
  );
  await expect(
    card(page, "我的资金池").getByText("保存失败池", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("next-month-budget:ledger:v1"),
    ),
  ).toBe(original);
});
test("多标签页独占编辑，释放后自动读取最新账本", async ({ page, context }) => {
  await pool(page, "首标签页");
  const second = await context.newPage();
  await second.goto("/pools");
  await expect(second.getByText(/当前以只读方式打开/)).toBeVisible();
  await card(second, "创建资金池")
    .getByLabel("资金池名称", { exact: true })
    .fill("不应保存");
  await card(second, "创建资金池")
    .getByRole("button", { name: "创建资金池", exact: true })
    .click();
  await expect(card(second, "创建资金池").getByRole("alert")).toContainText(
    "其他标签页",
  );
  await page.close();
  await expect(second.getByText(/当前以只读方式打开/)).toHaveCount(0);
  await expect(
    card(second, "我的资金池").getByText("首标签页", { exact: true }),
  ).toBeVisible();
  await card(second, "创建资金池")
    .getByLabel("资金池名称", { exact: true })
    .fill("接力标签页");
  await card(second, "创建资金池")
    .getByRole("button", { name: "创建资金池", exact: true })
    .click();
  await expect(
    card(second, "我的资金池").getByText("接力标签页", { exact: true }),
  ).toBeVisible();
});
test("损坏本地快照启动时锁定，不自动清空覆盖", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("next-month-budget:ledger:v1", "broken"),
  );
  await page.goto("/pools");
  await expect(page.getByRole("alert")).toContainText("读取失败");
  await card(page, "创建资金池")
    .getByLabel("资金池名称", { exact: true })
    .fill("不应创建");
  await card(page, "创建资金池")
    .getByRole("button", { name: "创建资金池", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("next-month-budget:ledger:v1"),
    ),
  ).toBe("broken");
});
