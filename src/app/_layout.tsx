import { Stack } from 'expo-router';

import { BudgetProvider } from '@/state/BudgetContext';

export default function RootLayout() {
  return (
    <BudgetProvider>
      <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: '偏好设置' }} />
      <Stack.Screen name="backup" options={{ title: '备份与恢复' }} />
      <Stack.Screen name="about" options={{ title: '关于下月再说' }} />
      </Stack>
    </BudgetProvider>
  );
}
