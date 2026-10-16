import { Button, Host, List, Section, Text, VStack } from '@expo/ui/swift-ui';
import type { ComponentProps } from 'react';
import {
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  listStyle,
} from '@expo/ui/swift-ui/modifiers';

export type NativeSection = {
  title: string;
  description: string;
  value?: string;
  status?: string;
};

export type NativeAction = {
  label: string;
  systemImage?: ComponentProps<typeof Button>['systemImage'];
  disabled?: boolean;
  onPress(): void;
};

type Props = {
  title: string;
  description?: string;
  sections: NativeSection[];
  actions?: NativeAction[];
  error?: string;
};

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

export function NativeScreen({ title, description, sections, actions, error }: Props) {
  return (
    <Host style={{ flex: 1 }} useViewportSizeMeasurement>
      <List modifiers={[listStyle('insetGrouped')]}>
          <Section>
            <VStack alignment="leading" spacing={6}>
              <Text modifiers={[font({ textStyle: 'largeTitle', weight: 'bold' })]}>{title}</Text>
              {description ? (
                <Text modifiers={[font({ textStyle: 'subheadline' }), secondary]}>{description}</Text>
              ) : null}
            </VStack>
          </Section>
          {sections.map((section) => (
            <Section key={section.title} title={section.title}>
              <VStack alignment="leading" spacing={6}>
                {section.value ? (
                  <Text modifiers={[font({ textStyle: 'title2', weight: 'semibold' })]}>
                    {section.value}
                  </Text>
                ) : null}
                <Text modifiers={[font({ textStyle: 'body' })]}>{section.description}</Text>
                {section.status ? (
                  <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{section.status}</Text>
                ) : null}
              </VStack>
            </Section>
          ))}
          {actions?.length ? (
            <Section title="操作">
              {actions.map((action) => (
                <Button
                  key={action.label}
                  label={action.label}
                  systemImage={action.systemImage}
                  onPress={action.onPress}
                  modifiers={[buttonStyle('plain'), disabled(action.disabled ?? false)]}
                />
              ))}
            </Section>
          ) : null}
          {error ? (
            <Section title="操作未完成">
              <Text>{error}</Text>
            </Section>
          ) : null}
      </List>
    </Host>
  );
}
