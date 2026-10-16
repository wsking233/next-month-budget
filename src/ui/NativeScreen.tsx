import { Button, Host, HStack, Image, List, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import type { ComponentProps } from 'react';
import {
  buttonStyle,
  contentShape,
  disabled,
  font,
  frame,
  foregroundStyle,
  listStyle,
  padding,
  shapes,
} from '@expo/ui/swift-ui/modifiers';

export type NativeSection = {
  title: string;
  description: string;
  value?: string;
  status?: string;
  systemImage?: ComponentProps<typeof Image>['systemName'];
  onPress?: () => void;
};

export type NativeAction = {
  label: string;
  systemImage?: ComponentProps<typeof Button>['systemImage'];
  disabled?: boolean;
  prominent?: boolean;
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

function SectionContent({ section }: { section: NativeSection }) {
  return (
    <HStack alignment="center" spacing={12} modifiers={[frame({ maxWidth: Infinity, minHeight: 48, alignment: 'leading' }), contentShape(shapes.rectangle())]}>
      {section.systemImage ? <Image systemName={section.systemImage} size={24} color="#3478F6" /> : null}
      <VStack alignment="leading" spacing={5}>
        {section.value ? <Text modifiers={[font({ textStyle: 'title2', weight: 'semibold' })]}>{section.value}</Text> : null}
        <Text modifiers={[font({ textStyle: 'body' })]}>{section.description}</Text>
        {section.status ? <Text modifiers={[font({ textStyle: 'caption' }), secondary]}>{section.status}</Text> : null}
      </VStack>
      <Spacer />
      {section.onPress ? <Image systemName="chevron.right" size={13} color="#8E8E93" /> : null}
    </HStack>
  );
}

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
              {section.onPress ? (
                <Button
                  onPress={section.onPress}
                  modifiers={[buttonStyle('plain'), frame({ maxWidth: Infinity, minHeight: 48, alignment: 'leading' }), contentShape(shapes.rectangle())]}
                >
                  <SectionContent section={section} />
                </Button>
              ) : <SectionContent section={section} />}
            </Section>
          ))}
          {actions?.length ? (
            <Section title="操作">
              {actions.map((action) => (
                <Button
                  key={action.label}
                  onPress={action.onPress}
                  modifiers={[
                    buttonStyle(action.prominent ? 'borderedProminent' : 'plain'),
                    frame({ maxWidth: Infinity, minHeight: 48, alignment: 'leading' }),
                    contentShape(shapes.rectangle()),
                    padding({ vertical: 4 }),
                    disabled(action.disabled ?? false),
                  ]}
                >
                  <HStack spacing={10} modifiers={[frame({ maxWidth: Infinity, alignment: action.prominent ? 'center' : 'leading' })]}>
                    {action.systemImage ? <Image systemName={action.systemImage} size={19} /> : null}
                    <Text modifiers={[font({ textStyle: 'body', weight: action.prominent ? 'semibold' : 'regular' })]}>{action.label}</Text>
                    {!action.prominent ? <Spacer /> : null}
                    {!action.prominent ? <Image systemName="chevron.right" size={13} color="#8E8E93" /> : null}
                  </HStack>
                </Button>
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
