import type { AuditEvent } from '@/domain/budget';
export const auditLabels: Record<AuditEvent['kind'], string> = {
  period_created: '创建周期', pool_created: '创建资金池', pool_updated: '维护资金池',
  income_allocated: '拨款', statement_recorded: '登记账单', statement_settled: '结算',
  budget_transferred: '调拨', settlement_cancelled: '撤销结算', settlement_corrected: '更正分配', statement_revised: '修改账单',
};
export const statementLabels = { recorded: '待分配', settled: '已结算', cancelled: '已撤销' };
