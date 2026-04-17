import React from 'react';
import { useAppContext } from '../store';
import { Target, Upload, Zap, Microscope, Shield, Star, CheckCircle, Tag, Download, Archive, Calendar } from 'lucide-react';

export const Sidebar = () => {
  const { state, setView } = useAppContext();

  const navItems = [
    { sect: 'Core', items: [
      { id: 'mission', icon: Target, label: 'Mission Control' },
      { id: 'prompt_calendar', icon: Calendar, label: 'Prompt Calendar' }
    ] },
    { sect: 'Pipeline', items: [
      { id: 'upload', icon: Upload, label: 'Upload & Curate 1K', badge: state.uploaded, badgeType: 'info' },
      { id: 'prefilter', icon: Zap, label: 'Pre-Filter', badge: state.prefiltered.invalid + state.prefiltered.tooSmall, badgeType: 'warn' },
      { id: 'qc', icon: Microscope, label: 'QC Center', badge: state.qc.pass, badgeType: 'ok' },
      { id: 'antisimilar', icon: Shield, label: 'Anti Similar', badge: state.asi.clusters, badgeType: 'info' },
      { id: 'selector', icon: Star, label: 'Best Selector', badge: state.selector.now, badgeType: 'ok' },
      { id: 'approval', icon: CheckCircle, label: 'Approval Queue', badge: state.approval.metaReady, badgeType: 'ok' },
      { id: 'metadata', icon: Tag, label: 'Metadata SEO', badge: state.metadata.generated, badgeType: 'info' },
    ]},
    { sect: 'Output', items: [
      { id: 'export', icon: Download, label: 'Daily Export', badge: `${state.export.count}/500`, badgeType: 'warn' },
      { id: 'archive', icon: Archive, label: 'Archive & Log' },
    ]}
  ];

  return (
    <nav className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0 z-50 overflow-y-auto h-full">
      <div className="p-4 border-b border-slate-800 relative">
        <div className="font-mono text-xs font-bold text-cyan-400 tracking-widest uppercase leading-tight">Microstock<br/>Visual Insight PRO</div>
        <div className="font-mono text-[10px] text-slate-500 tracking-wider uppercase mt-1">v2.1.0 · 2026</div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-cyan-400 to-transparent"></div>
      </div>

      <div className="flex-1 py-2 overflow-y-auto">
        {navItems.map((group, i) => (
          <div key={i}>
            <div className="font-mono text-[10px] font-bold text-slate-500 tracking-widest uppercase px-4 pt-4 pb-2">{group.sect}</div>
            {group.items.map(item => (
              <div 
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex items-center gap-3 px-4 py-2 cursor-pointer text-sm transition-all border-l-2 ${state.view === item.id ? 'text-cyan-400 border-cyan-400 bg-cyan-400/10 font-medium' : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-cyan-400/5'}`}
              >
                <item.icon size={16} />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className={`ml-auto font-mono text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    item.badgeType === 'ok' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/25' :
                    item.badgeType === 'warn' ? 'bg-amber-400/10 text-amber-400 border-amber-400/25' :
                    item.badgeType === 'err' ? 'bg-rose-500/10 text-rose-500 border-rose-500/25' :
                    'bg-cyan-400/10 text-cyan-400 border-cyan-400/25'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-slate-800 bg-slate-950">
        <div className="flex justify-between font-mono text-[10px] text-slate-500 mb-1"><span>Batch</span><span className="text-slate-400">{state.batchId}</span></div>
        <div className="flex justify-between font-mono text-[10px] text-slate-500 mb-1"><span>Daily Used</span><span className="text-slate-400">{state.metadata.dailyUsed} / 500</span></div>
        <div className="flex justify-between font-mono text-[10px] text-slate-500"><span>Platform</span><span className="text-slate-400">AS + SS</span></div>
        <div className={`mt-3 border rounded px-2 py-1.5 font-mono text-[10px] tracking-wide text-center font-bold uppercase ${state.mode === 'strict_photorealistic' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'}`}>
          ⚠ {state.mode === 'strict_photorealistic' ? 'Strict Photorealistic' : 'All Strict'}
        </div>
      </div>
    </nav>
  );
};
