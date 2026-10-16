import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTitle: '下月再说', headerShadowVisible: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="about" options={{ title: '项目说明' }} />
      </Stack>
    </>
  );
}
