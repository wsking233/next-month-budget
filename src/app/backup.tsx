import { NativeScreen } from '@/ui/NativeScreen';

export default function BackupScreen() {
  return (
    <NativeScreen
      title="备份与恢复"
      description="首版坚持本地优先，备份能力会在存储模型稳定后接入。"
      sections={[
        {
          title: '导出备份',
          description: '生成带格式版本与完整性信息的本地数据副本。',
          status: '尚未启用',
        },
        {
          title: '恢复备份',
          description: '恢复前会先校验文件，并明确说明对现有数据的影响。',
          status: '尚未启用',
        },
      ]}
    />
  );
}
