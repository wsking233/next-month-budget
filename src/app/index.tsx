import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>NEXT MONTH · 开发预览</Text>
        <Text style={styles.title}>想花就花，{'\n'}有数就行。</Text>
        <Text style={styles.description}>先安排每期预算，再从容面对下一张账单。</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>从这里开始</Text>
          <Text style={styles.body}>项目框架已就绪。后续将逐步加入资金池、账单结算与预算记录。</Text>
          <Text style={styles.note}>当前没有账户或财务数据，预算功能尚未实现。</Text>
        </View>
        <Link href="/about" style={styles.link}>查看项目说明 →</Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, backgroundColor: '#F5F6F1', padding: 24 },
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingVertical: 48, gap: 24 },
  eyebrow: { color: '#536C5B', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  title: { color: '#183A2D', fontSize: 42, lineHeight: 56, fontWeight: '700' },
  description: { color: '#58665E', fontSize: 17, lineHeight: 28 },
  card: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 20, gap: 14 },
  cardTitle: { color: '#183A2D', fontSize: 21, fontWeight: '600' },
  body: { color: '#435449', fontSize: 16, lineHeight: 27 },
  note: { color: '#6E776F', fontSize: 13, lineHeight: 22 },
  link: { color: '#236B49', fontSize: 16, paddingVertical: 12 },
});
