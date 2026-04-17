import React, { useRef, useState } from 'react';
import { useAppContext } from '../store';
import { Upload, Zap, Microscope, Shield, Star, CheckCircle, Tag, Download, Archive, RotateCcw } from 'lucide-react';
import { UploadedImageItem, AssetFamily } from '../types';

export const UploadView = () => {
  const { state, setState, setMode, resetPipeline, addLog, showToast } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      showToast('⚠ No valid image files selected');
      return;
    }

    setState(s => ({ ...s, isUploading: true }));

    const newItems: UploadedImageItem[] = [];
    
    for (const file of imageFiles) {
      if (state.uploadedItems.length + newItems.length >= 1000) {
        showToast('⚠ Maximum batch size (1000) reached');
        break;
      }

      const previewUrl = URL.createObjectURL(file);
      
      const dimensions = await new Promise<{width: number, height: number}>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = previewUrl;
      });

      const fingerprint = `${file.name}-${file.size}-${file.lastModified}`;

      const isDuplicate = state.uploadedItems.some(item => item.fingerprint === fingerprint) || 
                          newItems.some(item => item.fingerprint === fingerprint);
      
      if (isDuplicate) continue;

      newItems.push({
        id: `IMG-${crypto.randomUUID().split('-')[0].toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        previewUrl,
        width: dimensions.width,
        height: dimensions.height,
        aspectRatio: dimensions.height ? dimensions.width / dimensions.height : null,
        fingerprint,
        status: 'queued',
        tags: [],
        notes: [],
        dim: `${dimensions.width}x${dimensions.height}`
      });
    }

    setState(s => {
      const updatedItems = [...s.uploadedItems, ...newItems];
      return {
        ...s,
        uploadedItems: updatedItems,
        uploaded: updatedItems.length,
        isUploading: false
      };
    });

    addLog('pass', `${newItems.length} images uploaded to ${state.batchId}`);
    showToast(`⬆ ${newItems.length} images uploaded successfully`);
  };

  const totalPages = Math.ceil(state.uploadedItems.length / state.pageSize);
  const startIndex = (state.uploadPage - 1) * state.pageSize;
  const visibleItems = state.uploadedItems.slice(startIndex, startIndex + state.pageSize);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6">
        <div className="font-mono text-lg font-bold text-slate-100 flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400"><Upload size={18} /></div>
          Upload & Curate 1K
        </div>
        <div className="text-sm text-slate-400">Accept up to 1,000 images · Batch ID creation · Preview with pagination · Ingest queue</div>
      </div>

      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all mb-6 group relative overflow-hidden ${isDragging ? 'border-cyan-400 bg-cyan-400/10' : 'border-slate-700 hover:border-cyan-400 hover:bg-cyan-400/5'}`}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          multiple 
          accept="image/*" 
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }} 
        />
        <div className="text-4xl mb-3 group-hover:scale-110 transition-transform">🗂</div>
        <div className="font-mono text-sm font-bold text-slate-200 mb-1">Drop images here or click to browse</div>
        <div className="text-xs text-slate-400 mb-4">JPG · PNG · WEBP · TIFF · max 50MB each</div>
        <div className="inline-flex font-mono text-[10px] text-slate-500 border border-slate-700 rounded px-3 py-1">MAX BATCH SIZE: 1,000 IMAGES</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold mb-4">Batch Configuration</div>
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex gap-3 items-center"><div className="font-mono text-[10px] text-slate-500 uppercase w-24 font-bold">Batch ID</div><div className="text-xs font-mono text-cyan-400">{state.batchId}</div></div>
            <div className="flex gap-3 items-center">
              <div className="font-mono text-[10px] text-slate-500 uppercase w-24 font-bold">Platform</div>
              <select className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-400 w-full max-w-xs">
                <option>Adobe Stock + Shutterstock</option>
                <option>Adobe Stock Only</option>
              </select>
            </div>
            <div className="flex gap-3 items-center">
              <div className="font-mono text-[10px] text-slate-500 uppercase w-24 font-bold">Mode</div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setMode('strict_photorealistic')}
                  className={`flex-1 p-3 rounded-lg border transition-all text-left ${state.mode === 'strict_photorealistic' ? 'bg-rose-500/10 border-rose-500 text-rose-500' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'}`}
                >
                  <div className="font-mono text-[10px] font-bold uppercase mb-1">Strict Photorealistic</div>
                  <div className="text-[9px] opacity-70">Blocks non-photo assets. High realism weights.</div>
                </button>
                <button 
                  onClick={() => setMode('all_strict')}
                  className={`flex-1 p-3 rounded-lg border transition-all text-left ${state.mode === 'all_strict' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'}`}
                >
                  <div className="font-mono text-[10px] font-bold uppercase mb-1">All Strict</div>
                  <div className="text-[9px] opacity-70">Allows mixed assets. High uniqueness weights.</div>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase font-bold mb-4">Ingest Queue Status</div>
          <div className="flex flex-col gap-2 mb-4">
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Queued</div><div className="text-xs font-mono text-cyan-400">{state.uploadedItems.length}</div></div>
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Processing</div><div className="text-xs font-mono text-amber-400">{state.isUploading ? '...' : '0'}</div></div>
            <div className="flex justify-between items-center"><div className="font-mono text-[10px] text-slate-500 uppercase font-bold">Previewed</div><div className="text-xs font-mono text-emerald-400">{state.uploadedItems.length}</div></div>
          </div>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden mb-4"><div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500" style={{width: state.uploadedItems.length > 0 ? '100%' : '0%'}}></div></div>
          {state.uploadedItems.length > 0 && (
            <button 
              onClick={resetPipeline}
              className="w-full bg-slate-800 border border-slate-700 text-slate-400 hover:border-rose-500/50 hover:text-rose-500 rounded py-1.5 text-[10px] font-bold font-mono transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw size={12} /> RESET BATCH
            </button>
          )}
        </div>
      </div>

      {state.uploadedItems.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4 mt-8">
            <div className="font-mono text-xs text-slate-400">
              Image Preview — Page {state.uploadPage} of {totalPages || 1} ({visibleItems.length}/{state.uploadedItems.length} shown)
            </div>
            <div className="flex gap-2">
              <button 
                disabled={state.uploadPage === 1}
                onClick={(e) => { e.stopPropagation(); setState(s => ({ ...s, uploadPage: s.uploadPage - 1 })) }}
                className="bg-transparent border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white rounded px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <button 
                disabled={state.uploadPage === totalPages || totalPages === 0}
                onClick={(e) => { e.stopPropagation(); setState(s => ({ ...s, uploadPage: s.uploadPage + 1 })) }}
                className="bg-transparent border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white rounded px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {visibleItems.map(img => (
              <div 
                key={img.id} 
                onClick={() => setState(s => ({ ...s, selectedImageId: img.id }))}
                className={`bg-slate-900 border rounded-lg overflow-hidden relative aspect-square cursor-pointer transition-all ${state.selectedImageId === img.id ? 'border-cyan-400 ring-1 ring-cyan-400' : 'border-slate-800 hover:border-cyan-400/50'}`}
              >
                <img src={img.previewUrl} alt={img.name} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2 flex flex-col justify-end">
                  <div className="font-mono text-[9px] text-slate-300 truncate">{img.name}</div>
                  <div className="flex justify-between items-center mt-1">
                    <div className="font-mono text-[8px] text-slate-500">{formatSize(img.size)}</div>
                    <div className="font-mono text-[8px] text-slate-500">{img.dim}</div>
                  </div>
                </div>
                <div className="absolute top-1 right-1">
                  <span className="px-1.5 py-0.5 rounded-full font-mono text-[8px] font-bold uppercase border bg-slate-800/80 text-slate-300 border-slate-600 backdrop-blur-sm">
                    {img.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const inferAssetFamily = (item: UploadedImageItem): AssetFamily => {
  const name = item.name.toLowerCase();
  const aspect = item.aspectRatio || 1;
  
  // 1. Line Art Minimal (New)
  const lineArtHints = ['line', 'lineart', 'line-art', 'continuous', 'one-line', 'outline', 'minimalist', 'minimal', 'drawing', 'sketch', 'stroke'];
  if (lineArtHints.some(t => name.includes(t))) return 'line_art_minimal';

  // 2. Icon / Sticker Sheet
  const iconHints = ['icon', 'sticker', 'sheet', 'set', 'collection', 'emoji', 'pack', 'symbols', 'batch'];
  if (iconHints.some(t => name.includes(t))) return 'icon_sticker_sheet';
  
  // 3. Vector / Flat Graphic
  const vectorHints = ['vector', 'flat', 'logo', 'graphic', 'svg', 'eps', 'ai', 'infographic', 'design'];
  if (vectorHints.some(t => name.includes(t))) return 'vector_flat_graphic';
  
  // 4. Isolated Object
  const isolatedHints = ['isolated', 'white', 'background', 'cutout', 'png', 'object', 'product', 'item', 'transparent'];
  if (isolatedHints.some(t => name.includes(t))) return 'isolated_object';
  
  // 5. Illustration
  const illustrationHints = ['illustration', 'art', 'digital', 'painting', 'rendered', '3d', 'cgi', 'anime', 'cartoon', 'concept'];
  if (illustrationHints.some(t => name.includes(t))) return 'illustration_general';
  
  // 6. Photorealistic Photo (Default for stock if no other strong hints)
  return 'photorealistic_photo';
};

export const runPreFilterLogic = (items: UploadedImageItem[], mode: string) => {
  let ready = 0;
  let invalid = 0;
  let tooSmall = 0;
  let duplicate = 0;
  let nonPhoto = 0;

  const seenFingerprints = new Set<string>();

  const updatedItems: UploadedImageItem[] = items.map(item => {
    let status: any = 'ready_for_qc';
    let reason = '';
    let isDuplicate = false;
    let isTooSmall = false;
    let isNonPhotorealistic = false;
    
    const assetFamily = inferAssetFamily(item);

    // Duplicate check
    if (seenFingerprints.has(item.fingerprint)) {
      status = 'duplicate_file';
      reason = 'Duplicate file fingerprint';
      isDuplicate = true;
      duplicate++;
    } else {
      seenFingerprints.add(item.fingerprint);
      
      // Invalid check
      if (!item.width || !item.height || !item.type.startsWith('image/')) {
        status = 'invalid';
        reason = 'Invalid image metadata or type';
        invalid++;
      } else {
        // Too small check
        const longEdge = Math.max(item.width, item.height);
        const shortEdge = Math.min(item.width, item.height);
        if (longEdge < 3000 || shortEdge < 2000) {
          status = 'too_small';
          reason = `Resolution too low (${item.width}x${item.height})`;
          isTooSmall = true;
          tooSmall++;
        } else {
          // Non-photorealistic check (heuristic)
          const nonPhotoTokens = ['vector', 'icon', 'cartoon', 'anime', 'sticker', 'logo', 'illustration', 'sketch', 'clipart'];
          const lowerName = item.name.toLowerCase();
          const hasNonPhotoHint = nonPhotoTokens.some(token => lowerName.includes(token)) || assetFamily !== 'photorealistic_photo';
          
          if (hasNonPhotoHint) {
            isNonPhotorealistic = true;
            if (mode === 'strict_photorealistic') {
              status = 'non_photorealistic';
              reason = `Strict Mode: Asset identified as ${assetFamily.replace('_', ' ')}`;
              nonPhoto++;
            } else {
              status = 'ready_for_qc';
              reason = `All Strict: ${assetFamily.replace('_', ' ')} allowed for QC`;
              ready++;
            }
          } else {
            status = 'ready_for_qc';
            reason = 'Passed all pre-filter gates';
            ready++;
          }
        }
      }
    }

    const prefilterNotes = [];
    if (isNonPhotorealistic) prefilterNotes.push(`Asset Family: ${assetFamily.replace('_', ' ')}`);
    if (isTooSmall) prefilterNotes.push('Resolution near minimum threshold');

    return {
      ...item,
      status,
      assetFamily,
      prefilterReason: reason,
      prefilterNotes,
      isDuplicate,
      isTooSmall,
      isNonPhotorealistic
    };
  });

  return {
    updatedItems,
    prefilterStats: { ready, invalid, tooSmall, duplicate, nonPhoto }
  };
};

export const PreFilterView = () => {
  const { state, setState, addLog, showToast } = useAppContext();
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const runPreFilter = () => {
    if (state.uploadedItems.length === 0) { 
      showToast('⚠ Upload images first'); 
      return; 
    }

    addLog('pass', `Pre-Filter started for ${state.uploadedItems.length} uploaded items`);
    const { updatedItems, prefilterStats } = runPreFilterLogic(state.uploadedItems, state.mode);

    setState(s => ({
      ...s,
      uploadedItems: updatedItems,
      prefiltered: prefilterStats
    }));

    addLog('pass', `Pre-Filter complete: ${prefilterStats.ready} ready, ${prefilterStats.invalid} invalid, ${prefilterStats.tooSmall} too small, ${prefilterStats.duplicate} duplicate, ${prefilterStats.nonPhoto} non-photorealistic`);
    showToast(`⚡ Pre-Filter complete: ${prefilterStats.ready} images ready for QC`);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredItems = state.uploadedItems.filter(item => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'ready') return item.status === 'ready_for_qc';
    if (activeFilter === 'invalid') return item.status === 'invalid';
    if (activeFilter === 'too_small') return item.status === 'too_small';
    if (activeFilter === 'duplicate') return item.status === 'duplicate_file';
    if (activeFilter === 'non_photo') return item.status === 'non_photorealistic';
    return true;
  });

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <div className="font-mono text-lg font-bold text-slate-100 flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400"><Zap size={18} /></div>
            Pre-Filter
          </div>
          <div className="text-sm text-slate-400">Remove invalid assets before expensive QC curation · Automatic after upload completes</div>
        </div>
        <button onClick={runPreFilter} className="bg-amber-400/10 border border-amber-500 text-amber-400 hover:bg-amber-400/20 rounded px-4 py-2 text-sm font-medium transition-colors">
          ⚡ Run Pre-Filter
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-slate-900 border-t-2 border-t-emerald-400 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Ready for QC</div>
          <div className="font-mono text-3xl font-bold text-emerald-400 mb-1">{state.prefiltered.ready}</div>
          <div className="text-xs text-slate-400">passed all gates</div>
        </div>
        <div className="bg-slate-900 border-t-2 border-t-rose-500 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Invalid / Corrupt</div>
          <div className="font-mono text-3xl font-bold text-rose-500 mb-1">{state.prefiltered.invalid}</div>
          <div className="text-xs text-slate-400">file errors</div>
        </div>
        <div className="bg-slate-900 border-t-2 border-t-amber-400 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Too Small</div>
          <div className="font-mono text-3xl font-bold text-amber-400 mb-1">{state.prefiltered.tooSmall}</div>
          <div className="text-xs text-slate-400">below min resolution</div>
        </div>
        <div className="bg-slate-900 border-t-2 border-t-rose-500 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Duplicates</div>
          <div className="font-mono text-3xl font-bold text-rose-500 mb-1">{state.prefiltered.duplicate}</div>
          <div className="text-xs text-slate-400">file hash matches</div>
        </div>
        <div className="bg-slate-900 border-t-2 border-t-purple-400 border border-slate-800 rounded-xl p-4">
          <div className="font-mono text-[10px] text-slate-500 tracking-widest uppercase mb-2">Non-Photo</div>
          <div className="font-mono text-3xl font-bold text-purple-400 mb-1">{state.prefiltered.nonPhoto}</div>
          <div className="text-xs text-slate-400">heuristic stock gate</div>
        </div>
      </div>

      {state.uploadedItems.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="border-b border-slate-800 p-4 flex gap-2 overflow-x-auto">
            <button onClick={() => setActiveFilter('all')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium whitespace-nowrap transition-colors ${activeFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}>All Items</button>
            <button onClick={() => setActiveFilter('ready')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium whitespace-nowrap transition-colors ${activeFilter === 'ready' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}>Ready ({state.prefiltered.ready})</button>
            <button onClick={() => setActiveFilter('invalid')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium whitespace-nowrap transition-colors ${activeFilter === 'invalid' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}>Invalid ({state.prefiltered.invalid})</button>
            <button onClick={() => setActiveFilter('too_small')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium whitespace-nowrap transition-colors ${activeFilter === 'too_small' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}>Too Small ({state.prefiltered.tooSmall})</button>
            <button onClick={() => setActiveFilter('duplicate')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium whitespace-nowrap transition-colors ${activeFilter === 'duplicate' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}>Duplicates ({state.prefiltered.duplicate})</button>
            <button onClick={() => setActiveFilter('non_photo')} className={`px-3 py-1.5 rounded text-xs font-mono font-medium whitespace-nowrap transition-colors ${activeFilter === 'non_photo' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}>Non-Photo ({state.prefiltered.nonPhoto})</button>
          </div>
          
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 max-h-[600px] overflow-y-auto">
            {filteredItems.map(img => (
              <div 
                key={img.id} 
                className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden relative aspect-square group"
              >
                <img src={img.previewUrl} alt={img.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-2 flex flex-col justify-end">
                  <div className="font-mono text-[9px] text-slate-300 truncate mb-0.5">{img.name}</div>
                  <div className="flex justify-between items-center mb-1">
                    <div className="font-mono text-[8px] text-slate-500">{formatSize(img.size)}</div>
                    <div className="font-mono text-[8px] text-slate-500">{img.dim}</div>
                  </div>
                  {img.prefilterReason && (
                    <div className={`font-mono text-[8px] truncate ${
                      img.status === 'ready_for_qc' ? 'text-emerald-400' : 
                      img.status === 'invalid' || img.status === 'duplicate_file' ? 'text-rose-400' : 
                      img.status === 'too_small' ? 'text-amber-400' : 'text-purple-400'
                    }`}>
                      {img.prefilterReason}
                    </div>
                  )}
                </div>
                <div className="absolute top-1 right-1">
                  <span className={`px-1.5 py-0.5 rounded-full font-mono text-[8px] font-bold uppercase border backdrop-blur-sm ${
                    img.status === 'ready_for_qc' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                    img.status === 'invalid' || img.status === 'duplicate_file' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 
                    img.status === 'too_small' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 
                    img.status === 'non_photorealistic' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                    'bg-slate-800/80 text-slate-300 border-slate-600'
                  }`}>
                    {img.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 font-mono text-sm">
                No items found in this bucket.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
