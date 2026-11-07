import React, { useRef, useState } from 'react';
import { ArrowRight, Check, Download, Flag, ScanLine } from 'lucide-react';
import { getScanHistory, getSavedReports, saveReport } from '../utils/storage';
import { ProductRow } from './ProductCard';
import Sheet from './Sheet';

export function downloadReport(report) {
  const text = ['SmartScan product report', report.id, '', 'Product: ' + report.productName, 'Serial: ' + report.productSerial, 'Reason: ' + report.reason, 'Details: ' + (report.details || 'None added'), 'Saved: ' + report.timestamp, '', report.caseId ? 'Submitted to SmartScan. Case: '+report.caseId : 'Unsubmitted draft saved on this device.'].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url; link.download = report.id + '.txt'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
import { API_BASE_URL } from '../config/constants';
const reasons = ['Suspected counterfeit', 'Broken or tampered seal', 'Duplicate serial number', 'Unauthorized retailer', 'Other concern'];
export default function ReportTab({ initialProduct, onOpenScanner }) {
  const [selected, updateSelected] = useState(initialProduct || null);
  const [reason, setReason] = useState(reasons[0]);
  const [details, setDetails] = useState('');
  const requestId=useRef(crypto.randomUUID());
  function setSelected(product) {
    if (product) {
      requestId.current = crypto.randomUUID();
      setReason(reasons[0]);
      setDetails('');
    }
    updateSelected(product);
  }
  const [busy,setBusy]=useState(false);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('products');
  const history = getScanHistory();
  const reports = getSavedReports();
  return <section className="standard-screen">
    <header className="page-header"><h1>Report</h1><span className="circle-button raised decorative"><Flag size={21} /></span></header>
    <div className="intro-card"><span className="status-badge authentic">A little care goes a long way</span><h2>Something<br />doesn’t look right?</h2><p>Choose a scanned product and tell us what you noticed.</p></div>
    <div className="section-title-row"><h2>{view === 'products' ? 'Your scanned products' : 'Saved reports'}</h2><button className="text-button" onClick={() => setView(view === 'products' ? 'reports' : 'products')}>{view === 'products' ? 'Saved reports' : 'Products'}</button></div>
    {view === 'products' ? history.length ? <div className="product-list">{history.map(product => <ProductRow key={product.serialNumber} product={product} onClick={() => { setSelected(product); setError(''); }} />)}</div> : <div className="empty-state"><ScanLine size={30} /><h3>No scans yet</h3><p>Scan a product first to report a concern.</p><button className="dark-button" onClick={onOpenScanner}>Scan a product<ArrowRight size={18} /></button></div> : reports.length ? <div className="saved-report-list">{reports.map(report => <button className="saved-report" key={report.id} onClick={() => {if(report.caseId)downloadReport(report);else {setSelected({serialNumber:report.productSerial,name:report.productName});setReason(report.reason);setDetails(report.details || "");requestId.current=report.requestId || crypto.randomUUID();setError("");}}}><span className="circle-button"><Flag size={20} /></span><span><strong>{report.productName}</strong><small>{report.reason}</small><small>{report.caseId ? 'Submitted: '+report.caseId : 'Unsubmitted draft'}</small></span><Download size={18} /></button>)}</div> : <p className="supporting-copy">You haven’t saved any reports yet.</p>}
    {selected && <Sheet title="Report a concern" onClose={() => setSelected(null)}><p className="selected-product-name">{selected.name || 'Unregistered product'}</p>
      <form className="sheet-form" onSubmit={async event => {
        event.preventDefault();if(busy)return;setBusy(true);setError('');
        const draft={productSerial:selected.serialNumber,productName:selected.name || 'Unregistered product',reason,details:details.trim(),requestId:requestId.current};
        try {
          const response=await fetch(API_BASE_URL+'/v1/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:requestId.current,serialNumber:draft.productSerial,reason,details:draft.details}),signal:AbortSignal.timeout(15000)});
          const result=await response.json();if(!response.ok)throw new Error(result.error || 'Submission failed');
          const report={...draft,...result,timestamp:result.submittedAt,id:result.caseId};
          try {saveReport(report);}catch{/* Server receipt remains visible if local storage is full. */}
          setSaved(report);setSelected(null);setDetails('');requestId.current=crypto.randomUUID();
        }catch(e){setError('Report not confirmed as submitted. Your details remain here; retry to check the same request. '+e.message);}
        finally{setBusy(false);}
      }}>
        <fieldset className="report-reasons" disabled={busy}><legend>What did you notice?</legend>{reasons.map(item => <label key={item} className={reason === item ? 'selected' : ''}><input type="radio" name="reason" value={item} checked={reason === item} onChange={() => setReason(item)} /><span>{item}</span>{reason === item && <Check size={17} />}</label>)}</fieldset>
        <label htmlFor="report-details">More details <span className="optional">(optional)</span></label><textarea id="report-details" disabled={busy} rows={3} maxLength={2000} placeholder="Where you bought it, or what looks unusual…" value={details} onChange={event => setDetails(event.target.value)} />
        <p className="supporting-copy small">Submit sends these details to SmartScan for review. Reports are allegations and do not automatically lower a product score.</p>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="dark-button" disabled={busy}>{busy ? 'Submitting…' : 'Submit report'}<ArrowRight size={18}/></button><button type="button" className="text-button" disabled={busy} onClick={()=>{try {const draft=saveReport({productSerial:selected.serialNumber,productName:selected.name || 'Unregistered product',reason,details:details.trim(),status:'draft',requestId:requestId.current});setSaved(draft);setSelected(null);}catch{setError('Could not save a draft on this device.');}}}>Save an offline draft</button>
      </form>
    </Sheet>}
    {saved && <Sheet title={saved.caseId ? 'Report submitted' : 'Draft saved'} onClose={() => setSaved(null)}><span className="success-seal"><Check size={30} /></span><h3>Thanks for looking out.</h3><p className="supporting-copy">{saved.caseId ? 'SmartScan received your report. Case reference: '+saved.caseId : 'Saved only on this device. This draft has not been submitted.'}</p><button className="dark-button" onClick={() => downloadReport(saved)}><Download size={18} />Download report</button><button className="text-button" onClick={() => { setSaved(null); setView('reports'); }}>View saved reports</button></Sheet>}
  </section>;
}
