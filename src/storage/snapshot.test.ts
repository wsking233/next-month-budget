import { describe, expect, it } from 'vitest';
import { createDemoLedger } from '@/fixtures/demo-ledger';
import { cancelSettlement, correctSettlement, reviseStatement, settleStatement, transferBudget } from '@/domain/budget';
import { parseSnapshot, serializeSnapshot, MAX_BACKUP_BYTES, type Workspace } from './snapshot';
const fixture = (): Workspace => ({ ledger: createDemoLedger(), currentPeriod: 'oct' });
describe('快照与账务一致性', () => {
  it('完整保留多次更正撤销与重新结算的流水、审计及负余额', () => {
    const workspace = fixture();
    let ledger = settleStatement(workspace.ledger, 'a', [{ id: 'x', poolId: 'digital', periodId: 'oct', amount: 260000 }]);
    ledger = correctSettlement(ledger, 'a', [{ id: 'x', poolId: 'travel', periodId: 'nov', amount: 260000 }], '更正');
    ledger = cancelSettlement(ledger, 'a', '撤销');
    ledger = reviseStatement(ledger, 'a', { accountId: '演示信用卡 A', fingerprint: 'DEMO-2026-10-A', amount: 270000, dueOn: '2026-10-25' }, '修改总额');
    ledger = settleStatement(ledger, 'a', [{ id: 'x', poolId: 'digital', periodId: 'oct', amount: 270000 }]);
    ledger = transferBudget(ledger, { id: 't', periodId: 'oct', fromPoolId: 'daily', toPoolId: 'digital', amount: 10000, reason: '补充' });
    const next = { ...workspace, ledger };
    const raw = serializeSnapshot(next, true);
    expect(parseSnapshot(raw).workspace).toEqual(next);
    expect(parseSnapshot(raw).exportedAt).toBeTruthy();
  });
  it.each([
    ['非整数金额', (w: Workspace) => { w.ledger.entries[0].amount = 0.1; }],
    ['重复主键', (w: Workspace) => { w.ledger.pools.push({ ...w.ledger.pools[0] }); }],
    ['无效引用', (w: Workspace) => { w.ledger.entries[0].poolId = 'missing'; }],
    ['丢失审计', (w: Workspace) => { w.ledger.audit.pop(); }],
    ['周期重叠', (w: Workspace) => { w.ledger.periods[1].startsOn = '2026-10-11'; }],
    ['错误日期', (w: Workspace) => { w.ledger.statements[0].dueOn = '2026-02-30'; }],
    ['失效选择', (w: Workspace) => { w.currentPeriod = 'missing'; }],
    ['重复账单', (w: Workspace) => { w.ledger.statements[1].accountId = w.ledger.statements[0].accountId; w.ledger.statements[1].fingerprint = w.ledger.statements[0].fingerprint; }],
  ])('拒绝%s', (_, mutate) => {
    const snapshot = JSON.parse(serializeSnapshot(fixture()));
    mutate(snapshot.workspace);
    expect(() => parseSnapshot(JSON.stringify(snapshot))).toThrow();
  });
  it('拒绝分配总额、净结算、冲销和调拨损坏', () => {
    const workspace = fixture();
    workspace.ledger = settleStatement(workspace.ledger, 'a', [{ id: 'x', poolId: 'digital', periodId: 'oct', amount: 260000 }]);
    const wrong = JSON.parse(serializeSnapshot(workspace));
    wrong.workspace.ledger.statements[0].allocations[0].amount--;
    expect(() => parseSnapshot(JSON.stringify(wrong))).toThrow(/分配/);
    const unbalanced = JSON.parse(serializeSnapshot(workspace));
    unbalanced.workspace.ledger.entries.at(-1).amount++;
    expect(() => parseSnapshot(JSON.stringify(unbalanced))).toThrow(/流水/);
    workspace.ledger = transferBudget(workspace.ledger, { id: 't', periodId: 'oct', fromPoolId: 'daily', toPoolId: 'digital', amount: 1, reason: '测试' });
    const half = JSON.parse(serializeSnapshot(workspace));
    half.workspace.ledger.entries.pop();
    expect(() => parseSnapshot(JSON.stringify(half))).toThrow(/调拨/);
  });
  it('拒绝损坏 JSON、未知版本、未知字段和超大文件，不回显财务数据', () => {
    expect(() => parseSnapshot('{secret-value')).toThrow(/JSON/);
    const snapshot = JSON.parse(serializeSnapshot(fixture()));
    snapshot.schemaVersion = 2;
    expect(() => parseSnapshot(JSON.stringify(snapshot))).toThrow(/版本不兼容/);
    snapshot.schemaVersion = 1;
    snapshot.extra = 'sensitive';
    expect(() => parseSnapshot(JSON.stringify(snapshot))).toThrow(/格式/);
    expect(() => parseSnapshot(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow(/2 MB/);
  });
});

it('检查已撤销分配与历史冲销，不能伪造当前无效分配或额外历史', () => {
  const workspace = fixture();
  workspace.ledger = settleStatement(workspace.ledger, 'a', [{ id: 'x', poolId: 'digital', periodId: 'oct', amount: 260000 }]);
  workspace.ledger = cancelSettlement(workspace.ledger, 'a', '撤销');
  const cancelled = JSON.parse(serializeSnapshot(workspace));
  cancelled.workspace.ledger.statements[0].allocations[0].poolId = 'travel';
  expect(() => parseSnapshot(JSON.stringify(cancelled))).toThrow(/原分配/);
  const forged = JSON.parse(serializeSnapshot(workspace));
  forged.workspace.ledger.entries.push(
    { id: 'fake-1', poolId: 'digital', periodId: 'oct', amount: -1, kind: 'statement_settlement', sourceId: 'a' },
    { id: 'fake-2', poolId: 'digital', periodId: 'oct', amount: 1, kind: 'reversal', sourceId: 'a' },
  );
  expect(() => parseSnapshot(JSON.stringify(forged))).toThrow(/审计/);
});
