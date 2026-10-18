import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { pages } from "@/pages/config";
import { useWorkspace } from "./workspace";
import { Card, Empty, Field, Form } from "./ui";
import { cents, money, periodLabel, uid, value } from "./format";
import {
  allocateIncome,
  cancelSettlement,
  correctSettlement,
  createBudgetPeriod,
  createBudgetPool,
  getPoolBalance,
  recordStatement,
  settleStatement,
  transferBudget,
  type Allocation,
  type Statement,
} from "@/domain/budget";

export function BudgetPage({ path }: { path: string }) {
  const page = pages.find((p) => p.path === path)!;
  const { demo, toggleDemo, message } = useWorkspace();
  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-widest text-muted-foreground">
            我的预算空间
          </p>
          <h1 className="text-3xl font-semibold">{page.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{page.subtitle}</p>
        </div>
        <Button variant="outline" onClick={toggleDemo}>
          {demo ? "退出演示" : "体验演示"}
        </Button>
      </div>
      <p className="mb-6 rounded-xl bg-accent px-4 py-3 text-sm">
        {demo
          ? "演示空间：所有示例为虚构数据，操作不会影响正式账本。"
          : "交互原型：尚未接入真实入账及长期保存。"}
      </p>
      {message && (
        <p role="status" className="mb-5 rounded-xl bg-muted p-4">
          {message}
        </p>
      )}
      {path === "/" && <Overview />}
      {path === "/pools" && <Pools />}
      {path === "/plans" && <Plans />}
      {path === "/statements" && <Statements />}
      {path === "/history" && <History />}
      {path === "/settings" && <Settings />}
    </>
  );
}
function PeriodSelect({
  name = "periodId",
  defaultValue,
}: {
  name?: string;
  defaultValue?: string;
}) {
  const { ledger } = useWorkspace();
  return (
    <select name={name} defaultValue={defaultValue} required>
      <option value="">选择预算周期</option>
      {ledger.periods.map((p) => (
        <option key={p.id} value={p.id}>
          {periodLabel(p)}
        </option>
      ))}
    </select>
  );
}
function PoolSelect({
  name = "poolId",
  defaultValue,
}: {
  name?: string;
  defaultValue?: string;
}) {
  const { ledger } = useWorkspace();
  return (
    <select name={name} defaultValue={defaultValue} required>
      <option value="">选择资金池</option>
      {ledger.pools
        .filter((p) => p.active)
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
    </select>
  );
}
function Amount({
  name = "amount",
  defaultValue,
}: {
  name?: string;
  defaultValue?: string;
}) {
  return (
    <input
      name={name}
      defaultValue={defaultValue}
      inputMode="decimal"
      placeholder="0.00"
      required
      maxLength={16}
    />
  );
}
function Overview() {
  const { ledger } = useWorkspace();
  const [selected, setSelected] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const period =
    ledger.periods.find((p) => p.id === selected) ??
    ledger.periods.find((p) => p.startsOn <= today && p.endsOn >= today) ??
    ledger.periods.at(-1);
  const total = period
    ? ledger.pools.reduce(
        (sum, p) => sum + getPoolBalance(ledger, p.id, period.id),
        0,
      )
    : 0;
  return (
    <div className="space-y-6">
      {!period ? (
        <Card title="从你的第一个周期开始">
          <p className="mb-5 text-sm leading-7 text-muted-foreground">
            先定义周期，再创建资金池、拨款和结算。账本从零开始，由你安排。
          </p>
          <Button asChild>
            <Link to="/plans">创建预算周期</Link>
          </Button>
        </Card>
      ) : (
        <Card>
          <Field label="查看预算周期">
            <select
              value={period.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {ledger.periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {periodLabel(p)}
                </option>
              ))}
            </select>
          </Field>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric
          label="累计预算余额"
          amount={money(total)}
          detail="含正负结转，不等于银行现金"
        />
        <Metric
          label="待分配账单"
          amount={String(
            ledger.statements.filter((s) => s.status === "recorded").length,
          )}
          detail="登记后需全额分配确认"
        />
        <Metric
          label="已结算预算额"
          amount={money(
            ledger.entries
              .filter(
                (e) =>
                  e.periodId === period?.id &&
                  (e.kind === "statement_settlement" || e.kind === "reversal"),
              )
              .reduce((sum, e) => sum - e.amount, 0),
          )}
          detail="所选周期，含更正与撤销"
        />
      </div>
      <Card title="资金池概况">
        {!ledger.pools.length ? (
          <Empty>
            还没有资金池。
            <Link to="/pools" className="underline">
              创建资金池
            </Link>
            ，为预算安排去处。
          </Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {ledger.pools.map((p) => (
              <div key={p.id} className="rounded-xl bg-muted p-4">
                <p className="text-sm">{p.name}</p>
                <p
                  className={`mt-2 text-2xl font-semibold tabular-nums ${period && getPoolBalance(ledger, p.id, period.id) < 0 ? "error-text" : ""}`}
                >
                  {money(period ? getPoolBalance(ledger, p.id, period.id) : 0)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {p.active ? "余额自动跨期保留" : "已停用"}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="接下来">
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/pools">管理资金池</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/statements">处理账单</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/settings">备份与恢复</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
function Metric({
  label,
  amount,
  detail,
}: {
  label: string;
  amount: string;
  detail: string;
}) {
  return (
    <Card>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="my-3 break-words text-3xl font-semibold tabular-nums">
        {amount}
      </p>
      <p className="text-xs leading-6 text-muted-foreground">{detail}</p>
    </Card>
  );
}
function Pools() {
  const { ledger, commit } = useWorkspace();
  return (
    <div className="space-y-6">
      <Card title="我的资金池">
        {!ledger.pools.length ? (
          <Empty>资金池尚为空。按生活需要创建，不会自动填入示例金额。</Empty>
        ) : (
          <div className="divide-y divide-border">
            {ledger.pools.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 py-4"
              >
                <span>{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  {p.active ? "使用中" : "已停用"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <div className="grid items-start gap-6 md:grid-cols-2">
        <Form
          title="创建资金池"
          onSubmit={(d) =>
            commit((l) =>
              createBudgetPool(l, { id: uid(), name: value(d, "name") }),
            )
          }
          submit="创建资金池"
        >
          <Field label="资金池名称">
            <input
              name="name"
              required
              maxLength={40}
              placeholder="例如：旅行计划"
            />
          </Field>
        </Form>
        <Form
          title="预算调拨"
          submit="确认调拨"
          onSubmit={(d) =>
            commit((l) =>
              transferBudget(l, {
                id: uid(),
                periodId: value(d, "periodId"),
                fromPoolId: value(d, "from"),
                toPoolId: value(d, "to"),
                amount: cents(value(d, "amount")),
                reason: value(d, "reason"),
              }),
            )
          }
        >
          <Field label="调拨周期">
            <PeriodSelect />
          </Field>
          <Field label="来源资金池">
            <PoolSelect name="from" />
          </Field>
          <Field label="去向资金池">
            <PoolSelect name="to" />
          </Field>
          <Field label="调拨金额（元）">
            <Amount />
          </Field>
          <Field label="调拨原因">
            <input name="reason" required maxLength={200} />
          </Field>
          <p className="text-xs leading-6 text-muted-foreground">
            一出一入，总预算不变；允许显式调拨后出现负余额。
          </p>
        </Form>
      </div>
    </div>
  );
}
function Plans() {
  const { ledger, commit } = useWorkspace();
  return (
    <div className="space-y-6">
      <Card title="预算周期">
        {!ledger.periods.length ? (
          <Empty>
            支持非自然月。例如发薪日到下次发薪前一天。周期不能重叠。
          </Empty>
        ) : (
          <ul className="space-y-3">
            {ledger.periods.map((p) => (
              <li key={p.id} className="rounded-xl bg-muted p-4 text-sm">
                {periodLabel(p)}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="grid items-start gap-6 md:grid-cols-2">
        <Form
          title="创建预算周期"
          submit="创建周期"
          onSubmit={(d) =>
            commit((l) =>
              createBudgetPeriod(l, {
                id: uid(),
                startsOn: value(d, "start"),
                endsOn: value(d, "end"),
              }),
            )
          }
        >
          <Field label="开始日期">
            <input type="date" name="start" required />
          </Field>
          <Field label="结束日期">
            <input type="date" name="end" required />
          </Field>
        </Form>
        <Form
          title="确认预算拨款"
          submit="确认拨款"
          onSubmit={(d) =>
            commit((l) =>
              allocateIncome(l, {
                id: uid(),
                periodId: value(d, "periodId"),
                poolId: value(d, "poolId"),
                amount: cents(value(d, "amount")),
              }),
            )
          }
        >
          <Field label="拨款周期">
            <PeriodSelect />
          </Field>
          <Field label="拨款资金池">
            <PoolSelect />
          </Field>
          <Field label="拨款金额（元）">
            <Amount />
          </Field>
          <p className="text-xs leading-6 text-muted-foreground">
            预算拨款不是银行转账，每次确认都会产生独立流水。
          </p>
        </Form>
      </div>
    </div>
  );
}
function Statements() {
  const { ledger, commit } = useWorkspace();
  const [editing, setEditing] = useState<string>("");
  return (
    <div className="space-y-6">
      <Card title="账单列表">
        {!ledger.statements.length ? (
          <Empty>还没有账单。只需登记银行账单总额，无需逐笔记账。</Empty>
        ) : (
          <div className="space-y-4">
            {ledger.statements.map((s) => (
              <article
                key={s.id}
                className="rounded-xl border border-border p-4"
              >
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <h3 className="font-medium">{s.accountId}</h3>
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {s.fingerprint} · 到期 {s.dueOn}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">
                    {money(s.amount)}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="badge">
                    {
                      {
                        recorded: "待分配",
                        settled: "已结算预算",
                        cancelled: "已撤销",
                      }[s.status]
                    }
                  </span>
                  {s.status !== "cancelled" && (
                    <Button
                      variant="outline"
                      onClick={() => setEditing(editing === s.id ? "" : s.id)}
                    >
                      {editing === s.id
                        ? "收起"
                        : s.status === "settled"
                          ? "更正 / 撤销"
                          : "分配账单"}
                    </Button>
                  )}
                </div>
                {editing === s.id && (
                  <Settlement
                    key={s.id}
                    statement={s}
                    close={() => setEditing("")}
                  />
                )}
              </article>
            ))}
          </div>
        )}
      </Card>
      <Form
        title="登记账单"
        submit="登记账单"
        onSubmit={(d) =>
          commit((l) =>
            recordStatement(l, {
              id: uid(),
              accountId: value(d, "account"),
              fingerprint: `${value(d, "account")}:${value(d, "reference")}`,
              amount: cents(value(d, "amount")),
              dueOn: value(d, "due"),
            }),
          )
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="信用卡名称" hint="使用昵称即可，请勿填写完整卡号。">
            <input
              name="account"
              required
              maxLength={40}
              placeholder="例如：日常信用卡"
            />
          </Field>
          <Field
            label="银行账单标识 / 账期"
            hint="同卡同账期保持一致，用于防止重复登记。"
          >
            <input
              name="reference"
              required
              maxLength={80}
              placeholder="例如：2026-10"
            />
          </Field>
          <Field label="账单金额（元）">
            <Amount />
          </Field>
          <Field label="还款日期">
            <input type="date" name="due" required />
          </Field>
        </div>
      </Form>
    </div>
  );
}
function Settlement({
  statement,
  close,
}: {
  statement: Statement;
  close: () => void;
}) {
  const { ledger, commit } = useWorkspace();
  const defaultPeriod =
    ledger.periods.find(
      (p) => p.startsOn <= statement.dueOn && p.endsOn >= statement.dueOn,
    )?.id ?? "";
  const [rows, setRows] = useState<
    { id: string; poolId: string; periodId: string; text: string }[]
  >(() =>
    statement.allocations.length
      ? statement.allocations.map((a) => ({
          ...a,
          text: (a.amount / 100).toFixed(2),
        }))
      : [
          {
            id: uid(),
            poolId: "",
            periodId: defaultPeriod,
            text: (statement.amount / 100).toFixed(2),
          },
        ],
  );
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  let total = 0;
  let valid = true;
  for (const r of rows) {
    try {
      total += cents(r.text);
    } catch {
      valid = false;
    }
  }
  const difference = statement.amount - total;
  function update(id: string, key: string, text: string) {
    setRows(rows.map((r) => (r.id === id ? { ...r, [key]: text } : r)));
  }
  function confirm(cancel = false) {
    setError("");
    try {
      const allocations: Allocation[] = rows.map((r) => ({
        id: r.id,
        poolId: r.poolId,
        periodId: r.periodId,
        amount: cents(r.text),
      }));
      commit((l) =>
        cancel
          ? cancelSettlement(l, statement.id, reason)
          : statement.status === "settled"
            ? correctSettlement(l, statement.id, allocations, reason)
            : settleStatement(l, statement.id, allocations),
      );
      close();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="mt-5 space-y-4 border-t border-border pt-5">
      <p className="text-sm text-muted-foreground">
        默认建议还款日所在周期；可手动跨周期拆分。结算不代表已还款。
      </p>
      {rows.map((r, i) => (
        <div
          key={r.id}
          className="grid items-end gap-3 rounded-xl bg-muted p-3 sm:grid-cols-2"
        >
          <Field label={`分配 ${i + 1} 资金池`}>
            <select
              value={r.poolId}
              onChange={(e) => update(r.id, "poolId", e.target.value)}
            >
              <option value="">选择资金池</option>
              {ledger.pools
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={`分配 ${i + 1} 周期`}>
            <select
              value={r.periodId}
              onChange={(e) => update(r.id, "periodId", e.target.value)}
            >
              <option value="">选择预算周期</option>
              {ledger.periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {periodLabel(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`分配 ${i + 1} 金额（元）`}>
            <input
              inputMode="decimal"
              value={r.text}
              onChange={(e) => update(r.id, "text", e.target.value)}
            />
          </Field>
          <Button
            variant="ghost"
            disabled={rows.length === 1}
            onClick={() => setRows(rows.filter((x) => x.id !== r.id))}
          >
            删除分配 {i + 1}
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        onClick={() =>
          setRows([
            ...rows,
            { id: uid(), poolId: "", periodId: defaultPeriod, text: "" },
          ])
        }
      >
        添加分配
      </Button>
      <p
        role="status"
        className={difference !== 0 || !valid ? "error-text" : "text-primary"}
      >
        {valid ? `待分配差额：${money(difference)}` : "请检查分配金额格式"}
      </p>
      {statement.status === "settled" && (
        <Field label="更正或撤销原因">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
          />
        </Field>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={
            !valid ||
            difference !== 0 ||
            rows.some((r) => !r.poolId || !r.periodId) ||
            (statement.status === "settled" && !reason.trim())
          }
          onClick={() => confirm()}
        >
          {statement.status === "settled" ? "确认更正" : "确认结算"}
        </Button>
        {statement.status === "settled" && (
          <Button
            variant="outline"
            disabled={!reason.trim()}
            onClick={() => confirm(true)}
          >
            撤销预算结算
          </Button>
        )}
      </div>
    </div>
  );
}
const kinds: Record<string, string> = {
  period_created: "创建周期",
  pool_created: "创建资金池",
  income_allocated: "预算拨款",
  statement_recorded: "登记账单",
  statement_settled: "结算账单",
  budget_transferred: "预算调拨",
  settlement_cancelled: "撤销结算",
  settlement_corrected: "更正结算",
};
function History() {
  const { ledger } = useWorkspace();
  return (
    <div className="space-y-6">
      <Card title="操作审计">
        {!ledger.audit.length ? (
          <Empty>还没有操作记录。确认操作后会在这里留下痕迹。</Empty>
        ) : (
          <ol className="space-y-3">
            {[...ledger.audit].reverse().map((e, i) => (
              <li key={e.id} className="rounded-xl bg-muted p-4">
                <p className="text-sm font-medium">
                  {ledger.audit.length - i}. {kinds[e.kind] ?? e.kind}
                </p>
                <p className="mt-2 break-all text-xs text-muted-foreground">
                  {e.reason ?? "系统保留操作记录"} · {e.subjectId}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <Card title="预算流水">
        {!ledger.entries.length ? (
          <Empty>暂无流水。</Empty>
        ) : (
          <ul className="space-y-3">
            {[...ledger.entries].reverse().map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap justify-between gap-3 border-b border-border py-3 text-sm"
              >
                <span>
                  {ledger.pools.find((p) => p.id === e.poolId)?.name}
                  <small className="mt-1 block text-muted-foreground">
                    {ledger.periods.find((p) => p.id === e.periodId)?.startsOn}{" "}
                    · {e.kind}
                  </small>
                </span>
                <strong className={e.amount < 0 ? "error-text" : ""}>
                  {money(e.amount)}
                </strong>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
function Settings() {
  return (
    <Card title="数据与隐私">
      <p className="text-sm leading-8 text-muted-foreground">
        首版账本仅保存在当前浏览器，不上传服务器。备份、恢复和本地数据保护将在持久化阶段接入。预算余额不等于银行现金；信用卡预算结算不代表已还款。
      </p>
    </Card>
  );
}
