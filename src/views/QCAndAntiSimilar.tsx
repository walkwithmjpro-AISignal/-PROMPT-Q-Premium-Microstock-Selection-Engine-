import React, { useState } from 'react';
import { useAppContext } from '../store';
import { Microscope, Shield } from 'lucide-react';
import { ImagePipelineStatus, UploadedImageItem, QualityGrade, CurationVerdict, DuplicateRisk, VisualDescriptor } from '../types';
import { runSelectorLogic } from './SelectorAndApproval';
import { generateMetadataLogic } from './MetaAndExport';

const analyzeImage = async (url: string): Promise<any> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        const MAX_DIM = 256;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > MAX_DIM) { h *= MAX_DIM / w; w = MAX_DIM; }
        } else {
          if (h > MAX_DIM) { w *= MAX_DIM / h; h = MAX_DIM; }
        }
        canvas.width = Math.max(1, w);
        canvas.height = Math.max(1, h);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let totalBrightness = 0;
        let darkPixels = 0;
        let brightPixels = 0;
        let totalSaturation = 0;
        let edgeSum = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i+1];
          const b = data[i+2];
          
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          totalBrightness += brightness;
          
          if (brightness < 30) darkPixels++;
          if (brightness > 225) brightPixels++;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          totalSaturation += saturation;

          if (i + 4 < data.length) {
            const r2 = data[i+4];
            const g2 = data[i+5];
            const b2 = data[i+6];
            const br2 = (r2 * 299 + g2 * 587 + b2 * 114) / 1000;
            edgeSum += Math.abs(brightness - br2);
          }
        }

        const pixelCount = canvas.width * canvas.height;
        const avgBrightness = totalBrightness / pixelCount;
        const avgSaturation = totalSaturation / pixelCount;
        const darkPct = darkPixels / pixelCount;
        const brightPct = brightPixels / pixelCount;
        const edgeDensity = edgeSum / pixelCount;

        // Raw signals for native scoring
        resolve({
          avgBrightness,
          avgSaturation,
          darkPct,
          brightPct,
          edgeDensity,
          pixelCount,
          width: img.width,
          height: img.height
        });
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

// --- QC Center v7: Curator-Minded Logic ---

const calculateCompositionScore = (vd: any, family: string): number => {
  if (!vd) return 70;
  let score = 75;
  
  // Subject Readability & Framing
  if (vd.likelyCenteredSubject) score += 10;
  if (vd.likelyRuleOfThirds) score += 8;
  
  // Whitespace & Layout Coherence
  if (vd.negativeSpaceUsability > 70) score += 10;
  if (vd.likelyWhiteBackground) score += 5;

  // Family-Aware Layout Quality
  if (family === 'line_art_minimal' && vd.negativeSpaceUsability > 80) score += 10;
  if (family === 'icon_sticker_sheet' && vd.likelySheetLayout) score += 10;
  if (family === 'isolated_object' && vd.likelyIsolatedObject && vd.likelyCenteredSubject) score += 15;
  if (family === 'photorealistic_photo' && vd.likelyRuleOfThirds) score += 5;
  if (family === 'vector_flat_graphic' && vd.likelyFlatGraphic) score += 8;

  // Penalty for clutter or bad framing
  if (vd.clutterLevel === 'high') score -= 35;
  if (vd.clutterLevel === 'medium') score -= 12;
  
  return Math.min(100, Math.max(0, score));
};

const calculateFocusScore = (vd: any): number => {
  if (!vd) return 70;
  let score = 80;
  if (vd.sharpnessProfile === 'very_sharp') score += 15;
  if (vd.sharpnessProfile === 'soft') score -= 25;
  if (vd.sharpnessProfile === 'blurry') score -= 55;
  return Math.min(100, Math.max(0, score));
};

const calculateExposureScore = (vd: any): number => {
  if (!vd) return 70;
  let score = 85;
  if (vd.brightnessProfile === 'balanced' || vd.brightnessProfile === 'mid') score += 10;
  if (vd.brightnessProfile === 'overexposed' || vd.brightnessProfile === 'bright') score -= 25;
  if (vd.brightnessProfile === 'underexposed' || vd.brightnessProfile === 'dark') score -= 20;
  return Math.min(100, Math.max(0, score));
};

const calculateNoiseScore = (vd: any, family: string): number => {
  if (!vd) return 70;
  let score = 90;
  
  // Noise must distinguish between messy noise and clean vector edges
  const isVectorOrLineArt = family === 'vector_flat_graphic' || family === 'line_art_minimal' || family === 'icon_sticker_sheet';
  
  if (vd.noiseProfile === 'clean') score += 10;
  if (vd.noiseProfile === 'grainy') score -= isVectorOrLineArt ? 35 : 15; // Punish vector grain more
  if (vd.noiseProfile === 'noisy') score -= isVectorOrLineArt ? 60 : 45;
  
  // Background cleanliness
  if (vd.likelyWhiteBackground && vd.noiseProfile !== 'clean') score -= 15;
  
  return Math.min(100, Math.max(0, score));
};

const calculateCommercialScore = (vd: any, family: string): number => {
  if (!vd) return 70;
  let score = 75;
  
  // Buyer Usefulness & Stock Usability
  if (vd.likelyWhiteBackground || vd.likelyIsolatedObject) score += 15;
  if (vd.likelyCenteredSubject) score += 5;
  if (vd.negativeSpaceUsability > 60) score += 8; // Room for copy
  
  // Market-friendly presentation
  if (vd.saturationProfile === 'vibrant') score += 5;
  if (vd.brightnessProfile === 'mid' || vd.brightnessProfile === 'bright') score += 5;
  
  // Family-specific commercial value
  if (family === 'vector_flat_graphic' || family === 'icon_sticker_sheet') score += 12;
  if (family === 'photorealistic_photo' && (vd.brightnessProfile === 'mid' || vd.brightnessProfile === 'bright')) score += 8;
  
  if (vd.clutterLevel === 'high') score -= 25;
  return Math.min(100, Math.max(0, score));
};

const calculateOriginalityScore = (vd: any, clusterDensity: number, family: string): number => {
  if (!vd) return 70;
  let score = 90;
  
  // Batch-aware originality: Penalty for high redundancy in same family/subject
  const densityPenalty = Math.min(50, clusterDensity * 12);
  score -= densityPenalty;
  
  if (vd.likelySheetLayout) score += 5; 
  if (clusterDensity < 0.05) score += 10; // Unique in batch
  
  return Math.min(100, Math.max(0, score));
};

const calculateTechnicalScore = (vd: any, family: string): number => {
  const focus = calculateFocusScore(vd);
  const exposure = calculateExposureScore(vd);
  const noise = calculateNoiseScore(vd, family);
  return Math.round((focus * 0.4) + (exposure * 0.3) + (noise * 0.3));
};

const determineVerdict = (scores: any, family: string): { grade: string, verdict: 'APPROVED' | 'REVIEW' | 'REJECTED' } => {
  const { qcScore, commercial, technical, originality, composition } = scores;
  
  // Hard Reject Criteria v7: Reserved for true severe failures
  const isHardFail = 
    technical < 35 || 
    commercial < 30 || 
    qcScore < 30 || 
    (technical < 50 && commercial < 40);

  if (isHardFail) {
    return { grade: 'F', verdict: 'REJECTED' };
  }
  
  // Smarter Verdict Logic: Score < 70 goes to REVIEW unless hard fail
  const isApproved = 
    qcScore >= 75 && 
    technical >= 65 && 
    commercial >= 65 && 
    originality >= 40 && 
    composition >= 65;

  if (isApproved) {
    if (qcScore >= 90 && technical >= 85 && commercial >= 85) return { grade: 'A', verdict: 'APPROVED' };
    if (qcScore >= 82) return { grade: 'B', verdict: 'APPROVED' };
    return { grade: 'C', verdict: 'APPROVED' };
  }
  
  return { grade: qcScore >= 60 ? 'D' : 'F', verdict: 'REVIEW' };
};

const generateQualityFlags = (scores: any, vd: any) => {
  const pass: string[] = [];
  const warn: string[] = [];
  const fail: string[] = [];

  if (scores.technical >= 85) pass.push('High Technical Integrity');
  if (scores.commercial >= 85) pass.push('Strong Commercial Appeal');
  if (vd?.negativeSpaceUsability > 75) pass.push('Excellent Whitespace');
  if (vd?.likelyIsolatedObject) pass.push('Clean Isolated Presentation');

  if (vd?.sharpnessProfile === 'soft') warn.push('Slight Softness');
  if (vd?.noiseProfile === 'grainy') warn.push('Visible Grain');
  if (scores.originality < 50) warn.push('Weak Originality in Batch');
  if (scores.composition < 65) warn.push('Suboptimal Framing');

  if (scores.technical < 40) fail.push('Severe Technical Issues');
  if (vd?.clutterLevel === 'high') fail.push('High Visual Clutter');
  if (vd?.sharpnessProfile === 'blurry') fail.push('Severe Motion Blur');
  if (scores.commercial < 40) fail.push('Low Commercial Distinction');

  return { pass, warn, fail };
};

const generateActionItems = (verdict: string, flags: any, role?: string) => {
  const actions: string[] = [];
  
  if (role === 'hero') actions.push('action: Selected as Best in Cluster');
  if (role === 'alt') actions.push('info: Kept as Backup Variation');

  if (verdict === 'APPROVED') {
    actions.push('Ready for metadata generation');
    if (flags.warn.length > 0) actions.push('Review minor quality warnings before export');
  }
  
  if (verdict === 'REVIEW') {
    actions.push('Manual check for technical artifacts or commercial viability');
    if (flags.warn.includes('Weak Originality in Batch')) actions.push('Review batch redundancy before submission');
  }
  
  if (verdict === 'REJECTED') {
    actions.push('Discard asset - severe quality or commercial failure');
    if (flags.fail.includes('High Visual Clutter')) actions.push('Review background cleanliness if retrying');
  }
  
  return actions;
};

const calculatePlatformSuitability = (scores: any, family: string) => {
  const base = scores.qcScore;
  let adobe = base;
  let shutter = base;

  if (family === 'vector_flat_graphic') adobe += 5;
  if (family === 'photorealistic_photo') shutter += 5;
  if (scores.technical > 90) adobe += 5;

  return {
    adobeStock: Math.min(100, Math.max(0, Math.round(adobe))),
    shutterstock: Math.min(100, Math.max(0, Math.round(shutter)))
  };
};

export const runQC = async (itemsToQC: UploadedImageItem[], allItems: UploadedImageItem[], mode: string) => {
  let passCount = 0;
  let fixCount = 0;
  let rejectCount = 0;
  let strictCount = 0;

  const updatedItems = [...allItems];
  
  // Batch context for originality
  const familyCounts: Record<string, number> = {};
  allItems.forEach(item => {
    const f = item.assetFamily || 'unknown';
    familyCounts[f] = (familyCounts[f] || 0) + 1;
  });

  for (let i = 0; i < updatedItems.length; i++) {
    const item = updatedItems[i];
    if (item.status !== 'ready_for_qc' && !itemsToQC.some(x => x.id === item.id)) continue;
    if (item.status !== 'ready_for_qc') continue;

    const stats = await analyzeImage(item.previewUrl);
    if (!stats) {
      updatedItems[i] = {
        ...item,
        status: 'rejected',
        decision: 'REJECT',
        verdict: 'REJECTED',
        grade: 'F',
        qcNotes: ['Failed to analyze image'],
        analysisReady: true
      };
      rejectCount++;
      continue;
    }

    let family = item.assetFamily || 'photorealistic_photo';
    const qcNotes = [];

    // Refine Asset Family detection v6
    if (family === 'photorealistic_photo' || family === 'unknown') {
      const isVeryBright = stats.avgBrightness > 210; 
      const isDesaturated = stats.avgSaturation < 0.15;
      const hasCleanEdges = (100 - (stats.edgeDensity / 255) * 200) > 85;
      if (isVeryBright && isDesaturated && hasCleanEdges) {
        family = 'line_art_minimal';
        qcNotes.push('Refined Asset Family: minimalist line art detected');
      }
    }

    const visualDescriptor: VisualDescriptor = {
      likelyWhiteBackground: stats.brightPct > 0.85,
      likelyCenteredSubject: stats.edgeDensity > 8 && stats.edgeDensity < 140,
      likelySheetLayout: family === 'icon_sticker_sheet' || (stats.edgeDensity > 110 && family === 'illustration_general'),
      likelyFlatGraphic: family === 'vector_flat_graphic' || family === 'icon_sticker_sheet',
      likelyIsolatedObject: family === 'isolated_object' || (stats.brightPct > 0.92 && family === 'photorealistic_photo'),
      likelyLineArt: family === 'line_art_minimal',
      brightnessProfile: (stats.avgBrightness > 205 ? 'bright' : stats.avgBrightness < 55 ? 'dark' : 'mid') as 'bright' | 'dark' | 'mid',
      saturationProfile: (stats.avgSaturation > 0.55 ? 'vibrant' : stats.avgSaturation < 0.12 ? 'muted' : 'neutral') as 'vibrant' | 'muted' | 'neutral',
      edgeProfile: (stats.edgeDensity > 130 ? 'complex' : stats.edgeDensity < 35 ? 'soft' : 'sharp') as 'complex' | 'soft' | 'sharp',
      sharpnessProfile: (stats.edgeDensity > 100 ? 'very_sharp' : stats.edgeDensity < 30 ? 'blurry' : 'sharp') as 'very_sharp' | 'blurry' | 'sharp',
      noiseProfile: (stats.edgeDensity > 150 && family === 'photorealistic_photo' ? 'noisy' : stats.edgeDensity < 20 ? 'clean' : 'grainy') as 'noisy' | 'clean' | 'grainy',
      clutterLevel: (stats.edgeDensity > 180 ? 'high' : stats.edgeDensity < 50 ? 'low' : 'medium') as 'high' | 'low' | 'medium',
      symmetryHint: stats.edgeDensity > 12 && stats.edgeDensity < 75,
      negativeSpaceUsability: Math.round(Math.max(0, 100 - (stats.edgeDensity * 0.75)))
    };

    const composition = calculateCompositionScore(visualDescriptor, family);
    const technical = calculateTechnicalScore(visualDescriptor, family);
    const commercial = calculateCommercialScore(visualDescriptor, family);
    const originality = calculateOriginalityScore(visualDescriptor, (familyCounts[family] || 1) / allItems.length, family);
    
    const qcScore = Math.round((composition * 0.2) + (technical * 0.4) + (commercial * 0.3) + (originality * 0.1));
    
    const { grade, verdict } = determineVerdict({ qcScore, commercial, technical, originality, composition }, family);
    const qualityFlags = generateQualityFlags({ qcScore, commercial, technical, originality, composition }, visualDescriptor);
    const actionItems = generateActionItems(verdict, qualityFlags);
    const platformSuitability = calculatePlatformSuitability({ qcScore, technical }, family);

    if (verdict === 'APPROVED') passCount++;
    else if (verdict === 'REVIEW') fixCount++;
    else rejectCount++;

    const strictPass = qcScore >= 90 && technical >= 85 && commercial >= 85;
    if (strictPass) strictCount++;

    updatedItems[i] = {
      ...item,
      qcScore, 
      decision: verdict === 'APPROVED' ? 'PASS' : verdict === 'REVIEW' ? 'FIX' : 'REJECT', 
      strictPass, 
      status: verdict === 'APPROVED' ? 'qc_pass' : verdict === 'REVIEW' ? 'qc_fix' : 'rejected', 
      analysisReady: true, 
      qcNotes, 
      assetFamily: family,
      selectedAfterQC: verdict === 'APPROVED' || verdict === 'REVIEW', // Allow REVIEW items to proceed to Anti Similar
      qcOverride: false, 
      qcReviewNote: [],
      grade: grade as QualityGrade, 
      verdict, 
      scores: {
        composition,
        technical,
        commercial,
        originality,
        focus: calculateFocusScore(visualDescriptor),
        exposure: calculateExposureScore(visualDescriptor),
        noise: calculateNoiseScore(visualDescriptor, family)
      }, 
      qualityFlags, 
      actionItems, 
      platformSuitability,
      originality, 
      visualDescriptor,
      sharp: calculateFocusScore(visualDescriptor), 
      exp: calculateExposureScore(visualDescriptor), 
      art: technical, 
      comp: composition, 
      safe: commercial, 
      real: originality
    };
  }

  const qcResults = updatedItems.filter(i => i.analysisReady);

  return {
    updatedItems,
    qcStats: {
      pass: passCount,
      fix: fixCount,
      reject: rejectCount,
      strict: strictCount,
      results: qcResults
    }
  };
};

export const QCCenterView = () => {
  const { state, setState, addLog, showToast } = useAppContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const runQCAction = async () => {
    const readyItems = state.uploadedItems.filter(i => i.status === 'ready_for_qc');
    if (readyItems.length === 0) {
      showToast('⚠ No images ready for QC. Run Pre-Filter first.');
      return;
    }

    setIsProcessing(true);
    addLog('pass', `QC started for ${readyItems.length} ready images`);

    const { updatedItems, qcStats } = await runQC(readyItems, state.uploadedItems, state.mode);

    setState(s => ({
      ...s,
      uploadedItems: updatedItems,
      qc: qcStats
    }));

    setIsProcessing(false);
    addLog('pass', `QC complete: ${qcStats.pass} PASS, ${qcStats.fix} FIX, ${qcStats.reject} REJECT. Strict shortlist: ${qcStats.strict} images`);
    showToast(`🔬 QC complete: ${qcStats.pass} passed, ${qcStats.strict} strict shortlist`);
  };

  const avgScore = (path: string) => {
    if (!state.qc.results.length) return 0;
    const sum = state.qc.results.reduce((acc, r) => {
      const parts = path.split('.');
      let val: any = r;
      for (const p of parts) val = val?.[p];
      return acc + (val || 0);
    }, 0);
    return Math.round(sum / state.qc.results.length);
  };

  const curationDims = [
    { label: 'Composition', val: avgScore('scores.composition') },
    { label: 'Focus', val: avgScore('scores.focus') },
    { label: 'Exposure', val: avgScore('scores.exposure') },
    { label: 'Noise', val: avgScore('scores.noise') },
    { label: 'Commercial', val: avgScore('scores.commercial') },
    { label: 'Originality', val: avgScore('scores.originality') },
    { label: 'Technical', val: avgScore('scores.technical') },
  ];

  const filteredResults = state.qc.results.filter(r => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'pass') return r.verdict === 'APPROVED';
    if (activeFilter === 'fix') return r.verdict === 'REVIEW';
    if (activeFilter === 'reject') return r.verdict === 'REJECTED';
    if (activeFilter === 'strict') return r.strictPass;
    return true;
  });

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <div className="font-mono text-lg font-bold text-slate-100 flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400"><Microscope size={18} /></div>
            QC Center
          </div>
          <div className="text-sm text-slate-400">7-dimension curation evaluation · APPROVED / REVIEW / REJECTED · Grade A–F · Quality Flags & Action Items</div>
          <div className="text-xs text-cyan-400/70 mt-1 font-mono italic">Professional microstock review system — deterministic browser-side curation.</div>
        </div>
        <button onClick={runQCAction} disabled={isProcessing} className="bg-cyan-400/10 border border-cyan-500 text-cyan-400 hover:bg-cyan-400/20 rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {isProcessing ? '🔬 Processing...' : '🔬 Run QC Scoring'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900 border-t-2 border-t-emerald-400 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">APPROVED</div>
          <div className="font-mono text-3xl font-bold text-emerald-400 mb-1">{state.qc.pass}</div>
          <div className="text-xs text-slate-400">ready for submission</div>
        </div>
        <div className="bg-slate-900 border-t-2 border-t-amber-400 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">REVIEW</div>
          <div className="font-mono text-3xl font-bold text-amber-400 mb-1">{state.qc.fix}</div>
          <div className="text-xs text-slate-400">manual check needed</div>
        </div>
        <div className="bg-slate-900 border-t-2 border-t-rose-500 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">REJECTED</div>
          <div className="font-mono text-3xl font-bold text-rose-500 mb-1">{state.qc.reject}</div>
          <div className="text-xs text-slate-400">technical/commercial fail</div>
        </div>
        <div className="bg-slate-900 border-t-2 border-t-cyan-400 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Strict Shortlist</div>
          <div className="font-mono text-3xl font-bold text-cyan-400 mb-1">{state.qc.strict}</div>
          <div className="text-xs text-slate-400">QC≥85, Safety≥90</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 lg:col-span-1">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold mb-4">Average Curation Dimensions</div>
          <div className="flex flex-col gap-3 mb-6">
            {curationDims.map((dim) => (
              <div key={dim.label} className="flex items-center gap-3">
                <div className="font-mono text-[10px] text-slate-400 w-24 capitalize">{dim.label}</div>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${dim.val >= 82 ? 'bg-emerald-400' : dim.val >= 70 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{width: `${dim.val}%`}}></div>
                </div>
                <div className={`font-mono text-[10px] font-bold w-6 text-right ${dim.val >= 82 ? 'text-emerald-400' : dim.val >= 70 ? 'text-amber-400' : 'text-rose-500'}`}>{dim.val || '—'}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold">QC Results</div>
            <div className="flex gap-2">
              <button onClick={() => setActiveFilter('all')} className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase transition-colors ${activeFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>All</button>
              <button onClick={() => setActiveFilter('pass')} className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase transition-colors ${activeFilter === 'pass' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Approved</button>
              <button onClick={() => setActiveFilter('fix')} className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase transition-colors ${activeFilter === 'fix' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Review</button>
              <button onClick={() => setActiveFilter('reject')} className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase transition-colors ${activeFilter === 'reject' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Rejected</button>
              <button onClick={() => setActiveFilter('strict')} className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase transition-colors ${activeFilter === 'strict' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Strict</button>
            </div>
          </div>
          <div className="overflow-x-auto border border-slate-800 rounded-lg max-h-[400px] overflow-y-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-800 sticky top-0 z-10">
                <tr>
                  <th className="p-3 font-mono text-[10px] text-slate-400 tracking-wider uppercase font-bold border-b border-slate-700">Preview</th>
                  <th className="p-3 font-mono text-[10px] text-slate-400 tracking-wider uppercase font-bold border-b border-slate-700">File Name</th>
                  <th className="p-3 font-mono text-[10px] text-slate-400 tracking-wider uppercase font-bold border-b border-slate-700">Grade</th>
                  <th className="p-3 font-mono text-[10px] text-slate-400 tracking-wider uppercase font-bold border-b border-slate-700">Score</th>
                  <th className="p-3 font-mono text-[10px] text-slate-400 tracking-wider uppercase font-bold border-b border-slate-700">Originality</th>
                  <th className="p-3 font-mono text-[10px] text-slate-400 tracking-wider uppercase font-bold border-b border-slate-700">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-slate-500 text-sm">No results found for this filter.</td></tr>
                ) : (
                  filteredResults.map(r => (
                    <tr key={r.id} className="border-b border-slate-800 hover:bg-cyan-400/5 transition-colors">
                      <td className="p-2">
                        <div className="w-10 h-10 rounded bg-slate-800 overflow-hidden">
                          <img src={r.previewUrl} alt={r.name} className="w-full h-full object-cover" />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-mono text-xs text-slate-300 truncate max-w-[150px]" title={r.name}>{r.name}</div>
                        <div className="font-mono text-[9px] text-slate-500">{r.dim}</div>
                      </td>
                      <td className="p-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center font-mono font-bold text-sm border ${
                          r.grade === 'A' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30' :
                          r.grade === 'B' ? 'bg-cyan-400/10 text-cyan-400 border-cyan-400/30' :
                          r.grade === 'C' ? 'bg-amber-400/10 text-amber-400 border-amber-400/30' :
                          'bg-rose-500/10 text-rose-500 border-rose-500/30'
                        }`}>{r.grade}</div>
                      </td>
                      <td className={`p-3 font-mono text-xs font-bold ${r.qcScore! >= 82 ? 'text-emerald-400' : r.qcScore! >= 70 ? 'text-amber-400' : 'text-rose-500'}`}>{r.qcScore}</td>
                      <td className={`p-3 font-mono text-xs ${r.originality! >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{r.originality}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase border ${
                          r.verdict === 'APPROVED' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/25' :
                          r.verdict === 'REVIEW' ? 'bg-amber-400/10 text-amber-400 border-amber-400/25' :
                          'bg-rose-500/10 text-rose-500 border-rose-500/25'
                        }`}>{r.verdict}</span>
                        {r.strictPass && <span className="ml-2 text-[10px] text-cyan-400" title="Strict Shortlist">★</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {state.qc.results.length > 0 && <QCReviewListView />}
    </div>
  );
};

export const QCReviewListView = () => {
  const { state, setState, setView, addLog, showToast } = useAppContext();
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isRunningDownstream, setIsRunningDownstream] = useState(false);

  const toggleSelection = (id: string) => {
    const newItems = [...state.uploadedItems];
    const idx = newItems.findIndex(i => i.id === id);
    if (idx === -1) return;

    const item = newItems[idx];
    const newSelected = !item.selectedAfterQC;
    
    newItems[idx] = {
      ...item,
      selectedAfterQC: newSelected,
      // If we are selecting a REJECT item, we don't automatically override here, 
      // but we allow the selection if the user explicitly overrides later or we can just allow it.
      // The requirement says: "REJECT: allow manual override with an explicit action such as: Force Include / Override Reject"
    };

    setState(s => ({ ...s, uploadedItems: newItems }));
  };

  const forceOverrideReject = (id: string) => {
    const newItems = [...state.uploadedItems];
    const idx = newItems.findIndex(i => i.id === id);
    if (idx === -1) return;

    const item = newItems[idx];
    if (item.decision !== 'REJECT') return;

    const newOverride = !item.qcOverride;
    newItems[idx] = {
      ...item,
      qcOverride: newOverride,
      selectedAfterQC: newOverride, // Auto select if overriding
      qcReviewNote: newOverride ? [...(item.qcReviewNote || []), 'Manual Override: Force Included'] : item.qcReviewNote
    };

    setState(s => ({ ...s, uploadedItems: newItems }));
    if (newOverride) {
      addLog('warn', `QC Review: Manual override applied to ${item.name}`);
      showToast('⚠ REJECT item force-included');
    }
  };

  const selectAllPass = () => {
    const newItems = state.uploadedItems.map(item => {
      if (item.decision === 'PASS') {
        return { ...item, selectedAfterQC: true };
      }
      return item;
    });
    setState(s => ({ ...s, uploadedItems: newItems }));
    addLog('info', 'QC Review: All PASS items selected');
  };

  const selectPassAndFix = () => {
    const newItems = state.uploadedItems.map(item => {
      if (item.decision === 'PASS' || item.decision === 'FIX') {
        return { ...item, selectedAfterQC: true };
      }
      return item;
    });
    setState(s => ({ ...s, uploadedItems: newItems }));
    addLog('info', 'QC Review: All PASS and FIX items selected');
  };

  const clearSelection = () => {
    const newItems = state.uploadedItems.map(item => ({ 
      ...item, 
      selectedAfterQC: false,
      qcOverride: false 
    }));
    setState(s => ({ ...s, uploadedItems: newItems }));
    addLog('info', 'QC Review: Selection cleared');
  };

  const forceIncludeSelectedRejects = () => {
    const selectedRejects = state.uploadedItems.filter(i => i.decision === 'REJECT' && i.selectedAfterQC && !i.qcOverride);
    if (selectedRejects.length === 0) {
      showToast('No selected REJECT items to override');
      return;
    }

    const newItems = state.uploadedItems.map(item => {
      if (item.decision === 'REJECT' && item.selectedAfterQC) {
        return {
          ...item,
          qcOverride: true,
          qcReviewNote: [...(item.qcReviewNote || []), 'Manual Override: Force Included']
        };
      }
      return item;
    });

    setState(s => ({ ...s, uploadedItems: newItems }));
    addLog('warn', `Reject override applied to ${selectedRejects.length} items`);
    showToast(`⚠ ${selectedRejects.length} REJECT items force-included`);
  };

  const runSelectedToMetadata = async () => {
    const selectedItems = state.uploadedItems.filter(i => i.selectedAfterQC);
    if (selectedItems.length === 0) {
      showToast('⚠ No items selected for downstream run');
      return;
    }

    setIsRunningDownstream(true);
    addLog('info', `QC manual downstream run started for ${selectedItems.length} selected items`);
    
    try {
      // 1. Real Anti Similar
      const { updatedItems: afterAsi, asiStats } = await runAntiSimilarLogic(selectedItems, state.uploadedItems, state.mode);
      addLog('pass', `Real Anti Similar completed: ${asiStats.clusters} clusters formed`);

      // 2. Real Best Selector
      const selectedAfterAsi = afterAsi.filter(i => i.selectedAfterQC);
      const { updatedItems: afterSelector, selectorStats, approvalStats } = runSelectorLogic(selectedAfterAsi, afterAsi, state.mode);
      addLog('pass', `Real Selector completed: ${selectorStats.now} approved_now, ${selectorStats.backup} approved_backup`);

      // 3. Real Metadata Generation
      const eligibleItems = afterSelector.filter(i => i.metaReady);
      const generatedItems = eligibleItems.slice(0, 500).map(img => {
        const meta = generateMetadataLogic(img, state.mode);
        return { ...img, ...meta };
      });
      
      // Update the main list with metadata
      const finalItems = [...afterSelector];
      generatedItems.forEach(genItem => {
        const idx = finalItems.findIndex(i => i.id === genItem.id);
        if (idx !== -1) finalItems[idx] = genItem;
      });

      addLog('pass', `Metadata generated for ${generatedItems.length} items`);

      // 4. Real Export Build State
      setState(s => ({
        ...s,
        uploadedItems: finalItems,
        asi: asiStats,
        selector: selectorStats,
        approval: approvalStats,
        metadata: {
          generated: generatedItems.length,
          items: generatedItems,
          dailyUsed: generatedItems.length,
          overflow: Math.max(0, eligibleItems.length - 500)
        },
        export: { built: true, count: generatedItems.length }
      }));

      addLog('pass', `Active export batch built with ${generatedItems.length} items`);
      showToast(`🚀 Pipeline complete: ${generatedItems.length} items ready for Export`);
      setView('metadata');
    } catch (err) {
      console.error(err);
      showToast('❌ Pipeline error — check console');
    } finally {
      setIsRunningDownstream(false);
    }
  };

  const filteredItems = state.uploadedItems.filter(i => i.analysisReady).filter(item => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'pass') return item.verdict === 'APPROVED';
    if (activeFilter === 'fix') return item.verdict === 'REVIEW';
    if (activeFilter === 'reject') return item.verdict === 'REJECTED';
    if (activeFilter === 'selected') return item.selectedAfterQC;
    if (activeFilter === 'unselected') return !item.selectedAfterQC;
    if (activeFilter === 'overridden') return item.qcOverride;
    return true;
  });

  const selectedCount = state.uploadedItems.filter(i => i.selectedAfterQC).length;
  const passSelected = state.uploadedItems.filter(i => i.selectedAfterQC && i.verdict === 'APPROVED').length;
  const fixSelected = state.uploadedItems.filter(i => i.selectedAfterQC && i.verdict === 'REVIEW').length;
  const rejectOverridden = state.uploadedItems.filter(i => i.qcOverride).length;

  return (
    <div className="mt-10 pt-10 border-t border-slate-800 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="font-mono text-lg font-bold text-slate-100 flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400"><Shield size={18} /></div>
            QC Manual Review Gate
          </div>
          <div className="text-sm text-slate-400">Manual checklist selection · PASS/FIX/REJECT override · One-click downstream run</div>
        </div>
          <div className="flex gap-3 flex-wrap justify-end">
            <button onClick={clearSelection} className="px-3 py-2 rounded bg-slate-800 text-slate-400 text-xs font-mono hover:bg-slate-700 transition-colors">Clear</button>
            <button onClick={selectAllPass} className="px-3 py-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono hover:bg-emerald-500/20 transition-colors">Select All APPROVED</button>
            <button onClick={selectPassAndFix} className="px-3 py-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono hover:bg-amber-500/20 transition-colors">Select APPROVED + REVIEW</button>
            <button onClick={forceIncludeSelectedRejects} className="px-3 py-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-mono hover:bg-rose-500/20 transition-colors">Force Include Selected Rejects</button>
            <button 
              onClick={runSelectedToMetadata} 
              disabled={isRunningDownstream || selectedCount === 0}
              className="px-4 py-2 rounded bg-cyan-500 text-slate-950 text-sm font-bold hover:bg-cyan-400 transition-colors shadow-lg shadow-cyan-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {isRunningDownstream ? '🚀 Running...' : '🚀 Run Selected to Metadata'}
            </button>
          </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="bg-slate-800/50 p-4 border-b border-slate-800 flex justify-between items-center flex-wrap gap-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex flex-col">
              <span className="font-mono text-[9px] text-slate-500 uppercase">Total Selected</span>
              <span className="font-mono text-lg font-bold text-cyan-400">{selectedCount}</span>
            </div>
            <div className="flex flex-col border-l border-slate-700 pl-4">
              <span className="font-mono text-[9px] text-slate-500 uppercase">Approved Selected</span>
              <span className="font-mono text-lg font-bold text-emerald-400">{passSelected}</span>
            </div>
            <div className="flex flex-col border-l border-slate-700 pl-4">
              <span className="font-mono text-[9px] text-slate-500 uppercase">Review Selected</span>
              <span className="font-mono text-lg font-bold text-amber-400">{fixSelected}</span>
            </div>
            <div className="flex flex-col border-l border-slate-700 pl-4">
              <span className="font-mono text-[9px] text-slate-500 uppercase">Overridden</span>
              <span className="font-mono text-lg font-bold text-rose-500">{rejectOverridden}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'pass', 'fix', 'reject', 'selected', 'unselected', 'overridden'].map(f => (
              <button 
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-2 py-1 rounded text-[10px] font-mono font-bold uppercase transition-colors ${activeFilter === f ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[500px] overflow-y-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900 sticky top-0 z-10">
              <tr className="border-b border-slate-800">
                <th className="p-3 w-12"></th>
                <th className="p-3 font-mono text-[10px] text-slate-500 uppercase">Preview</th>
                <th className="p-3 font-mono text-[10px] text-slate-500 uppercase">File Name</th>
                <th className="p-3 font-mono text-[10px] text-slate-500 uppercase text-center">Grade</th>
                <th className="p-3 font-mono text-[10px] text-slate-500 uppercase text-center">Verdict</th>
                <th className="p-3 font-mono text-[10px] text-slate-500 uppercase text-center">Platform Suitability</th>
                <th className="p-3 font-mono text-[10px] text-slate-500 uppercase">Flags</th>
                <th className="p-3 font-mono text-[10px] text-slate-500 uppercase">Action Items</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr><td colSpan={8} className="p-10 text-center text-slate-500 font-mono text-xs">No items match filter</td></tr>
              ) : (
                filteredItems.map(item => (
                  <tr 
                    key={item.id} 
                    className={`border-b border-slate-800 transition-colors ${item.selectedAfterQC ? 'bg-cyan-400/5' : 'hover:bg-slate-800/50'}`}
                  >
                    <td className="p-3 text-center" onClick={() => toggleSelection(item.id)}>
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${item.selectedAfterQC ? 'bg-cyan-500 border-cyan-500 text-slate-950' : 'border-slate-700 bg-slate-800'}`}>
                        {item.selectedAfterQC && <span className="text-[10px] font-bold">✓</span>}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="w-12 h-12 rounded bg-slate-800 overflow-hidden border border-slate-700">
                        <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-mono text-xs text-slate-200 truncate max-w-[150px]" title={item.name}>{item.name}</div>
                      <div className="font-mono text-[9px] text-slate-500">{item.assetFamily?.replace(/_/g, ' ')}</div>
                    </td>
                    <td className="p-3 text-center">
                      <div className={`font-mono text-xs font-bold ${
                        item.grade === 'A' ? 'text-emerald-400' :
                        item.grade === 'B' ? 'text-cyan-400' :
                        item.grade === 'C' ? 'text-amber-400' :
                        'text-rose-500'
                      }`}>{item.grade}</div>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase border ${
                        item.verdict === 'APPROVED' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/25' :
                        item.verdict === 'REVIEW' ? 'bg-amber-400/10 text-amber-400 border-amber-400/25' :
                        'bg-rose-500/10 text-rose-500 border-rose-500/25'
                      }`}>{item.verdict}</span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex flex-col gap-1 items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] text-slate-500 uppercase font-mono">AS:</span>
                          <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-400" style={{ width: `${item.platformSuitability?.adobeStock || 0}%` }}></div>
                          </div>
                          <span className="text-[8px] font-mono text-cyan-400">{item.platformSuitability?.adobeStock || 0}%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] text-slate-500 uppercase font-mono">SS:</span>
                          <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400" style={{ width: `${item.platformSuitability?.shutterstock || 0}%` }}></div>
                          </div>
                          <span className="text-[8px] font-mono text-amber-400">{item.platformSuitability?.shutterstock || 0}%</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {item.qualityFlags?.fail.map((f: string, idx: number) => <span key={`fail-${f}-${idx}`} className="bg-rose-500/10 text-rose-500 border border-rose-500/20 px-1 py-0.5 rounded text-[8px] font-mono uppercase">FAIL: {f}</span>)}
                        {item.qualityFlags?.warn.map((f: string, idx: number) => <span key={`warn-${f}-${idx}`} className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 py-0.5 rounded text-[8px] font-mono uppercase">WARN: {f}</span>)}
                        {item.qualityFlags?.pass.map((f: string, idx: number) => <span key={`pass-${f}-${idx}`} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.5 rounded text-[8px] font-mono uppercase">PASS: {f}</span>)}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        {item.actionItems?.map((a: string, idx: number) => <div key={`action-${a}-${idx}`} className="text-[9px] text-slate-400 font-mono flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-cyan-400"></span>
                          {a}
                        </div>)}
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

export const AntiSimilarView = () => {
  const { state, setState, addLog, showToast } = useAppContext();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const runAntiSimilar = async () => {
    const passedItems = state.uploadedItems.filter(i => i.selectedAfterQC);
    if (passedItems.length === 0) {
      showToast('⚠ No items selected from QC. Run QC Center first.');
      return;
    }

    setIsProcessing(true);
    addLog('pass', `Anti Similar started for ${passedItems.length} selected images`);

    const { updatedItems, asiStats } = await runAntiSimilarLogic(passedItems, state.uploadedItems, state.mode);

    setState(s => ({
      ...s,
      uploadedItems: updatedItems,
      asi: asiStats
    }));

    setIsProcessing(false);
    addLog('pass', `Anti Similar complete: ${asiStats.clusters} clusters, ${asiStats.heroes} heroes, ${asiStats.alts} alternates, ${asiStats.held} hold`);
    showToast(`🛡 Clustering complete: ${asiStats.clusters} clusters · ${asiStats.heroes} heroes selected`);
  };

  const filteredClusters = state.asi.clusters_data.map((cluster: any) => {
    const filteredItems = cluster.items.filter((img: any) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'hero') return img.role === 'hero';
      if (activeFilter === 'alt') return img.role === 'alt';
      if (activeFilter === 'hold') return img.role === 'hold';
      if (activeFilter === 'drop') return img.role === 'drop';
      if (activeFilter === 'large') return cluster.items.length > 2;
      return true;
    });
    return { ...cluster, items: filteredItems };
  }).filter((c: any) => c.items.length > 0);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <div className="font-mono text-lg font-bold text-slate-100 flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400"><Shield size={18} /></div>
            Anti Similar Center
          </div>
          <div className="text-sm text-slate-400">Cluster near-duplicates · 1 Best in Cluster · Max 1 Backup Variation · Rest: Too Similar</div>
          <div className="text-xs text-purple-400/70 mt-1 font-mono italic">GEMINI clustering — identifying strongest candidates and redundant variations.</div>
        </div>
        <button onClick={runAntiSimilar} disabled={isProcessing} className="bg-purple-400/10 border border-purple-500 text-purple-400 hover:bg-purple-400/20 rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {isProcessing ? '🛡 Processing...' : '🛡 Run Clustering'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900 border-t-2 border-t-cyan-400 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Total Clusters</div>
          <div className="font-mono text-3xl font-bold text-cyan-400 mb-1">{state.asi.clusters}</div>
          <div className="text-xs text-slate-400">detected groups</div>
        </div>
        <div className="bg-slate-900 border-t-2 border-t-emerald-400 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Best in Cluster</div>
          <div className="font-mono text-3xl font-bold text-emerald-400 mb-1">{state.asi.heroes}</div>
          <div className="text-xs text-slate-400">primary survivors</div>
        </div>
        <div className="bg-slate-900 border-t-2 border-t-amber-400 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Backup Variations</div>
          <div className="font-mono text-3xl font-bold text-amber-400 mb-1">{state.asi.alts}</div>
          <div className="text-xs text-slate-400">meaningful alternates</div>
        </div>
        <div className="bg-slate-900 border-t-2 border-t-rose-500 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Too Similar</div>
          <div className="font-mono text-3xl font-bold text-rose-500 mb-1">{state.asi.held}</div>
          <div className="text-xs text-slate-400">rejected as redundant</div>
        </div>
      </div>

      {state.asi.clusters_data.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <button onClick={() => setActiveFilter('all')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium whitespace-nowrap transition-colors ${activeFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}>All Clusters</button>
          <button onClick={() => setActiveFilter('hero')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium whitespace-nowrap transition-colors ${activeFilter === 'hero' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}>Best in Cluster</button>
          <button onClick={() => setActiveFilter('alt')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium whitespace-nowrap transition-colors ${activeFilter === 'alt' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}>Backups</button>
          <button onClick={() => setActiveFilter('drop')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium whitespace-nowrap transition-colors ${activeFilter === 'drop' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}>Too Similar</button>
          <button onClick={() => setActiveFilter('large')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium whitespace-nowrap transition-colors ${activeFilter === 'large' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}>Large Clusters (&gt;2)</button>
        </div>
      )}

      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 no-scrollbar">
        {state.asi.clusters_data.length === 0 ? (
          <div className="text-center p-10 text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-4xl mb-3">🛡</div>
            <div className="font-mono text-xs">Run Anti Similar clustering to see results</div>
          </div>
        ) : (
          filteredClusters.map((cluster: any) => (
            <div key={cluster.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-800 flex items-center gap-3">
                <div className="font-mono text-xs font-bold text-slate-200">{cluster.id}</div>
                <span className="bg-cyan-400/10 text-cyan-400 border border-cyan-400/25 px-2 py-0.5 rounded-full font-mono text-[9px] font-bold uppercase">{cluster.items.length} items</span>
                {cluster.items.length > 1 && (
                  <div className="ml-auto font-mono text-[10px] text-slate-400">Avg Sim: <span className="text-amber-400">{cluster.avgSimilarity}%</span></div>
                )}
              </div>
              <div className="p-4 flex gap-4 overflow-x-auto">
                {cluster.items.map((img: any) => (
                  <div key={img.id} className={`flex-shrink-0 bg-slate-950 border rounded-lg overflow-hidden w-40 flex flex-col ${
                    img.role === 'hero' ? 'border-cyan-400 ring-1 ring-cyan-400/50' : 
                    img.role === 'alt' ? 'border-emerald-400' : 
                    img.role === 'hold' ? 'border-amber-400/50' : 'border-slate-800 opacity-60'
                  }`}>
                    <div className="aspect-square relative">
                      <img src={img.previewUrl} alt={img.name} className="w-full h-full object-cover" />
                      <div className="absolute top-1 right-1">
                        <span className={`px-1.5 py-0.5 rounded-full font-mono text-[8px] font-bold uppercase border backdrop-blur-sm ${
                          img.role === 'hero' ? 'bg-cyan-500/80 text-white border-cyan-400' : 
                          img.role === 'alt' ? 'bg-emerald-500/80 text-white border-emerald-400' : 
                          'bg-slate-800/80 text-slate-300 border-slate-600'
                        }`}>{img.role === 'hero' ? 'Best' : img.role === 'alt' ? 'Backup' : 'Similar'}</span>
                      </div>
                      {img.role !== 'hero' && (
                        <div className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[8px] font-mono text-slate-300">
                          Sim to Best: {img.similarityScore}%
                        </div>
                      )}
                    </div>
                    <div className="p-2 flex-1 flex flex-col">
                      <div className="font-mono text-[9px] text-slate-300 truncate mb-1" title={img.name}>{img.name}</div>
                      <div className="flex flex-col gap-1 mt-auto">
                        <div className="flex justify-between items-center">
                          <div className="font-mono text-[8px] text-slate-500 uppercase">Risk:</div>
                          <div className={`font-mono text-[8px] font-bold ${
                            img.duplicateRisk === 'very high' ? 'text-rose-500' :
                            img.duplicateRisk === 'high' ? 'text-amber-400' :
                            img.duplicateRisk === 'medium' ? 'text-cyan-400' :
                            'text-emerald-400'
                          }`}>{img.duplicateRisk}</div>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="font-mono text-[8px] text-slate-500 uppercase">Originality:</div>
                          <div className={`font-mono text-[8px] font-bold ${img.originality >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{img.originality}%</div>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="font-mono text-[8px] text-slate-500 uppercase">Verdict:</div>
                          <div className={`font-mono text-[8px] font-bold ${
                            img.verdict === 'APPROVED' ? 'text-emerald-400' :
                            img.verdict === 'REVIEW' ? 'text-amber-400' :
                            'text-rose-500'
                          }`}>{img.verdict}</div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-800">
                          <div className="font-mono text-[8px] text-slate-500 uppercase mb-1">Curation Reason:</div>
                          <div className="text-[8px] text-slate-400 font-mono leading-tight">
                            {img.actionItems?.[0] || 'Standard cluster ranking'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- Anti Similar Logic v7: One Best Image per Cluster ---

export const extractVisualSignature = async (url: string): Promise<number[]> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(Array(16).fill(0));

      canvas.width = 16;
      canvas.height = 16;
      ctx.drawImage(img, 0, 0, 16, 16);

      const imageData = ctx.getImageData(0, 0, 16, 16);
      const data = imageData.data;
      const signature = [];

      for (let by = 0; by < 4; by++) {
        for (let bx = 0; bx < 4; bx++) {
          let sum = 0;
          for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 4; x++) {
              const i = ((by * 4 + y) * 16 + (bx * 4 + x)) * 4;
              const r = data[i];
              const g = data[i+1];
              const b = data[i+2];
              sum += (r * 299 + g * 587 + b * 114) / 1000;
            }
          }
          signature.push(Math.round(sum / 16));
        }
      }
      resolve(signature);
    };
    img.onerror = () => resolve(Array(16).fill(0));
    img.src = url;
  });
};

export const getTokens = (filename: string) => {
  return filename.toLowerCase().replace(/\.[^/.]+$/, "").split(/[^a-z0-9]+/).filter(t => t.length > 2);
};

const getSemanticOverlap = (tokensA: string[], tokensB: string[]) => {
  if (!tokensA?.length || !tokensB?.length) return 0;
  
  const noise = new Set(['and', 'the', 'with', 'for', 'from', 'version', 'batch', 'copy', 'similar', 'asset', 'image', 'photo', 'stock']);
  const filteredA = tokensA.filter(t => !noise.has(t));
  const filteredB = tokensB.filter(t => !noise.has(t));
  
  if (filteredA.length === 0 || filteredB.length === 0) return 0;
  
  const setA = new Set(filteredA);
  const setB = new Set(filteredB);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  
  const overlap = intersection.size / Math.min(setA.size, setB.size);
  return overlap;
};

export const calculateSimilarity = (a: any, b: any) => {
  let visDiffSum = 0;
  for (let i = 0; i < 16; i++) {
    visDiffSum += Math.abs((a.visualSignature[i] || 0) - (b.visualSignature[i] || 0));
  }
  const visSim = Math.max(0, 1 - (visDiffSum / (16 * 255)));

  const semanticSim = getSemanticOverlap(a.filenameTokens, b.filenameTokens);

  const expDiff = Math.abs((a.exp || 0) - (b.exp || 0));
  const compDiff = Math.abs((a.comp || 0) - (b.comp || 0));
  const sharpDiff = Math.abs((a.sharp || 0) - (b.sharp || 0));
  const technicalSim = Math.max(0, 1 - (expDiff + compDiff + sharpDiff) / 100);

  const arA = a.aspectRatio || 1;
  const arB = b.aspectRatio || 1;
  const arSim = Math.max(0, 1 - Math.abs(arA - arB) / 0.5);

  const familyMatch = a.assetFamily === b.assetFamily ? 1 : 0;

  return (visSim * 0.45) + (semanticSim * 0.30) + (technicalSim * 0.10) + (familyMatch * 0.10) + (arSim * 0.05);
};

export const runAntiSimilarLogic = async (passedItems: UploadedImageItem[], allItems: UploadedImageItem[], mode: string) => {
  const itemsWithFeatures = await Promise.all(passedItems.map(async (item) => {
    const visualSignature = await extractVisualSignature(item.previewUrl);
    const filenameTokens = getTokens(item.name);
    return { ...item, visualSignature, filenameTokens };
  }));

  const n = itemsWithFeatures.length;
  const simMatrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    simMatrix[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const sim = calculateSimilarity(itemsWithFeatures[i], itemsWithFeatures[j]);
      simMatrix[i][j] = sim;
      simMatrix[j][i] = sim;
    }
  }

  const threshold = mode === 'strict_photorealistic' ? 0.88 : 0.84;
  const clusters: any[] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < n; i++) {
    if (assigned.has(i)) continue;
    const clusterItems = [itemsWithFeatures[i]];
    assigned.add(i);
    for (let j = i + 1; j < n; j++) {
      if (assigned.has(j)) continue;
      if (simMatrix[i][j] >= threshold) {
        clusterItems.push(itemsWithFeatures[j]);
        assigned.add(j);
      }
    }
    clusters.push({
      id: `CLU-${String(clusters.length + 1).padStart(3, '0')}`,
      items: clusterItems,
      indices: clusterItems.map(item => itemsWithFeatures.findIndex(x => x.id === item.id))
    });
  }

  let heroes = 0, alts = 0, dropped = 0;
  const finalClustersData: any[] = [];
  const updatedItems = [...allItems];

  for (const cluster of clusters) {
    const cItems = cluster.items;
    
    // Calculate Winner Score v7: Comprehensive quality ranking
    for (let i = 0; i < cItems.length; i++) {
      const idxA = cluster.indices[i];
      let maxSim = 0;
      for (let j = 0; j < cItems.length; j++) {
        if (i === j) continue;
        const idxB = cluster.indices[j];
        if (simMatrix[idxA][idxB] > maxSim) maxSim = simMatrix[idxA][idxB];
      }
      cItems[i].uniquenessScore = Math.round((1 - maxSim) * 100);
      if (cItems.length === 1) cItems[i].uniquenessScore = 100;
      
      const qc = cItems[i].qcScore || 0;
      const originality = cItems[i].originality || 0;
      const commercial = cItems[i].scores?.commercial || 0;
      const technical = cItems[i].scores?.technical || 0;
      const platform = Math.max(cItems[i].platformSuitability?.adobeStock || 0, cItems[i].platformSuitability?.shutterstock || 0);
      const uniqueness = cItems[i].uniquenessScore;
      
      // Weighting: QC (30%), Commercial (20%), Technical (20%), Originality (15%), Platform (10%), Uniqueness (5%)
      cItems[i].heroScore = (qc * 0.30) + (commercial * 0.20) + (technical * 0.20) + (originality * 0.15) + (platform * 0.10) + (uniqueness * 0.05);
    }

    const cItemsWithIdx = cItems.map((item: any, i: number) => ({ item, idx: cluster.indices[i] }));
    cItemsWithIdx.sort((a: any, b: any) => b.item.heroScore - a.item.heroScore);

    let avgSim = 0;
    if (cItemsWithIdx.length > 1) {
      let sum = 0, count = 0;
      for (let i = 0; i < cItemsWithIdx.length; i++) {
        for (let j = i + 1; j < cItemsWithIdx.length; j++) {
          sum += simMatrix[cItemsWithIdx[i].idx][cItemsWithIdx[j].idx];
          count++;
        }
      }
      avgSim = Math.round((sum / count) * 100);
    }

    const processedClusterItems = [];
    let altsInCluster = 0;

    for (let i = 0; i < cItemsWithIdx.length; i++) {
      const item = cItemsWithIdx[i].item;
      const itemIdx = cItemsWithIdx[i].idx;
      let role: 'hero' | 'alt' | 'hold' | 'drop' = 'drop';
      let duplicateRisk: DuplicateRisk = 'very low';
      let approvalReason = '';

      const similarityToHero = i === 0 ? 0 : simMatrix[itemIdx][cItemsWithIdx[0].idx];
      const semanticOverlap = i === 0 ? 0 : getSemanticOverlap(item.filenameTokens || [], cItemsWithIdx[0].item.filenameTokens || []);
      
      // Risk Scoring v7: Visual (60%) + Semantic (40%)
      const riskScore = (similarityToHero * 60) + (semanticOverlap * 40);
      
      if (riskScore >= 90) duplicateRisk = 'very high';
      else if (riskScore >= 82) duplicateRisk = 'high';
      else if (riskScore >= 60) duplicateRisk = 'medium';
      else if (riskScore >= 35) duplicateRisk = 'low';

      if (i === 0) { 
        role = 'hero'; 
        heroes++; 
        approvalReason = 'Selected as Best in Cluster due to strongest commercial and technical quality';
      } else {
        const isMeaningfullyDifferent = similarityToHero < 0.80 || semanticOverlap < 0.65;
        
        // Final Pass: Better separation of alternates vs redundant
        if (isMeaningfullyDifferent && item.qcScore >= 70 && altsInCluster < 2 && duplicateRisk !== 'high' && duplicateRisk !== 'very high') {
          role = 'alt'; 
          alts++;
          altsInCluster++;
          approvalReason = 'Kept as Backup Variation due to meaningful alternate composition';
        } else {
          role = 'drop';
          dropped++;
          approvalReason = riskScore > 85 ? 'Rejected as Too Similar to stronger cluster winner' : 'Redundant variation with low commercial distinction';
        }
      }

      const globalIdx = updatedItems.findIndex(x => x.id === item.id);
      if (globalIdx !== -1) {
        const currentItem = updatedItems[globalIdx];
        
        const refinedActionItems = (currentItem.actionItems || []).filter(a => 
          !a.includes('duplicate') && !a.includes('redundancy') && !a.includes('repetition') && !a.includes('variant') && !a.includes('Cluster')
        );
        
        const refinedQualityFlags = { 
          pass: [...(currentItem.qualityFlags?.pass || [])],
          warn: (currentItem.qualityFlags?.warn || []).filter(f => !f.includes('redundancy') && !f.includes('overlap')),
          fail: (currentItem.qualityFlags?.fail || []).filter(f => !f.includes('duplicate'))
        };

        if (duplicateRisk === 'very high' || duplicateRisk === 'high') {
          refinedQualityFlags.fail.push('High similarity to cluster winner');
        }

        // Generate final action items with role context
        const finalActionItems = generateActionItems(currentItem.verdict || 'REVIEW', refinedQualityFlags, role);

        updatedItems[globalIdx] = {
          ...currentItem,
          clusterId: cluster.id,
          clusterRank: i + 1,
          heroRank: i === 0 ? 1 : undefined,
          uniquenessScore: item.uniquenessScore,
          similarityScore: i === 0 ? 100 : Math.round(similarityToHero * 100),
          role,
          visualSignature: item.visualSignature,
          filenameTokens: item.filenameTokens,
          duplicateRisk,
          verdict: (role === 'drop' && (duplicateRisk === 'high' || duplicateRisk === 'very high')) ? 'REJECTED' : currentItem.verdict,
          status: (role === 'drop' && (duplicateRisk === 'high' || duplicateRisk === 'very high')) ? 'rejected' : currentItem.status,
          decision: (role === 'drop' && (duplicateRisk === 'high' || duplicateRisk === 'very high')) ? 'REJECT' : currentItem.decision,
          actionItems: finalActionItems,
          qualityFlags: refinedQualityFlags,
          approvalReason: approvalReason
        };
        processedClusterItems.push(updatedItems[globalIdx]);
      }
    }
    finalClustersData.push({ id: cluster.id, items: processedClusterItems, avgSimilarity: avgSim, heroId: processedClusterItems[0]?.id });
  }

  return {
    updatedItems,
    asiStats: { clusters: clusters.length, heroes, alts, held: dropped, clusters_data: finalClustersData }
  };
};
