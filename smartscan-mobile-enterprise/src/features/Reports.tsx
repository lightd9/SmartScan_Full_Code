import { useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { api } from '../services/session';
import { useBusiness } from '../app/context';
import { Badge,Empty,ErrorNote,PageTitle } from '../design/ui';
type Report={id:string;productId:string;reason:string;details:string;status:string;version:number};
export default function Reports(){
  const {workspace,notify}=useBusiness();const client=useQueryClient();const [selected,setSelected]=useState('');const [note,setNote]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const query=useQuery({queryKey:['consumer-reports',workspace?.accountId],queryFn:()=>api<Report[]>('/api/enterprise/reports'),enabled:workspace?.role==='admin'});
  if(workspace?.role!=='admin')return <main className="page"><Empty title="Administrator access required">Reports are available to authorized reviewers.</Empty></main>;
  async function review(r:Report,status:string){if(busy)return;setBusy(true);setError('');try{await api(`/api/enterprise/reports/${r.id}/review`,{method:'POST',body:JSON.stringify({status,note,expectedVersion:r.version})});setSelected('');setNote('');notify('Review saved');await client.invalidateQueries({queryKey:['consumer-reports']});}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <main className="page"><PageTitle back title="Consumer reports" subtitle="Review concerns and record an outcome"/><ErrorNote>{error || query.error?.message}</ErrorNote><p className="support">Reports are unverified claims. Reviewing a report does not automatically change an authenticity result.</p>
    {query.data?.map(r=><article className="surface handover-card" key={r.id}><Badge>{r.status}</Badge><h2>{r.reason}</h2><p className="serial">{r.productId}</p><p>{r.details || 'No additional details'}</p><small>Case {r.id}</small><button className="text-button" onClick={()=>{setSelected(r.id);setNote('');}}>Review case</button>{selected===r.id && <div className="form"><label htmlFor={`note-${r.id}`}>Review note</label><textarea id={`note-${r.id}`} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} disabled={busy}/><div className="operation-actions">{['investigating','resolved','dismissed'].map(status=><button className="secondary" key={status} disabled={busy || !note.trim()} onClick={()=>void review(r,status)}>{status}</button>)}</div></div>}</article>)}
    {query.data?.length===0 && <Empty title="No reports submitted">New consumer reports will appear here.</Empty>}
  </main>;
}
