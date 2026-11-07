import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Columns2, ListFilter, MapPin, ScanLine } from 'lucide-react';
import ProductCard, { ProductRow } from './ProductCard';
import Sheet from './Sheet';
import SupplyMap from './SupplyMap';
import { getScanHistory, saveScanToHistory } from '../utils/storage';
import PurchaseChecks from './PurchaseChecks';
import { productStatus, supplyChain } from '../utils/product';

export default function PassportView({ product, onScanAgain, onReportProduct, onBack, title = 'History' }) {
  const [updated,setUpdated]=useState({});
  const items = useMemo(() => {
    const history = getScanHistory();
    return (product ? [product, ...history.filter(item => item.serialNumber !== product.serialNumber)] : history).map(p=>updated[p.serialNumber] || p);
  }, [product,updated]);
  const [mode, setMode] = useState('carousel');
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [details, setDetails] = useState(false);
  const strip = useRef(null);
  const settleTimer = useRef(null);
  const activeIndex = useRef(index);
  activeIndex.current = index;
  const active = items[index] || items[0];
  const hasMultipleScans = items.length > 1;
  const journey = useMemo(() => supplyChain(active), [active]);

  function scrollToSlide(slideIndex, smooth = true) {
    const el = strip.current;
    const boundedIndex = Math.max(0, Math.min(slideIndex, items.length - 1));
    const card = el?.children[boundedIndex];
    if (card) el.scrollTo({ left: card.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft), behavior: smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant' });
  }
  useEffect(() => {
    if (mode !== 'carousel' || !strip.current) return;
    // Folding, rotation and split view must not select a different saved scan.
    const observer = new ResizeObserver(() => {
      clearTimeout(settleTimer.current);
      scrollToSlide(activeIndex.current, false);
    });
    observer.observe(strip.current);
    scrollToSlide(activeIndex.current, false);
    return () => { observer.disconnect(); clearTimeout(settleTimer.current); };
  }, [mode, items]);

  function onScroll() {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const el = strip.current;
      if (!el?.children.length) return;
      const inset = parseFloat(getComputedStyle(el).paddingLeft);
      let nearest = 0;
      [...el.children].forEach((child, i) => {
        if (Math.abs(child.offsetLeft - inset - el.scrollLeft) < Math.abs(el.children[nearest].offsetLeft - inset - el.scrollLeft)) nearest = i;
      });
      setIndex(nearest);
    }, 140);
  }
  function step(direction) {
    scrollToSlide(index + direction);
  }

  return <section className={`passport-screen ${mode}-mode`} aria-label={title}>
    <SupplyMap product={active} mode={mode} expanded={expanded} />
    <header className="floating-header">
      <button className="circle-button raised" onClick={onBack || onScanAgain} aria-label="Back to scan"><ArrowLeft size={22} /></button>
      <h1>{title}</h1>
      <div className="view-toggle" data-mode={mode} role="group" aria-label="History display">
        <button className={mode === 'carousel' ? 'active' : ''} aria-label="Carousel view" aria-pressed={mode === 'carousel'} onClick={() => setMode('carousel')}><Columns2 size={23} strokeWidth={1.6} /></button>
        <button className={mode === 'list' ? 'active' : ''} aria-label="List view" aria-pressed={mode === 'list'} onClick={() => setMode('list')}><ListFilter size={23} strokeWidth={1.6} /></button>
      </div>
    </header>
    {!items.length ? <div className="empty-state floating-empty"><span className="empty-icon"><ScanLine size={34} strokeWidth={1.4} /></span><h2>Your story starts<br />with a scan.</h2><p>Your scanned products and their journeys will appear here.</p><button className="dark-button" onClick={onScanAgain}>Scan a product<ArrowRight size={18} /></button></div> : <>
      {mode === 'carousel' ? <>
        <div className="passport-carousel" ref={strip} onScroll={onScroll} role="region" aria-label="Scanned products" aria-roledescription="carousel">
          {items.map((item, slideIndex) => {
            const isCurrent = slideIndex === index;
            return <div className="passport-slide" key={item.serialNumber} role="group" aria-roledescription="slide" aria-label={`${slideIndex + 1} of ${items.length}`} aria-hidden={!isCurrent} inert={isCurrent ? undefined : ''}>
              <ProductCard product={item} onDetails={() => setDetails(true)} onReport={() => onReportProduct(item)} />
            </div>;
          })}
        </div>
        <div className="carousel-pagination">
          {hasMultipleScans && <button className="pagination-arrow" aria-label="Previous scan" disabled={index === 0} onClick={() => step(-1)}><ChevronLeft size={17} /></button>}
          <span aria-live="polite">{index + 1}<span className="pagination-divider">/</span>{items.length} {items.length === 1 ? 'scan' : 'scans'}</span>
          {hasMultipleScans && <button className="pagination-arrow" aria-label="Next scan" disabled={index === items.length - 1} onClick={() => step(1)}><ChevronRight size={17} /></button>}
        </div>
      </> : <div className={`history-list-panel ${expanded ? 'expanded' : ''}`}>
        <button className="list-expand" aria-label={expanded ? 'Show more map' : 'Expand scan list'} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><span /></button>
        <div className="history-list" aria-label="Previous scans">{items.map((item, itemIndex) => <ProductRow key={item.serialNumber} product={item} selected={itemIndex === index} onClick={() => { setIndex(itemIndex); setMode('carousel'); }} />)}</div>
      </div>}
    </>}
    {details && active && <Sheet title="Product journey" onClose={() => setDetails(false)}>
      <span className={`status-badge ${productStatus(active).tone}`}>{productStatus(active).label}</span>
      <h3>{active.name || 'Unregistered product'}</h3><p className="supporting-copy">{productStatus(active).description}</p>
      <div className="serial-box"><span>Serial number</span><code>{active.serialNumber}</code></div>
      <section className="verification-evidence" aria-label="Verification findings">
        <h4>Verification findings</h4>
        {active.assessment ? <>
          {active.assessment.score && <p className="supporting-copy"><strong>Evidence score: {active.assessment.score.value}/100</strong>. {active.assessment.score.passed} of {active.assessment.score.total} scored checks passed. Unknown checks are not failures; this is not a probability of authenticity.</p>}
          <p className="supporting-copy">{active.assessment.coverage.assessed} of {active.assessment.coverage.expected} evidence areas assessed.</p>
          {active.exists && <PurchaseChecks key={active.serialNumber} product={active} onUpdated={p=>{saveScanToHistory(p);setUpdated(values=>({...values,[p.serialNumber]:p}));}}/>}
          <ul>{active.assessment.findings.map(finding => <li key={finding.code} data-state={finding.state}>
            <strong>{finding.domain.charAt(0).toUpperCase() + finding.domain.slice(1)}</strong>
            <span className="check-state">{finding.state==='supported' ? 'Passed' : finding.state==='concern' ? 'Concern' : 'Unknown'}{active.assessment.score?.checks?.find(c=>c.domain===finding.domain) ? ` · ${active.assessment.score.checks.find(c=>c.domain===finding.domain).earned}/${active.assessment.score.checks.find(c=>c.domain===finding.domain).weight}` : ''}</span>
            <p>{finding.explanation}</p>
          </li>)}</ul>
          {active.assessment.custodian && <p className="supporting-copy">Last confirmed custodian: {active.assessment.custodian.name || active.assessment.custodian.wallet}. {active.assessment.custodian.recordedLocation || 'Location not recorded.'}</p>}
        </> : <p className="supporting-copy">Detailed assessment and scan anomaly checks are unavailable for this saved result. Scan again to request current checks.</p>}
        <p className="supporting-copy">{active.verifiedAt ? `Record checked ${new Date(active.verifiedAt).toLocaleString()}. Saved results do not update automatically.` : 'Current blockchain status has not been confirmed.'}</p>
      </section>
      <p className="supporting-copy">Map points show recorded or approximate locations. Connecting lines do not show an observed travel route.</p>
      {journey.length ? <ol className="journey-timeline">{journey.map(stop => <li key={stop.id}><span className="timeline-point" /><div><span className="eyebrow">{stop.role}</span><h4>{stop.name}</h4><p><MapPin size={13} />{stop.location || 'Location not recorded'}</p></div></li>)}</ol> : <p className="supporting-copy">The registry has no recorded supply-chain stops for this product yet.</p>}
      <button className="dark-button" onClick={() => { setDetails(false); onReportProduct(active); }}>Report an issue<ArrowRight size={18} /></button>
    </Sheet>}
  </section>;
}
