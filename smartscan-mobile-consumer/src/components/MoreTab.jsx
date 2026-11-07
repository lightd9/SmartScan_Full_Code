import React, { useState } from 'react';
import { ArrowUpRight, ChevronRight, HelpCircle, Info, ShieldCheck, Trash2, Vibrate } from 'lucide-react';
import { BLOCK_EXPLORER_URL, CONTRACT_ADDRESS } from '../config/constants';
import { clearScanHistory, getHapticsEnabled, setHapticsEnabled } from '../utils/storage';
import Sheet from './Sheet';

export default function MoreTab() {
  const [haptics, setHaptics] = useState(getHapticsEnabled);
  const [sheet, setSheet] = useState(null);
  const [message, setMessage] = useState('');
  function toggleHaptics() {
    try { setHapticsEnabled(!haptics); setHaptics(!haptics); }
    catch { setMessage('Your browser could not save this preference.'); }
  }
  return <section className="standard-screen">
    <header className="page-header"><h1>More</h1><span className="wordmark">SmartScan<span>®</span></span></header>
    <div className="intro-card more-intro"><span className="brand-seal"><ShieldCheck size={35} strokeWidth={1.3} /></span><h2>A little more<br />peace of mind.</h2><p>Your products. Their stories. All in one place.</p></div>
    <h2 className="settings-heading">Make it yours</h2>
    <div className="settings-card">
      <div className="settings-row"><Vibrate size={21} /><span><strong>Haptic feedback</strong><small>A gentle buzz after each scan</small></span><button role="switch" aria-label="Haptic feedback" aria-checked={haptics} className={`switch ${haptics ? 'on' : ''}`} onClick={toggleHaptics}><i /></button></div>
      <button className="settings-row" onClick={() => setSheet('privacy')}><ShieldCheck size={21} /><span><strong>Your privacy</strong><small>Understand what’s saved</small></span><ChevronRight size={18} /></button>
    </div>
    <h2 className="settings-heading">Here to help</h2>
    <div className="settings-card">
      <button className="settings-row" onClick={() => setSheet('help')}><HelpCircle size={21} /><span><strong>How SmartScan works</strong></span><ChevronRight size={18} /></button>
      <a className="settings-row" href={BLOCK_EXPLORER_URL + '/address/' + CONTRACT_ADDRESS} target="_blank" rel="noreferrer"><ArrowUpRight size={21} /><span><strong>Explore the blockchain</strong><small>Ethereum Sepolia</small></span><ArrowUpRight size={18} /></a>
      <button className="settings-row" onClick={() => setSheet('about')}><Info size={21} /><span><strong>About SmartScan</strong></span><ChevronRight size={18} /></button>
    </div>
    <button className="clear-history-button" onClick={() => setSheet('clear')}><Trash2 size={17} />Clear scan history</button>
    <p className="app-version">SmartScan Verify · Version 1.0.0</p>
    {message && <p className="supporting-copy" role="status">{message}</p>}
    {sheet && <Sheet title={{ privacy: 'Your privacy', help: 'A little scan. Total confidence.', about: 'About SmartScan', clear: 'Clear scan history?' }[sheet]} onClose={() => setSheet(null)}>
      {sheet === 'privacy' && <div className="prose"><p>Your most recent 30 scans, reports, and preferences are saved in this browser or on this device.</p><p>Scanned serial numbers are checked with the product registry and blockchain provider. Product photos and supply-chain maps load from their respective providers. Recorded facility addresses may be looked up to place them on the map.</p><p>Your camera is used to read QR codes. Camera frames and uploaded QR photos are decoded on your device.</p></div>}
      {sheet === 'help' && <div className="prose"><h3>1. Scan the label</h3><p>Enable your camera and hold the product’s QR code inside the frame. You can also upload a photo or enter its serial number.</p><h3>2. Check its story</h3><p>Read the verification result, then explore the recorded manufacturer, supplier, and retailer stops on the map. Swipe to revisit previous scans.</p><h3>3. Raise a concern</h3><p>If something looks wrong, open Report, select the product, and save a report to share with the seller.</p></div>}
      {sheet === 'about' && <div className="prose"><h3>Confidence in what you buy.</h3><p>SmartScan helps you check a product’s registered origin and follow its supply-chain journey.</p><p>This version uses Ethereum Sepolia, a test network. A registered code confirms a registry record; always check the physical product and packaging too.</p><span className="status-badge neutral">Version 1.0.0</span></div>}
      {sheet === 'clear' && <><p className="supporting-copy">This removes the scans saved on this device. Your saved reports will stay available.</p><button className="dark-button" onClick={() => { try { clearScanHistory(); setMessage('Scan history cleared.'); setSheet(null); } catch { setMessage('History could not be cleared. Try again.'); } }}>Clear history<Trash2 size={17} /></button><button className="text-button" onClick={() => setSheet(null)}>Keep my scans</button></>}
    </Sheet>}
  </section>;
}
