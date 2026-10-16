import { StyleSheet, Text, View } from 'react-native';

export default function AboutScreen() {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>下月再说</Text>
      <Text style={styles.body}>一款离线优先的个人预算资金池工具，关注每期预算和多张信用卡账单的分类结算。</Text>
      <Text style={styles.body}>当前为框架初始化阶段。发薪周期、默认归属、退款及更正规则仍需验证，暂不进行预算计算或存储个人数据。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F6F1', padding: 28, gap: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#183A2D' },
  body: { maxWidth: 640, fontSize: 16, lineHeight: 28, color: '#435449' },
});
