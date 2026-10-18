import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getRepaidAmount,
  recordRepayment,
  reopenStatement,
  updateBudgetPool,
  updateStatement,
  voidRepayment,
  type BudgetPool,
  type Statement,
} from "@/domain/budget";
import { useWorkspace } from "./workspace";
import { Field, Form } from "./ui";
import { Amount } from "./controls";
import { cents, money, uid, value } from "./format";

export function PoolEditor({ pool }: { pool: BudgetPool }) {
  const { commit } = useWorkspace();
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <Button
        variant="outline"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        管理 {pool.name}
      </Button>
      {open && (
        <div className="mt-4">
          <Form
            title="编辑资金池"
            submit="保存资金池"
            onSubmit={(d) => {
              commit((l) =>
                updateBudgetPool(l, pool.id, {
                  name: value(d, "name"),
                  active: value(d, "active") === "true",
                  regularAllocation: cents(value(d, "regular")),
                }),
              );
              setOpen(false);
            }}
          >
            <Field label="新名称">
              <input
                name="name"
                defaultValue={pool.name}
                required
                maxLength={40}
              />
            </Field>
            <Field
              label="常规每期拨款（元）"
              hint="用于只读预测，不会自动入账。"
            >
              <Amount
                name="regular"
                defaultValue={((pool.regularAllocation ?? 0) / 100).toFixed(2)}
              />
            </Field>
            <Field label="资金池状态">
              <select name="active" defaultValue={String(pool.active)}>
                <option value="true">启用</option>
                <option value="false">停用</option>
              </select>
            </Field>
            <p className="text-xs leading-6 text-muted-foreground">
              停用须各期余额为零，且无当前或未来流水；历史记录保留。
            </p>
          </Form>
        </div>
      )}
    </div>
  );
}
export function RepaymentSummary({ statement }: { statement: Statement }) {
  const { ledger } = useWorkspace();
  const repaid = getRepaidAmount(ledger, statement.id);
  return (
    <p className="mt-4 text-xs leading-6 text-muted-foreground">
      已登记还款 {money(repaid)} · 尚未还款 {money(statement.amount - repaid)}
      <br />
      仅按你登记的记录计算，未与银行核对。还款不会再次扣预算。
    </p>
  );
}
export function StatementOperations({ statement }: { statement: Statement }) {
  const { commit, ledger } = useWorkspace();
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <Button
        variant="ghost"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        账单详情 / 还款
      </Button>
      {open && (
        <div className="mt-3 grid items-start gap-4 xl:grid-cols-2">
          {statement.status === "recorded" && (
            <Form
              title="编辑未结算账单"
              submit="保存账单修改"
              onSubmit={(d) =>
                commit((l) =>
                  updateStatement(l, statement.id, {
                    amount: cents(value(d, "amount")),
                    dueOn: value(d, "due"),
                    reason: value(d, "reason"),
                  }),
                )
              }
            >
              <Field label="修改账单金额（元）">
                <Amount defaultValue={(statement.amount / 100).toFixed(2)} />
              </Field>
              <Field label="修改还款日期">
                <input
                  type="date"
                  name="due"
                  defaultValue={statement.dueOn}
                  required
                />
              </Field>
              <Field label="账单修改原因">
                <input name="reason" required maxLength={200} />
              </Field>
            </Form>
          )}
          {statement.status === "cancelled" && (
            <Form
              title="重新打开账单"
              submit="重新打开"
              onSubmit={(d) =>
                commit((l) =>
                  reopenStatement(l, statement.id, value(d, "reason")),
                )
              }
            >
              <Field label="重新打开原因">
                <input name="reason" required maxLength={200} />
              </Field>
              <p className="text-xs leading-6 text-muted-foreground">
                保留原账单去重标识，重新分配前不扣减预算。
              </p>
            </Form>
          )}
          <div className="space-y-4">
            {ledger.repayments
              .filter((r) => r.statementId === statement.id)
              .map((r) => (
                <div key={r.id} className="rounded-xl border border-border p-4">
                  <p className="text-sm">
                    {r.paidOn} · {money(r.amount)} ·{" "}
                    {r.voided ? "登记已作废" : "还款登记有效"}
                  </p>
                  {!r.voided && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm">
                        登记有误？作废记录
                      </summary>
                      <div className="mt-3">
                        <Form
                          title="作废还款登记"
                          submit="确认作废登记"
                          onSubmit={(d) =>
                            commit((l) =>
                              voidRepayment(l, r.id, value(d, "reason")),
                            )
                          }
                        >
                          <Field label="作废登记原因">
                            <input name="reason" required maxLength={200} />
                          </Field>
                          <p className="text-xs text-muted-foreground">
                            仅更正本应用记录，不撤销银行支付。作废后可重新登记。
                          </p>
                        </Form>
                      </div>
                    </details>
                  )}
                </div>
              ))}
          </div>
          <Form
            title="登记已完成的还款"
            submit="登记还款"
            onSubmit={(d) =>
              commit((l) =>
                recordRepayment(l, {
                  id: uid(),
                  statementId: statement.id,
                  amount: cents(value(d, "amount")),
                  paidOn: value(d, "paid"),
                }),
              )
            }
          >
            <Field label="本次还款金额（元）">
              <Amount />
            </Field>
            <Field label="实际还款日期">
              <input type="date" name="paid" required />
            </Field>
          </Form>
        </div>
      )}
    </div>
  );
}
