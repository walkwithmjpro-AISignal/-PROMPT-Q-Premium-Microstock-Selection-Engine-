import React from 'react';
import { useAppContext } from '../store';
import { Play, RotateCcw } from 'lucide-react';

export const Topbar = () => {
  const { state, setView, resetPipeline, runPipeline } = useAppContext();

  const titles: Record<string, string> = {
    mission: 'Mission Control', upload: 'Upload & Curate 1K', prefilter: 'Pre-Filter',
    qc: 'QC Center', antisimilar: 'Anti Similar Center', selector: 'Best Selector',
    approval: 'Approval Queue', metadata: 'Metadata SEO', export: 'Daily Export', archive: 'Archive & Learning Log',
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 h-14 flex items-center gap-4 flex-shrink-0 relative z-40">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-cyan-400 to-transparent w-3/5"></div>
      <div>
        <div className="font-mono text-sm font-bold text-slate-100 tracking-wide">{titles[state.view] || state.view}</div>
        <div className="font-mono text-[10px] text-slate-500">Visual Insight PRO <span className="text-cyan-400">›</span> {titles[state.view] || state.view}</div>
      </div>
      <div className="flex-1"></div>
      
      <div className="hidden md:flex items-center gap-3">
        <div className="bg-slate-800 border border-slate-700 rounded px-3 py-1 flex items-center gap-2 font-mono text-[10px] text-slate-400">
          <span>Uploaded</span><span className="text-cyan-400 font-bold">{state.uploaded}</span>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded px-3 py-1 flex items-center gap-2 font-mono text-[10px] text-slate-400">
          <span>QC Pass</span><span className="text-emerald-400 font-bold">{state.qc.pass}</span>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded px-3 py-1 flex items-center gap-2 font-mono text-[10px] text-slate-400">
          <span>Approved</span><span className="text-emerald-400 font-bold">{state.selector.now}</span>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded px-3 py-1 flex items-center gap-2 font-mono text-[10px] text-slate-400">
          <span>Daily Limit</span><span className="text-amber-400 font-bold">{state.metadata.dailyUsed}/500</span>
        </div>
      </div>

      <button onClick={runPipeline} className="bg-cyan-400/10 border border-cyan-500 text-cyan-400 hover:bg-cyan-400/20 rounded px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5">
        <Play size={14} /> Run Pipeline
      </button>
      <button onClick={resetPipeline} className="bg-slate-800 border border-slate-700 text-slate-400 hover:border-cyan-500 hover:text-cyan-400 rounded px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5">
        <RotateCcw size={14} /> Reset
      </button>
    </header>
  );
};
