import { Button, DatePicker, Form, Host, Picker, Section, Text, TextField } from '@expo/ui/swift-ui';
import { buttonStyle, disabled, keyboardType, tag } from '@expo/ui/swift-ui/modifiers';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';

import { formatCents, parseYuan, toIsoDate, useBudget } from '@/state/BudgetContext';

export default function NewStatementScreen() {
  const router = useRouter();
  const { ledger, latestPeriod, createAndSettleStatement } = useBudget();
  const [accountId, setAccountId] = useState('');
  const [statementKey, setStatementKey] = useState('');
  const [total, setTotal] = useState('');
  const [dueOn, setDueOn] = useState(new Date());
  const [periodId, setPeriodId] = useState(latestPeriod?.id ?? '');
  const [poolAmounts, setPoolAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const totalCents = parseYuan(total) ?? 0;
  const allocatedCents = useMemo(() => ledger.pools.reduce((sum, pool) => sum + (parseYuan(poolAmounts[pool.id] ?? '') ?? 0), 0), [ledger.pools, poolAmounts]);
  const difference = totalCents - allocatedCents;

  function submit() {
    if (!accountId.trim()) return setError('请输入信用卡或账户昵称');
    if (!statementKey.trim()) return setError('请输入账单标识，用于防止重复结算');
    if (!totalCents) return setError('请输入有效账单总额');
    if (difference !== 0) return setError('资金池分配合计必须与账单总额一致');
    const allocations = ledger.pools.flatMap((pool) => {
      const amount = parseYuan(poolAmounts[pool.id] ?? '');
      return amount ? [{ poolId: pool.id, periodId, amount }] : [];
    });
    const result = createAndSettleStatement({ accountId, statementKey, amount: totalCents, dueOn: toIsoDate(dueOn), allocations });
    if (result.ok) router.back();
    else setError(result.error);
  }

  return (
    <>
      <Stack.Screen options={{ title: '新建账单结算' }} />
      <Host style={{ flex: 1 }} useViewportSizeMeasurement>
        <Form>
          <Section title="账单信息">
            <TextField placeholder="信用卡或账户昵称" onTextChange={setAccountId} />
            <TextField placeholder="账单标识（例如 2027-01）" onTextChange={setStatementKey} />
            <TextField placeholder="账单总额（元）" onTextChange={setTotal} modifiers={[keyboardType('decimal-pad')]} />
            <DatePicker title="还款到期日" selection={dueOn} onDateChange={setDueOn} />
            <Picker label="预算归属周期" selection={periodId} onSelectionChange={(value) => setPeriodId(String(value))}>
              {ledger.periods.map((period) => <Text key={period.id} modifiers={[tag(period.id)]}>{period.startsOn} — {period.endsOn}</Text>)}
            </Picker>
          </Section>
          <Section title="资金池分配" footer={<Text>空白资金池不会参与本次结算。</Text>}>
            {ledger.pools.map((pool) => (
              <TextField
                key={pool.id}
                placeholder={`${pool.name}（元）`}
                onTextChange={(value) => setPoolAmounts((current) => ({ ...current, [pool.id]: value }))}
                modifiers={[keyboardType('decimal-pad')]}
              />
            ))}
          </Section>
          <Section title="提交前核对">
            <Text>账单总额：{formatCents(totalCents)}</Text>
            <Text>已分配：{formatCents(allocatedCents)}</Text>
            <Text>差额：{formatCents(difference)}</Text>
          </Section>
          <Section footer={<Text>提交后会生成预算扣减与审计记录；这不代表信用卡已经实际还款。</Text>}>
            <Button
              label="确认登记并结算"
              systemImage="checkmark.circle"
              onPress={submit}
              modifiers={[buttonStyle('borderedProminent'), disabled(difference !== 0 || totalCents === 0)]}
            />
          </Section>
          {error ? <Section title="无法结算"><Text>{error}</Text></Section> : null}
        </Form>
      </Host>
    </>
  );
}
