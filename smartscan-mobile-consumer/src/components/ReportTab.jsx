import React, { useState } from 'react';
import { ArrowRight, Check, Download, Flag, ScanLine } from 'lucide-react';
import { getScanHistory, getSavedReports, saveReport } from '../utils/storage';
import { ProductRow } from './ProductCard';
import Sheet from './Sheet';

export function downloadReport(report) {
  const text = ['SmartScan product report', report.id, '', 'Product: ' + report.productName, 'Serial: ' + report.productSerial, 'Reason: ' + report.reason, 'Details: ' + (report.details || 'None added'), 'Saved: ' + report.timestamp, '', 'Saved on this device. Not submitted to the manufacturer.'].join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url; link.download = report.id + '.txt'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const reasons = ['Suspected counterfeit', 'Broken or tampered seal', 'Duplicate serial number', 'Unauthorized retailer', 'Other concern'];
export default function ReportTab({ initialProduct, onOpenScanner }) {
  const [selected, setSelected] = useState(initialProduct || null);
  const [reason, setReason] = useState(reasons[0]);
  const [details, setDetails] = useState('');
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('products');
  const history = getScanHistory();
  const reports = getSavedReports();
  return <section className="standard-screen">
    <header className="page-header"><h1>Report</h1><span className="circle-button raised decorative"><Flag size={21} /></span></header>
    <div className="intro-card"><span className="status-badge authentic">A little care goes a long way</span><h2>Something<br />doesn’t look right?</h2><p>Choose a scanned product and tell us what you noticed.</p></div>
    <div className="section-title-row"><h2>{view === 'products' ? 'Your scanned products' : 'Saved reports'}</h2><button className="text-button" onClick={() => setView(view === 'products' ? 'reports' : 'products')}>{view === 'products' ? 'Saved reports' : 'Products'}</button></div>
    {view === 'products' ? history.length ? <div className="product-list">{history.map(product => <ProductRow key={product.serialNumber} product={product} onClick={() => { setSelected(product); setError(''); }} />)}</div> : <div className="empty-state"><ScanLine size={30} /><h3>No scans yet</h3><p>Scan a product first to report a concern.</p><button className="dark-button" onClick={onOpenScanner}>Scan a product<ArrowRight size={18} /></button></div> : reports.length ? <div className="saved-report-list">{reports.map(report => <button className="saved-report" key={report.id} onClick={() => downloadReport(report)}><span className="circle-button"><Flag size={20} /></span><span><strong>{report.productName}</strong><small>{report.reason}</small><small>Saved on this device</small></span><Download size={18} /></button>)}</div> : <p className="supporting-copy">You haven’t saved any reports yet.</p>}
    {selected && <Sheet title="Report a concern" onClose={() => setSelected(null)}><p className="selected-product-name">{selected.name || 'Unregistered product'}</p>
      <form className="sheet-form" onSubmit={event => {
        event.preventDefault();
        try {
          const report = saveReport({ productSerial: selected.serialNumber, productName: selected.name || 'Unregistered product', reason, details: details.trim() });
          setSaved(report); setSelected(null); setDetails('');
        } catch { setError('Your report could not be saved. Please check available browser storage and try again.'); }
      }}>
        <fieldset className="report-reasons"><legend>What did you notice?</legend>{reasons.map(item => <label key={item} className={reason === item ? 'selected' : ''}><input type="radio" name="reason" value={item} checked={reason === item} onChange={() => setReason(item)} /><span>{item}</span>{reason === item && <Check size={17} />}</label>)}</fieldset>
        <label htmlFor="report-details">More details <span className="optional">(optional)</span></label><textarea id="report-details" rows={3} maxLength={2000} placeholder="Where you bought it, or what looks unusual…" value={details} onChange={event => setDetails(event.target.value)} />
        <p className="supporting-copy small">Reports are saved on this device. You can download a copy to send to the seller or manufacturer.</p>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="dark-button">Save report<ArrowRight size={18} /></button>
      </form>
    </Sheet>}
    {saved && <Sheet title="Report saved" onClose={() => setSaved(null)}><span className="success-seal"><Check size={30} /></span><h3>Thanks for looking out.</h3><p className="supporting-copy">Your report is saved on this device. Download it to share with your seller or manufacturer.</p><button className="dark-button" onClick={() => downloadReport(saved)}><Download size={18} />Download report</button><button className="text-button" onClick={() => { setSaved(null); setView('reports'); }}>View saved reports</button></Sheet>}
  </section>;
}
