import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/session';
import { useBusiness } from '../app/context';
import { Badge, Empty, ErrorNote, PageTitle } from '../design/ui';
type Request = { id:string;productId:string;senderId:string;receiverId:string;senderName:string;receiverName:string;status:string;requestedAt:string;dispatchRecorded:boolean;canApprove:boolean;operationId:string };
export default function Handovers() {
  const { workspace,notify }=useBusiness();
  const navigate=useNavigate();
  const client=useQueryClient();
  const [busy,setBusy]=useState(''); const [error,setError]=useState('');
  const query=useQuery({queryKey:['handovers',workspace?.accountId],queryFn:()=>api<Request[]>('/api/enterprise/handovers'),refetchInterval:10000});
  async function decide(id:string,decision:string) {
    if(busy) return;setBusy(id);setError('');
    try {await api(`/api/enterprise/handovers/${id}/decision`,{method:'POST',body:JSON.stringify({decision})});notify(decision==='approve' ? 'Receiver approved' : 'Request closed');await client.invalidateQueries();}
    catch(e){setError((e as Error).message);}finally{setBusy('');}
  }
  return <main className="page"><PageTitle back title="Handovers" subtitle="Approve the business receiving your stock"/><ErrorNote>{error || query.error?.message}</ErrorNote>
    <p className="support">A product QR identifies the item. Only the current custodian can authorize its receiver.</p>
    {query.isPending ? <p role="status">Loading requests…</p> : !query.data?.length ? <Empty title="No handover requests">Requests from receiving businesses will appear here.</Empty> : query.data.map(h=><article className="surface handover-card" key={h.id}>
      <Badge tone={h.status==='received' ? 'blue' : 'amber'}>{h.status.replaceAll('_',' ')}</Badge><h2>{h.senderName} → {h.receiverName}</h2><p className="serial">{h.productId}</p>
      {!h.dispatchRecorded && <p className="support">Dispatch was not recorded. Approval will preserve this exception.</p>}
      <button className="text-button" onClick={()=>navigate(`/products/${h.productId}`)}>View product</button>
      {h.canApprove && h.status==='requested' && <div className="operation-actions"><button className="primary" disabled={!!busy} onClick={()=>void decide(h.id,'approve')}>Approve {h.receiverName}</button><button className="secondary" disabled={!!busy} onClick={()=>void decide(h.id,'reject')}>Decline</button></div>}
      {h.canApprove && h.status==='approved' && <button className="secondary" disabled={!!busy} onClick={()=>void decide(h.id,'cancel')}>Cancel before signing</button>}
      {!h.canApprove && <button className="text-button" onClick={()=>navigate(`/operations/${h.operationId}`)}>View receipt progress</button>}
    </article>)}
  </main>;
}
