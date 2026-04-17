import React from 'react';
import { useAppContext } from '../store';
import { Target, Upload, CheckCircle, Star, Ban, Play } from 'lucide-react';

export const MissionControl = () => {
  const { state, setView, setState, addLog, showToast } = useAppContext();

  const totalRej = state.prefiltered.invalid + state.prefiltered.tooSmall + state.qc.reject + state.selector.rejected;
  const t = state.uploaded || 1;

  const loadTestData = () => {
    showToast('🎲 Loading test batch — running full pipeline…');
    
    state.uploadedItems.forEach(item => {
      if (item.previewUrl && !item.previewUrl.startsWith('http')) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });

    // Simulate full pipeline
    setState(s => {
      const uploaded = 50;
      const ready = 40;
      const pass = 30;
      const clusters = 10;
      const heroes = 10;
      const now = 8;
      
      const fakeItems = Array.from({length: uploaded}).map((_, i) => ({
        id: `TEST-${i}`,
        file: new File([], `test_${i}.jpg`, { type: 'image/jpeg' }),
        name: `test_${i}.jpg`,
        size: 2500000,
        type: 'image/jpeg',
        lastModified: Date.now(),
        previewUrl: `https://picsum.photos/seed/test${i}/200/200`,
        width: 2000,
        height: 2000,
        aspectRatio: 1,
        fingerprint: `test-${i}`,
        status: (i < pass ? 'qc_pass' : i < pass + 5 ? 'qc_fix' : 'qc_reject') as any,
        qcScore: 70 + (i % 30),
        assetFamily: 'photorealistic_photo' as any,
        selectedAfterQC: i < pass, // Default PASS to selected
        qcOverride: false,
        qcReviewNote: [],
        tags: [],
        notes: [],
        dim: '2000x2000'
      }));

      return {
        ...s,
        uploaded,
        uploadedItems: fakeItems,
        prefiltered: { ready, invalid: 2, tooSmall: 3, duplicate: 2, nonPhoto: 3 },
        qc: { pass, fix: 5, reject: 5, strict: 20, results: fakeItems.slice(0, pass + 10) },
        asi: { clusters, heroes, alts: 5, held: 15, clusters_data: [] },
        selector: { now, backup: 2, fix: 0, rejected: 0, ranked: [] },
        approval: { now: Array.from({length: now}).map((_, i) => ({ id: `TEST-APP-${i}` })), backup: [], excluded: 0, metaReady: pass }, // Use pass count for manual review demo
        metadata: { generated: now, items: Array.from({length: now}).map((_, i) => ({ id: `TEST-META-${i}`, title: `Test Image ${i}`, exportFilename: `test-image-${i}.jpg`, keywords: ['test', 'demo'], category: 'Nature', previewUrl: `https://picsum.photos/seed/meta${i}/200/200` })), dailyUsed: s.metadata.dailyUsed + now },
        export: { built: true, count: now },
      };
    });
    addLog('pass', 'Test batch loaded and processed successfully.');
  };

  const selectedCount = state.uploadedItems.filter(i => i.selectedAfterQC).length;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6">
        <div className="font-mono text-lg font-bold text-slate-100 flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400"><Target size={18} /></div>
          Mission Control
        </div>
        <div className="text-sm text-slate-400">Workflow orchestration hub — pipeline status, batch overview, daily submission tracking</div>
        <div className="inline-flex items-center gap-2 bg-slate-800 border border-slate-700 rounded px-3 py-1 font-mono text-[10px] text-slate-400 mt-3">
          ⚡ {state.mode === 'strict_photorealistic' ? 'Strict Photorealistic' : 'All Strict'} Stock Mode · Adobe Stock + Shutterstock · Max 500 export/day
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500"></div>
          <Upload className="absolute right-4 top-4 text-slate-700 opacity-30" size={32} />
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Total Uploaded</div>
          <div className="font-mono text-3xl font-bold text-cyan-400 mb-1">{state.uploaded}</div>
          <div className="text-xs text-slate-400 mb-3">images in pipeline</div>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500" style={{width: `${Math.min(100, state.uploaded/10*10)}%`}}></div></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400 to-green-500"></div>
          <CheckCircle className="absolute right-4 top-4 text-slate-700 opacity-30" size={32} />
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Manual Selection</div>
          <div className="font-mono text-3xl font-bold text-emerald-400 mb-1">{selectedCount}</div>
          <div className="text-xs text-slate-400 mb-3">curated for metadata</div>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-500" style={{width: `${Math.round(selectedCount/t*100)}%`}}></div></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-yellow-500"></div>
          <Star className="absolute right-4 top-4 text-slate-700 opacity-30" size={32} />
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Approved Now</div>
          <div className="font-mono text-3xl font-bold text-amber-400 mb-1">{state.selector.now}</div>
          <div className="text-xs text-slate-400 mb-3">best selector output</div>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-400 to-yellow-500 transition-all duration-500" style={{width: `${Math.round(state.selector.now/t*100)}%`}}></div></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rose-500 to-red-500"></div>
          <Ban className="absolute right-4 top-4 text-slate-700 opacity-30" size={32} />
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Rejected / Dropped</div>
          <div className="font-mono text-3xl font-bold text-rose-500 mb-1">{totalRej}</div>
          <div className="text-xs text-slate-400 mb-3">filtered out total</div>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-rose-500 to-red-500 transition-all duration-500" style={{width: `${Math.round(totalRej/t*100)}%`}}></div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-900 border-t-2 border-t-cyan-400 border border-slate-800 rounded-xl p-5">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold mb-4">Active Batch</div>
          <div className="flex flex-col gap-2">
            <div className="flex gap-3 items-start"><div className="font-mono text-[10px] text-slate-500 uppercase w-28 font-bold pt-0.5">Batch ID</div><div className="text-xs font-mono text-cyan-400">{state.batchId}</div></div>
            <div className="flex gap-3 items-start"><div className="font-mono text-[10px] text-slate-500 uppercase w-28 font-bold pt-0.5">Created</div><div className="text-xs text-slate-400">Today · 09:00</div></div>
            <div className="flex gap-3 items-start"><div className="font-mono text-[10px] text-slate-500 uppercase w-28 font-bold pt-0.5">Platform</div><div className="text-xs text-slate-400">Adobe Stock + Shutterstock</div></div>
            <div className="flex gap-3 items-start"><div className="font-mono text-[10px] text-slate-500 uppercase w-28 font-bold pt-0.5">Mode</div><div className="text-xs"><span className={`border px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase ${state.mode === 'strict_photorealistic' ? 'bg-rose-500/10 text-rose-500 border-rose-500/25' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25'}`}>{state.mode === 'strict_photorealistic' ? 'Strict Photorealistic' : 'All Strict'}</span></div></div>
            <div className="flex gap-3 items-start"><div className="font-mono text-[10px] text-slate-500 uppercase w-28 font-bold pt-0.5">Status</div><div className="text-xs text-cyan-400 flex items-center gap-2">Processing <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span></div></div>
          </div>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold mb-4">Daily Export Limit</div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="font-mono text-[10px] text-slate-400 w-20">Metadata</div>
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{width: `${(state.metadata.dailyUsed / 500) * 100}%`}}></div></div>
              <div className="font-mono text-[10px] font-bold text-cyan-400 w-12 text-right">{state.metadata.dailyUsed}/500</div>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="font-mono text-[10px] text-slate-400 w-20">Export Batch</div>
              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{width: `${(state.export.count / 500) * 100}%`}}></div></div>
              <div className="font-mono text-[10px] font-bold text-cyan-400 w-12 text-right">{state.export.count}/500</div>
            </div>
            <div className="font-mono text-[10px] text-slate-400 text-right">Remaining: <span className="text-emerald-400">{500 - state.metadata.dailyUsed}</span> slots today</div>
          </div>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <button onClick={loadTestData} className="bg-cyan-400/10 border border-cyan-500 text-cyan-400 hover:bg-cyan-400/20 rounded px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2">
          🎲 Load Test Batch (50 images)
        </button>
        <button onClick={() => setView('upload')} className="bg-transparent border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white rounded px-4 py-2 text-sm font-medium transition-colors">
          ⬆ Start Upload
        </button>
        <button onClick={() => setView('qc')} className="bg-transparent border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white rounded px-4 py-2 text-sm font-medium transition-colors">
          🔬 Jump to QC
        </button>
        <button onClick={() => setView('export')} className="bg-transparent border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white rounded px-4 py-2 text-sm font-medium transition-colors">
          📤 Export Today
        </button>
      </div>
    </div>
  );
};
