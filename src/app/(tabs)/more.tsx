import { Button, Host, List, Section, Text } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  font,
  listStyle,
} from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';

export default function MoreScreen() {
  const router = useRouter();

  return (
    <Host style={{ flex: 1 }} useViewportSizeMeasurement>
      <List modifiers={[listStyle('insetGrouped')]}>
          <Section>
            <Text modifiers={[font({ textStyle: 'largeTitle', weight: 'bold' })]}>更多</Text>
          </Section>
          <Section>
            <Button
              label="偏好设置"
              systemImage="gearshape"
              onPress={() => router.push('/settings')}
              modifiers={[buttonStyle('plain')]}
            />
            <Button
              label="备份与恢复"
              systemImage="externaldrive"
              onPress={() => router.push('/backup')}
              modifiers={[buttonStyle('plain')]}
            />
            <Button
              label="关于下月再说"
              systemImage="info.circle"
              onPress={() => router.push('/about')}
              modifiers={[buttonStyle('plain')]}
            />
          </Section>
      </List>
    </Host>
  );
}
