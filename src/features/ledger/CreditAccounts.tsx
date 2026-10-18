import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { saveCreditAccount, type CreditAccount } from '@/domain/credit';
import { useLedger } from './context';
import { Empty, Field, Input, Modal, Panel } from './ui';
export function CreditAccounts() {
  const { ledger } = useLedger();
  const [editing, setEditing] = useState<CreditAccount | 'new' | null>(null);
  return <Panel title="信用卡账户" action={<Button onClick={() => setEditing('new')}>创建信用卡账户</Button>}><p className="mb-4 text-sm leading-7 text-muted-foreground">仅保存本地账户名称，不填卡号，不连接银行。账单日和还款日逐单填写；停用后不能关联新账单，已有账单仍可还款。旧账单按原名称保留，请在账单中逐张核对关联，不自动合并。</p>{ledger.credit?.accounts.length ? <div className="grid gap-3 sm:grid-cols-2">{ledger.credit.accounts.map(a => <article key={a.id} className="min-w-0 rounded-xl border border-border p-4"><h3 className="break-words font-medium">{a.name}</h3><p className="my-3 text-sm">{a.active ? '已启用' : '已停用'}</p><Button variant="outline" onClick={() => setEditing(a)}>编辑账户</Button></article>)}</div> : <Empty title="尚未建立信用卡账户">可先创建账户，再关联已有账单；旧账单仍可独立登记还款。</Empty>}{editing && <AccountForm account={editing === 'new' ? undefined : editing} close={() => setEditing(null)} />}</Panel>;
}
function AccountForm({ account, close }: { account?: CreditAccount; close: () => void }) {
  const { execute } = useLedger();
  const [error, setError] = useState('');
  const [id] = useState(() => account?.id ?? crypto.randomUUID());
  return <Modal title={account ? '编辑信用卡账户' : '创建信用卡账户'} close={close}><form className="grid gap-5" onSubmit={e => {
    e.preventDefault(); const data = new FormData(e.currentTarget);
    const failure = execute(l => saveCreditAccount(l, { id, name: String(data.get('name') ?? ''), active: data.has('active') }));
    if (failure) setError(failure); else close();
  }}><Field label="信用卡账户名称"><Input name="name" required maxLength={40} defaultValue={account?.name} /></Field><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="active" defaultChecked={account?.active ?? true} className="size-5" />启用信用卡账户</label><p className="text-sm leading-7 text-muted-foreground">改名保留稳定关联，历史账单原名称及审计不覆盖。停用不会删除账单或还款记录。</p>{error && <p role="alert">{error}</p>}<Button type="submit">保存信用卡账户</Button></form></Modal>;
}
