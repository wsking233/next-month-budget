import { describe, expect, it } from 'vitest';
import { emptyDemo, parseMoney, poolBalance, sampleDemo } from './model';

describe('隔离演示模型', () => {
  it('默认空白；每次加载样例都是独立状态', () => {
    expect(emptyDemo().pools).toEqual([]);
    const sample = sampleDemo();
    sample.pools[0].name = 'changed';
    expect(sampleDemo().pools[0].name).toBe('日常生活');
  });
  it.each([['0.01', 1], ['599.99', 59999], ['2000.01', 200001], ['0', 0], ['100000000', 10000000000]])('精确解析元为分 %s', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });
  it.each(['1.001', '-1', 'NaN', '1e3', '', '9007199254740993', '100000000.01'])('拒绝无效和过大金额 %s', input => {
    expect(parseMoney(input)).toBeNull();
  });
  it('预览预算包含负数结转、拨款和已确认拆分，未确认不扣减', () => {
    const state = sampleDemo();
    expect(poolBalance(state, 'digital')).toBe(0);
    state.statements[0].allocations = [{ poolId: 'digital', periodId: 'oct', amount: 260000 }];
    expect(poolBalance(state, 'digital')).toBe(0);
    state.statements[0].settled = true;
    expect(poolBalance(state, 'digital')).toBe(-260000);
  });
});
