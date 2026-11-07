import React from 'react';
import { ScanLine, FolderOpen, Flag, Shapes } from 'lucide-react';
const tabs = [{ id: 'scan', label: 'Scan', icon: ScanLine }, { id: 'history', label: 'History', icon: FolderOpen }, { id: 'report', label: 'Report', icon: Flag }, { id: 'more', label: 'More', icon: Shapes }];
export default function BottomNav({ activeTab, onSelectTab }) {
  return <nav className="bottom-nav-bar" aria-label="Main navigation">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${activeTab === id ? 'active' : ''}`} aria-current={activeTab === id ? 'page' : undefined} onClick={() => onSelectTab(id)}><span className="nav-icon"><Icon size={24} strokeWidth={activeTab === id ? 1.8 : 1.5} /></span><span>{label}</span></button>)}</nav>;
}
