import { Host, List, Section, Text, VStack } from '@expo/ui/swift-ui';
import {
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

type Props = {
  title: string;
  description?: string;
  sections: NativeSection[];
};

const secondary = foregroundStyle({ type: 'hierarchical', style: 'secondary' });

export function NativeScreen({ title, description, sections }: Props) {
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
      </List>
    </Host>
  );
}
