import React, { useState } from 'react';
import { useAppContext } from '../store';
import { Star, CheckCircle } from 'lucide-react';
import { UploadedImageItem } from '../types';

export const BestSelectorView = () => {
  const { state, setState, addLog, showToast } = useAppContext();
  const [isProcessing, setIsProcessing] = useState(false);

  const runSelector = () => {
    if (state.asi.clusters === 0) { 
      showToast('⚠ Run Anti Similar first'); 
      return; 
    }
    
    setIsProcessing(true);
    
    const itemsToProcess = state.uploadedItems.filter(i => i.selectedAfterQC);
    const { updatedItems, selectorStats, approvalStats } = runSelectorLogic(itemsToProcess, state.uploadedItems, state.mode);
    
    setState(s => ({
      ...s,
      uploadedItems: updatedItems,
      selector: selectorStats,
      approval: approvalStats
    }));
    
    setIsProcessing(false);
    addLog('pass', `Best Selector complete: ${selectorStats.now} approved_now, ${selectorStats.backup} approved_backup`);
    showToast(`⭐ Best Selector complete: ${selectorStats.now} approved_now`);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <div className="font-mono text-lg font-bold text-slate-100 flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400"><Star size={18} /></div>
            Best Selector
          </div>
          <div className="text-sm text-slate-400">Weighted ranking engine · Verdict 40% · Originality 20% · Commercial 15% · Technical 15% · Platform 10%</div>
        </div>
        <button onClick={runSelector} disabled={isProcessing} className="bg-amber-400/10 border border-amber-500 text-amber-400 hover:bg-amber-400/20 rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {isProcessing ? '⭐ Ranking...' : '⭐ Run Best Selector'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900 border-t-2 border-t-emerald-400 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Approved Now</div>
          <div className="font-mono text-3xl font-bold text-emerald-400 mb-1">{state.selector.now}</div>
          <div className="text-xs text-slate-400">primary submission</div>
        </div>
        <div className="bg-slate-900 border-t-2 border-t-cyan-400 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Approved Backup</div>
          <div className="font-mono text-3xl font-bold text-cyan-400 mb-1">{state.selector.backup}</div>
          <div className="text-xs text-slate-400">if needed</div>
        </div>
        <div className="bg-slate-900 border-t-2 border-t-amber-400 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Fix Later</div>
          <div className="font-mono text-3xl font-bold text-amber-400 mb-1">{state.selector.fix}</div>
          <div className="text-xs text-slate-400">needs rework</div>
        </div>
        <div className="bg-slate-900 border-t-2 border-t-rose-500 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Rejected</div>
          <div className="font-mono text-3xl font-bold text-rose-500 mb-1">{state.selector.rejected}</div>
          <div className="text-xs text-slate-400">final exclusion</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold mb-4">Weighting Logic</div>
        <div className="flex gap-3 flex-wrap mb-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-center">
            <div className="font-mono text-xl font-bold text-emerald-400">40%</div>
            <div className="text-[10px] text-slate-400">Verdict/QC</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-center">
            <div className="font-mono text-xl font-bold text-cyan-400">20%</div>
            <div className="text-[10px] text-slate-400">Originality</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-center">
            <div className="font-mono text-xl font-bold text-amber-400">15%</div>
            <div className="text-[10px] text-slate-400">Commercial</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-center">
            <div className="font-mono text-xl font-bold text-purple-400">15%</div>
            <div className="text-[10px] text-slate-400">Technical</div>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-center">
            <div className="font-mono text-xl font-bold text-slate-400">10%</div>
            <div className="text-[10px] text-slate-400">Platform</div>
          </div>
        </div>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold mb-4">Selector Results</div>
        <div className="overflow-x-auto border border-slate-800 rounded-lg max-h-[500px] overflow-y-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-800 sticky top-0 z-10">
              <tr>
                <th className="p-3 font-mono text-[10px] text-slate-400 tracking-wider uppercase font-bold border-b border-slate-700">Preview</th>
                <th className="p-3 font-mono text-[10px] text-slate-400 tracking-wider uppercase font-bold border-b border-slate-700">File Name</th>
                <th className="p-3 font-mono text-[10px] text-slate-400 tracking-wider uppercase font-bold border-b border-slate-700">Final Score</th>
                <th className="p-3 font-mono text-[10px] text-slate-400 tracking-wider uppercase font-bold border-b border-slate-700">Verdict</th>
                <th className="p-3 font-mono text-[10px] text-slate-400 tracking-wider uppercase font-bold border-b border-slate-700">Risk</th>
                <th className="p-3 font-mono text-[10px] text-slate-400 tracking-wider uppercase font-bold border-b border-slate-700">Originality</th>
                <th className="p-3 font-mono text-[10px] text-slate-400 tracking-wider uppercase font-bold border-b border-slate-700">Comm/Tech</th>
                <th className="p-3 font-mono text-[10px] text-slate-400 tracking-wider uppercase font-bold border-b border-slate-700">Platform</th>
                <th className="p-3 font-mono text-[10px] text-slate-400 tracking-wider uppercase font-bold border-b border-slate-700">Bucket</th>
                <th className="p-3 font-mono text-[10px] text-slate-400 tracking-wider uppercase font-bold border-b border-slate-700">Reason</th>
              </tr>
            </thead>
            <tbody>
              {state.selector.ranked.length === 0 ? (
                <tr><td colSpan={10} className="p-6 text-center text-slate-500 text-sm">Run Best Selector to see ranked results</td></tr>
              ) : (
                state.selector.ranked.map((c: any, i: number) => (
                  <tr key={c.id} className="border-b border-slate-800 hover:bg-amber-400/5 transition-colors">
                    <td className="p-2">
                      <div className="w-10 h-10 rounded bg-slate-800 overflow-hidden relative">
                        <img src={c.previewUrl} alt={c.name} className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 right-0 bg-black/70 px-1 text-[8px] font-mono text-white">{i+1}</div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-xs text-slate-300 truncate max-w-[120px]" title={c.name}>{c.name}</div>
                      <div className="font-mono text-[9px] text-slate-500">{c.clusterId} · {c.role}</div>
                    </td>
                    <td className={`p-3 font-mono text-xs font-bold ${c.finalScore >= 82 ? 'text-emerald-400' : c.finalScore >= 70 ? 'text-amber-400' : 'text-rose-500'}`}>{c.finalScore}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase border ${
                        c.verdict === 'APPROVED' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/25' :
                        c.verdict === 'REVIEW' ? 'bg-amber-400/10 text-amber-400 border-amber-400/25' :
                        'bg-rose-500/10 text-rose-500 border-rose-500/25'
                      }`}>{c.verdict}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase border ${
                        c.duplicateRisk === 'very high' ? 'bg-rose-500/10 text-rose-500 border-rose-500/25' :
                        c.duplicateRisk === 'high' ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' :
                        'bg-emerald-400/10 text-emerald-400 border-emerald-400/25'
                      }`}>{c.duplicateRisk}</span>
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-400">{c.originality}%</td>
                    <td className="p-3">
                      <div className="flex flex-col gap-0.5">
                        <div className="text-[8px] font-mono text-amber-400">C: {c.scores?.commercial}%</div>
                        <div className="text-[8px] font-mono text-purple-400">T: {c.scores?.technical}%</div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-0.5">
                        <div className="text-[8px] font-mono text-cyan-400">AS: {c.platformSuitability?.adobeStock}%</div>
                        <div className="text-[8px] font-mono text-amber-400">SS: {c.platformSuitability?.shutterstock}%</div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase border ${
                        c.bucket === 'approved_now' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/25' :
                        c.bucket === 'approved_backup' ? 'bg-cyan-400/10 text-cyan-400 border-cyan-400/25' :
                        c.bucket === 'fix_later' ? 'bg-amber-400/10 text-amber-400 border-amber-400/25' :
                        'bg-rose-500/10 text-rose-500 border-rose-500/25'
                      }`}>{c.bucket.replace('_', ' ')}</span>
                    </td>
                    <td className="p-3">
                      <div className="text-[9px] text-slate-400 font-mono leading-tight max-w-[120px]">
                        {c.approvalReason || 'Standard ranking'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Best Selector Logic v8: Shortlist Director (Novice-Friendly) ---

export const runSelectorLogic = (itemsToProcess: UploadedImageItem[], allItems: UploadedImageItem[], mode: string) => {
  let nowCount = 0;
  let backupCount = 0;
  let fixCount = 0;
  let rejectCount = 0;

  const updatedItems = itemsToProcess.map(item => {
    const originality = item.originality || 0;
    const commercial = item.scores?.commercial || 0;
    const technical = item.scores?.technical || 0;
    const risk = item.duplicateRisk || 'low';
    const platform = Math.max(item.platformSuitability?.adobeStock || 0, item.platformSuitability?.shutterstock || 0);

    // Weighted Final Score for Ranking v8
    let finalScore = 0;
    const riskPenalty = risk === 'very high' ? 60 : risk === 'high' ? 35 : risk === 'medium' ? 15 : 0;
    const roleBonus = item.role === 'hero' ? 35 : item.role === 'alt' ? 18 : -50;

    const verdictScore = item.verdict === 'APPROVED' ? 100 : item.verdict === 'REVIEW' ? 75 : 0;

    finalScore = Math.round(
      (verdictScore * 0.40) + 
      (originality * 0.20) + 
      (commercial * 0.15) + 
      (technical * 0.15) + 
      (platform * 0.10)
    ) + roleBonus - riskPenalty;
    
    finalScore = Math.max(0, Math.min(100, finalScore));

    // Bucketing Logic v8: Shortlist Director
    let bucket: 'approved_now' | 'approved_backup' | 'fix_later' | 'rejected' = 'rejected';
    let approvalReason = '';
    
    // HARD REJECT RULES: Reserved for true failures
    const isHardReject = 
      item.verdict === 'REJECTED' || 
      item.role === 'drop' || 
      (technical < 30 && commercial < 30);

    if (isHardReject) {
      bucket = 'rejected';
      if (item.role === 'drop') approvalReason = 'Rejected as redundant variation (Too Similar)';
      else approvalReason = 'Final exclusion - severe quality or commercial failure';
    } else {
      // Shortlist Director: Route items into valid buckets
      if (item.role === 'hero') {
        // Best in Cluster
        if (item.verdict === 'APPROVED' && finalScore >= 75) {
          bucket = 'approved_now';
          approvalReason = 'Primary candidate: Best in Cluster with high commercial potential';
        } else if (finalScore >= 60) {
          bucket = 'approved_backup';
          approvalReason = 'Best in Cluster; kept as backup due to moderate quality';
        } else {
          bucket = 'fix_later';
          approvalReason = 'Best in Cluster but requires manual review/fix before submission';
        }
      } else if (item.role === 'alt') {
        // Backup Variation
        if (finalScore >= 65) {
          bucket = 'approved_backup';
          approvalReason = 'Strong backup variation: Distinct composition and high quality';
        } else {
          bucket = 'fix_later';
          approvalReason = 'Backup variation kept for review due to moderate quality';
        }
      } else {
        // Fallback for non-clustered items
        if (item.verdict === 'APPROVED' && finalScore >= 80) {
          bucket = 'approved_now';
          approvalReason = 'Primary candidate: High quality and strong commercial potential';
        } else if (finalScore >= 50) {
          bucket = 'approved_backup';
          approvalReason = 'Strong backup candidate for secondary submission';
        } else {
          bucket = 'fix_later';
          approvalReason = 'Review candidate: Usable asset but requires manual verification';
        }
      }
    }

    // Update counts
    if (bucket === 'approved_now') nowCount++;
    else if (bucket === 'approved_backup') backupCount++;
    else if (bucket === 'fix_later') fixCount++;
    else rejectCount++;

    // metaReady only for approved buckets by default
    const included = bucket === 'approved_now' || bucket === 'approved_backup';
    const metaReady = included; 

    return { ...item, finalScore, bucket, included, excluded: !included, metaReady, approvalReason };
  });

  const newUploadedItems = [...allItems];
  updatedItems.forEach(updatedItem => {
    const idx = newUploadedItems.findIndex(i => i.id === updatedItem.id);
    if (idx !== -1) newUploadedItems[idx] = updatedItem;
  });

  const ranked = [...updatedItems].sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

  return {
    updatedItems: newUploadedItems,
    selectorStats: { now: nowCount, backup: backupCount, fix: fixCount, rejected: rejectCount, ranked },
    approvalStats: {
      now: updatedItems.filter(i => i.bucket === 'approved_now'),
      backup: updatedItems.filter(i => i.bucket === 'approved_backup'),
      excluded: updatedItems.filter(i => i.excluded && (i.bucket === 'approved_now' || i.bucket === 'approved_backup' || i.bucket === 'fix_later')).length,
      metaReady: updatedItems.filter(i => i.metaReady).length
    }
  };
};

export const ApprovalQueueView = () => {
  const { state, setState, setView, showToast, addLog } = useAppContext();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('final_desc');

  const sendToMetadata = () => {
    if (state.approval.metaReady === 0) { 
      showToast('⚠ No items ready for metadata. Include items first.'); 
      return; 
    }
    showToast(`✅ ${state.approval.metaReady} approved assets sent to Metadata SEO`);
    addLog('pass', `Metadata handoff ready: ${state.approval.metaReady} items`);
    setView('metadata');
  };

  const toggleInclude = (id: string) => {
    const newItems = [...state.uploadedItems];
    const idx = newItems.findIndex(i => i.id === id);
    if (idx === -1) return;

    const item = newItems[idx];
    const newIncluded = !item.included;
    
    newItems[idx] = {
      ...item,
      included: newIncluded,
      excluded: !newIncluded,
      metaReady: newIncluded && (item.bucket === 'approved_now' || item.bucket === 'approved_backup' || item.bucket === 'fix_later')
    };

    // Recalculate approval stats
    const nowItems = newItems.filter(i => i.bucket === 'approved_now');
    const backupItems = newItems.filter(i => i.bucket === 'approved_backup');
    const excludedCount = newItems.filter(i => i.excluded && (i.bucket === 'approved_now' || i.bucket === 'approved_backup' || i.bucket === 'fix_later')).length;
    const metaReadyCount = newItems.filter(i => i.metaReady).length;

    setState(s => ({
      ...s,
      uploadedItems: newItems,
      approval: {
        now: nowItems,
        backup: backupItems,
        excluded: excludedCount,
        metaReady: metaReadyCount
      }
    }));
    
    addLog('info', `Approval Queue updated: ${metaReadyCount} included, ${excludedCount} excluded`);
  };

  // Get relevant items for approval queue: now, backup, and fix_later
  const queueItems = state.uploadedItems.filter(i => i.bucket === 'approved_now' || i.bucket === 'approved_backup' || i.bucket === 'fix_later');

  // Apply filters
  const filteredItems = queueItems.filter(item => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'approved_now') return item.bucket === 'approved_now';
    if (activeFilter === 'approved_backup') return item.bucket === 'approved_backup';
    if (activeFilter === 'fix_later') return item.bucket === 'fix_later';
    if (activeFilter === 'included') return item.included;
    if (activeFilter === 'excluded') return item.excluded;
    return true;
  });

  // Apply sorting
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'final_desc') return (b.finalScore || 0) - (a.finalScore || 0);
    if (sortBy === 'final_asc') return (a.finalScore || 0) - (b.finalScore || 0);
    if (sortBy === 'qc_desc') return (b.qcScore || 0) - (a.qcScore || 0);
    if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
    if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
    return 0;
  });

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <div className="font-mono text-lg font-bold text-slate-100 flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400"><CheckCircle size={18} /></div>
            Approval Queue
          </div>
          <div className="text-sm text-slate-400">Candidates from Best Selector · APPROVED is primary · REVIEW optional · manual include/exclude</div>
        </div>
        <button onClick={sendToMetadata} className="bg-emerald-400/10 border border-emerald-500 text-emerald-400 hover:bg-emerald-400/20 rounded px-4 py-2 text-sm font-medium transition-colors">
          → Send to Metadata SEO
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold mb-4">Queue Summary</div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Approved</div><div className="text-xs font-mono text-emerald-400">{state.approval.now.length}</div></div>
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Review / Backup</div><div className="text-xs font-mono text-cyan-400">{state.approval.backup.length}</div></div>
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Fix Later</div><div className="text-xs font-mono text-amber-400">{state.selector.fix}</div></div>
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Manually Excluded</div><div className="text-xs font-mono text-rose-500">{state.approval.excluded}</div></div>
            <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-800"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Metadata Ready</div><div className="text-xs font-mono font-bold text-emerald-400">{state.approval.metaReady}</div></div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 md:col-span-2">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold mb-4">Controls</div>
          
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-[10px] text-slate-500 mb-2 font-mono">FILTER</div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setActiveFilter('all')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${activeFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>All</button>
                <button onClick={() => setActiveFilter('approved_now')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${activeFilter === 'approved_now' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Approved</button>
                <button onClick={() => setActiveFilter('approved_backup')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${activeFilter === 'approved_backup' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Backup</button>
                <button onClick={() => setActiveFilter('fix_later')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${activeFilter === 'fix_later' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Fix Later</button>
                <button onClick={() => setActiveFilter('included')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${activeFilter === 'included' ? 'bg-slate-700 text-white border border-slate-500' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Included</button>
                <button onClick={() => setActiveFilter('excluded')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${activeFilter === 'excluded' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Excluded</button>
              </div>
            </div>
            
            <div>
              <div className="text-[10px] text-slate-500 mb-2 font-mono">SORT BY</div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setSortBy('final_desc')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${sortBy === 'final_desc' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Score (High-Low)</button>
                <button onClick={() => setSortBy('final_asc')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${sortBy === 'final_asc' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Score (Low-High)</button>
                <button onClick={() => setSortBy('qc_desc')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${sortBy === 'qc_desc' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>QC Score</button>
                <button onClick={() => setSortBy('name_asc')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${sortBy === 'name_asc' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Name (A-Z)</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-6 max-h-[600px] overflow-y-auto pr-2 no-scrollbar">
        {queueItems.length === 0 ? (
          <div className="text-center p-10 text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-4xl mb-3">✅</div>
            <div className="font-mono text-xs">Run Best Selector to populate approval queue</div>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="text-center p-10 text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="font-mono text-xs">No items match current filters</div>
          </div>
        ) : (
          sortedItems.map((img: any) => (
            <div key={img.id} className={`bg-slate-900 border rounded-lg p-3 flex items-center gap-4 transition-colors ${
              img.included ? 'border-emerald-400/30 hover:border-emerald-400' : 'border-slate-800 opacity-60 hover:opacity-100'
            }`}>
              <div className="w-12 h-12 bg-slate-800 rounded overflow-hidden flex-shrink-0">
                <img src={img.previewUrl} alt={img.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs font-bold text-slate-200 mb-1 truncate" title={img.name}>{img.name}</div>
                <div className="flex gap-3 text-[10px] text-slate-400 font-mono">
                  <span>Verdict: <span className={img.verdict === 'APPROVED' ? 'text-emerald-400' : 'text-amber-400'}>{img.verdict}</span></span>
                  <span>Risk: <span className={img.duplicateRisk === 'low' || img.duplicateRisk === 'very low' ? 'text-emerald-400' : 'text-amber-400'}>{img.duplicateRisk}</span></span>
                  <span>Originality: <span className="text-purple-400">{img.originality}%</span></span>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase border ${img.finalScore >= 82 ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/25' : 'bg-amber-400/10 text-amber-400 border-amber-400/25'}`}>
                    Score: {img.finalScore}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase border ${img.role === 'hero' ? 'bg-cyan-400/10 text-cyan-400 border-cyan-400/25' : img.role === 'alt' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/25' : 'bg-amber-400/10 text-amber-400 border-amber-400/25'}`}>
                    {img.role}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase border ${
                    img.bucket === 'approved_now' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/25' : 
                    img.bucket === 'approved_backup' ? 'bg-cyan-400/10 text-cyan-400 border-cyan-400/25' :
                    'bg-amber-400/10 text-amber-400 border-amber-400/25'
                  }`}>
                    {img.bucket.replace('_', ' ')}
                  </span>
                </div>
                
                <button 
                  onClick={() => toggleInclude(img.id)}
                  className={`px-3 py-1 rounded text-[10px] font-mono font-bold uppercase transition-colors flex items-center gap-1 ${
                    img.included 
                      ? 'bg-emerald-500/20 text-emerald-400 hover:bg-rose-500/20 hover:text-rose-400' 
                      : 'bg-slate-800 text-slate-400 hover:bg-emerald-500/20 hover:text-emerald-400'
                  }`}
                >
                  {img.included ? (
                    <><span>Included</span> <span className="text-xs">✓</span></>
                  ) : (
                    <><span>Excluded</span> <span className="text-xs">✕</span></>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
