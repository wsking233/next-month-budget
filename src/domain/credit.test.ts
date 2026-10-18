import { describe, expect, it } from 'vitest';
import { createDemoLedger } from '@/fixtures/demo-ledger';
import { cancelSettlement, getPoolBalance, recordStatement, reviseStatement, settleStatement } from './budget';
import { accountName, cancelRepayment, linkStatementAccount, recordRepayment, repaymentSummary, saveCreditAccount } from './credit';
import { parseSnapshot, serializeSnapshot } from '@/storage/snapshot';
const pay = (id = 'pay1', amount = 100000) => ({ id, amount, statementId: 'a', reference: id, paidOn: '2026-10-20' });
const settle = (ledger: ReturnType<typeof createDemoLedger>) => settleStatement(ledger, 'a', [{ id: 'allocation', poolId: 'daily', periodId: 'oct', amount: 260000 }]);
describe('信用卡实际还款', () => {
  it.each(['先还款', '先结算'])('%s：预算只扣一次，多次还款精确还清', order => {
    const original = createDemoLedger();
    let ledger = order === '先还款' ? settle(recordRepayment(original, pay())) : recordRepayment(settle(original), pay());
    ledger = recordRepayment(ledger, pay('pay2', 160000));
    expect(getPoolBalance(ledger, 'daily', 'oct')).toBe(90000);
    expect(repaymentSummary(ledger, ledger.statements[0])).toMatchObject({ paid: 260000, outstanding: 0, label: '已还清' });
    const cancelled = cancelSettlement(ledger, 'a', '分类错误');
    expect(repaymentSummary(cancelled, cancelled.statements[0]).paid).toBe(260000);
    expect(getPoolBalance(cancelled, 'daily', 'oct')).toBe(350000);
    expect(parseSnapshot(serializeSnapshot({ ledger: cancelled, currentPeriod: 'oct' })).workspace.ledger).toEqual(cancelled);
  });
  it('重复、超额、无效日期及非整数失败原子性', () => {
    const ledger = recordRepayment(createDemoLedger(), pay());
    const raw = JSON.stringify(ledger);
    expect(() => recordRepayment(ledger, { ...pay('other'), reference: ' pay1 ' })).toThrow(/重复/);
    expect(() => recordRepayment(ledger, pay())).toThrow(/已使用/);
    expect(() => recordRepayment(ledger, pay('extra', 160001))).toThrow(/超过/);
    expect(() => recordRepayment(ledger, { ...pay('wrong'), paidOn: '2026-02-30' })).toThrow(/日期/);
    expect(() => recordRepayment(ledger, pay('fraction', 1.1))).toThrow(/整数/);
    expect(JSON.stringify(ledger)).toBe(raw);
  });
  it('撤销还款保留历史，释放未还金额，不影响预算，原标识不能复用', () => {
    const ledger = recordRepayment(settle(createDemoLedger()), pay());
    const cancelled = cancelRepayment(ledger, 'pay1', '录入错误');
    expect(cancelled.entries).toEqual(ledger.entries);
    expect(repaymentSummary(cancelled, cancelled.statements[0])).toMatchObject({ paid: 0, outstanding: 260000 });
    expect(cancelled.credit?.repayments[0]).toMatchObject({ status: 'cancelled', cancellationReason: '录入错误' });
    expect(() => cancelRepayment(cancelled, 'pay1', '重复')).toThrow(/已撤销/);
    expect(() => recordRepayment(cancelled, { ...pay('new'), reference: 'pay1' })).toThrow(/重复/);
    expect(() => cancelRepayment(ledger, 'pay1', '  ')).toThrow(/原因/);
    expect(parseSnapshot(serializeSnapshot({ ledger: cancelled, currentPeriod: 'oct' })).workspace.ledger).toEqual(cancelled);
  });
  it('修改账单不得低于有效还款；先撤销错误还款后可修正', () => {
    const ledger = recordRepayment(createDemoLedger(), pay());
    const patch = { accountId: '演示信用卡 A', fingerprint: 'DEMO-2026-10-A', amount: 99999, dueOn: '2026-10-25' };
    expect(() => reviseStatement(ledger, 'a', patch, '更正')).toThrow(/低于/);
    const cancelled = cancelRepayment(ledger, 'pay1', '录错');
    const revised = reviseStatement(cancelled, 'a', patch, '更正');
    expect(repaymentSummary(revised, revised.statements[0]).outstanding).toBe(99999);
  });
  it('账户稳定关联、改名、停用均不破坏历史，不自动合并重复账单', () => {
    const original = createDemoLedger();
    let ledger = saveCreditAccount(original, { id: 'card', name: '我的信用卡', active: true });
    ledger = linkStatementAccount(ledger, 'a', 'card', '核对原账户');
    expect(ledger.statements[0].accountId).toBe(original.statements[0].accountId);
    ledger = saveCreditAccount(ledger, { id: 'card', name: '新的名称', active: false });
    expect(accountName(ledger, ledger.statements[0])).toBe('新的名称');
    expect(() => linkStatementAccount(ledger, 'b', 'card', '关联')).toThrow(/启用/);
    expect(() => recordStatement(ledger, { id: 'new', creditAccountId: 'card', accountId: '新的名称', fingerprint: 'new', amount: 100, dueOn: '2026-11-01' })).toThrow(/启用/);
    ledger = recordRepayment(ledger, pay());
    expect(repaymentSummary(ledger, ledger.statements[0]).paid).toBe(100000);
    expect(parseSnapshot(serializeSnapshot({ ledger, currentPeriod: 'oct' })).workspace.ledger).toEqual(ledger);
    ledger = saveCreditAccount(ledger, { id: 'card', name: '新的名称', active: true });
    expect(() => recordStatement(ledger, { id: 'duplicate', creditAccountId: 'card', accountId: '新的名称', fingerprint: 'DEMO-2026-10-A', amount: 100, dueOn: '2026-11-01' })).toThrow(/重复/);
  });
  it('拒绝被篡改的还款引用、金额、撤销状态和审计', () => {
    const ledger = cancelRepayment(recordRepayment(createDemoLedger(), pay()), 'pay1', '录错');
    const raw = serializeSnapshot({ ledger, currentPeriod: 'oct' });
    for (const mutate of [
      (l: typeof ledger) => { l.credit!.repayments[0].statementId = 'missing'; },
      (l: typeof ledger) => { l.credit!.repayments[0].status = 'recorded'; },
      (l: typeof ledger) => { l.credit!.repayments[0].cancellationReason = '篡改'; },
      (l: typeof ledger) => { l.audit.pop(); },
    ]) {
      const snapshot = JSON.parse(raw); mutate(snapshot.workspace.ledger);
      expect(() => parseSnapshot(JSON.stringify(snapshot))).toThrow();
    }
    const active = JSON.parse(serializeSnapshot({ ledger: recordRepayment(createDemoLedger(), pay()), currentPeriod: 'oct' }));
    active.workspace.ledger.credit.repayments[0].amount = 260001;
    expect(() => parseSnapshot(JSON.stringify(active))).toThrow(/超过/);
  });
});
