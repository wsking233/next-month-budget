import { Button, DatePicker, Form, Host, Section, Text } from '@expo/ui/swift-ui';
import { buttonStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { toIsoDate, useBudget } from '@/state/BudgetContext';

const initialStart = new Date();
const initialEnd = new Date(initialStart.getFullYear(), initialStart.getMonth() + 1, initialStart.getDate() - 1);

export default function NewPeriodScreen() {
  const router = useRouter();
  const { createPeriod } = useBudget();
  const [startsOn, setStartsOn] = useState(initialStart);
  const [endsOn, setEndsOn] = useState(initialEnd);
  const [error, setError] = useState<string>();

  function submit() {
    const result = createPeriod({ startsOn: toIsoDate(startsOn), endsOn: toIsoDate(endsOn) });
    if (result.ok) router.back();
    else setError(result.error);
  }

  return (
    <>
      <Stack.Screen options={{ title: '新建预算周期' }} />
      <Host style={{ flex: 1 }} useViewportSizeMeasurement>
        <Form>
          <Section title="周期日期">
            <DatePicker title="开始日期" selection={startsOn} onDateChange={setStartsOn} />
            <DatePicker title="结束日期" selection={endsOn} onDateChange={setEndsOn} />
          </Section>
          <Section footer={<Text>周期彼此不能重叠；创建周期不会自动生成拨款。</Text>}>
            <Button label="创建周期" systemImage="checkmark" onPress={submit} modifiers={[buttonStyle('borderedProminent')]} />
          </Section>
          {error ? <Section title="无法创建"><Text>{error}</Text></Section> : null}
        </Form>
      </Host>
    </>
  );
}
