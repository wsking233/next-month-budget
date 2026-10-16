import { Button, Form, Host, Section, Text, TextField } from '@expo/ui/swift-ui';
import { buttonStyle } from '@expo/ui/swift-ui/modifiers';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import { useBudget } from '@/state/BudgetContext';

export default function NewPoolScreen() {
  const router = useRouter();
  const { createPool } = useBudget();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();

  function submit() {
    const result = createPool(name);
    if (result.ok) router.back();
    else setError(result.error);
  }

  return (
    <>
      <Stack.Screen options={{ title: '新建资金池' }} />
      <Host style={{ flex: 1 }} useViewportSizeMeasurement>
        <Form>
          <Section title="基本信息" footer={<Text>创建资金池不会自动拨入预算。</Text>}>
            <TextField placeholder="资金池名称" onTextChange={setName} />
          </Section>
          <Section>
            <Button label="创建资金池" systemImage="plus" onPress={submit} modifiers={[buttonStyle('borderedProminent')]} />
          </Section>
          {error ? <Section title="无法创建"><Text>{error}</Text></Section> : null}
        </Form>
      </Host>
    </>
  );
}
