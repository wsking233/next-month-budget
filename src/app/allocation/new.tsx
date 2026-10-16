import { Button, Form, Host, Picker, Section, Text, TextField } from '@expo/ui/swift-ui';
import { buttonStyle, keyboardType, tag } from '@expo/ui/swift-ui/modifiers';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { parseYuan, useBudget } from '@/state/BudgetContext';

export default function NewAllocationScreen() {
  const router = useRouter();
  const { ledger, latestPeriod, allocateBudget } = useBudget();
  const [periodId, setPeriodId] = useState(latestPeriod?.id ?? '');
  const [poolId, setPoolId] = useState(ledger.pools[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string>();

  function submit() {
    const cents = parseYuan(amount);
    if (!cents) return setError('请输入大于零且最多两位小数的金额');
    const result = allocateBudget({ periodId, poolId, amount: cents });
    if (result.ok) router.back();
    else setError(result.error);
  }

  return (
    <>
      <Stack.Screen options={{ title: '预算拨款' }} />
      <Host style={{ flex: 1 }} useViewportSizeMeasurement>
        <Form>
          <Section title="拨款去向">
            <Picker label="预算周期" selection={periodId} onSelectionChange={(value) => setPeriodId(String(value))}>
              {ledger.periods.map((period) => <Text key={period.id} modifiers={[tag(period.id)]}>{period.startsOn} — {period.endsOn}</Text>)}
            </Picker>
            <Picker label="资金池" selection={poolId} onSelectionChange={(value) => setPoolId(String(value))}>
              {ledger.pools.map((pool) => <Text key={pool.id} modifiers={[tag(pool.id)]}>{pool.name}</Text>)}
            </Picker>
            <TextField placeholder="金额（元）" onTextChange={setAmount} modifiers={[keyboardType('decimal-pad')]} />
          </Section>
          <Section footer={<Text>拨款只增加所选资金池预算，不代表银行转账。</Text>}>
            <Button label="确认拨款" systemImage="arrow.down.circle" onPress={submit} modifiers={[buttonStyle('borderedProminent')]} />
          </Section>
          {error ? <Section title="无法拨款"><Text>{error}</Text></Section> : null}
        </Form>
      </Host>
    </>
  );
}
