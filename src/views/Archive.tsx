import React from 'react';
import { useAppContext } from '../store';
import { Archive } from 'lucide-react';

export const ArchiveView = () => {
  const { state } = useAppContext();

  const aprRate = state.uploaded > 0 ? Math.round(state.selector.now / state.uploaded * 100) : 0;
  const rejRate = state.uploaded > 0 ? Math.round((state.qc.reject + state.selector.rejected) / state.uploaded * 100) : 0;
  const avgQC = state.qc.results.length > 0 ? Math.round(state.qc.results.reduce((s, r) => s + r.qcScore!, 0) / state.qc.results.length) : 0;
  const strictRate = state.uploaded > 0 ? Math.round(state.qc.strict / state.uploaded * 100) : 0;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6">
        <div className="font-mono text-lg font-bold text-slate-100 flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400"><Archive size={18} /></div>
          Archive & Learning Log
        </div>
        <div className="text-sm text-slate-400">Upload history · QC failure patterns · Similarity patterns · Approval patterns · Metadata history</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold mb-4">Approval Patterns</div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Avg Approval Rate</div><div className="text-xs font-mono text-emerald-400">{aprRate}%</div></div>
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Best Performing Niche</div><div className="text-xs text-slate-300">Workspace, Nature</div></div>
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Avg QC Score</div><div className="text-xs font-mono text-slate-300">{avgQC || '—'}</div></div>
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Strict Pass Rate</div><div className="text-xs font-mono text-cyan-400">{strictRate}%</div></div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold mb-4">QC Failure Patterns</div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Top Failure</div><div className="text-xs text-rose-500">Photorealism &lt; 84</div></div>
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">2nd Failure</div><div className="text-xs text-amber-400">Commercial Safety &lt; 90</div></div>
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Avg Reject Rate</div><div className="text-xs font-mono text-slate-300">{rejRate}%</div></div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold mb-4">Daily Export History</div>
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Total Batches</div><div className="text-xs font-mono text-slate-300">1</div></div>
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Total Exported</div><div className="text-xs font-mono text-slate-300">{state.export.count}</div></div>
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Today</div><div className="text-xs font-mono text-slate-300">{state.export.count} / 500</div></div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold mb-4">Learning Log</div>
        <div className="space-y-2">
          {state.log.map((l, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border-l-2 bg-slate-800/50 ${
              l.type === 'pass' ? 'border-emerald-400' : 
              l.type === 'fail' ? 'border-rose-500' : 
              'border-amber-400'
            }`}>
              <div className="font-mono text-[10px] text-slate-500 w-16 pt-0.5">{l.time}</div>
              <div className="text-xs text-slate-300 flex-1">{l.msg}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
