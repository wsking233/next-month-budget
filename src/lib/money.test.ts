import { describe, expect, it } from 'vitest';
import { parseMoney, money, sumCents } from './money';
describe('金额输入', () => {
  it.each([['0.01', 1], ['599.99', 59999], ['2000.01', 200001], ['0', 0], ['100000000', 10000000000]])('精确解析元为分 %s', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });
  it.each(['1.001', '-1', 'NaN', '1e3', '', '9007199254740993', '100000000.01'])('拒绝无效和过大金额 %s', input => {
    expect(parseMoney(input)).toBeNull();
  });
});

describe('整数分展示与汇总', () => {
  it('极大数额和负数不经过浮点除法，保留每一分', () => {
    expect(money(1)).toBe('¥0.01');
    expect(money(-1)).toBe('-¥0.01');
    expect(money(Number.MAX_SAFE_INTEGER)).toBe('¥90,071,992,547,409.91');
    expect(sumCents([Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER])).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 1])).toThrow();
  });
});
