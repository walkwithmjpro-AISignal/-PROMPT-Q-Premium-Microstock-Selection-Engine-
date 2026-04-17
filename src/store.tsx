import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { AppState, UploadedImageItem, MetadataProvider, ProjectProfile } from './types';

const STORAGE_KEY_PROVIDERS = 'microstock_providers_v3';
const STORAGE_KEY_PROFILES = 'microstock_profiles_v3';
const STORAGE_KEY_QUOTA = 'microstock_quota_v3';

const initialState: AppState = {
  view: 'mission',
  mode: 'all_strict',
  batchId: 'BATCH-2026-001',
  uploaded: 0,
  prefiltered: { ready: 0, invalid: 0, tooSmall: 0, duplicate: 0, nonPhoto: 0 },
  qc: { pass: 0, fix: 0, reject: 0, strict: 0, results: [] },
  asi: { clusters: 0, heroes: 0, alts: 0, held: 0, clusters_data: [] },
  selector: { now: 0, backup: 0, fix: 0, rejected: 0, ranked: [] },
  approval: { now: [], backup: [], excluded: 0, metaReady: 0 },
  metadata: { generated: 0, items: [], dailyUsed: 0, overflow: 0 },
  metadataJob: {
    status: 'idle',
    mode: 'auto_failover',
    totalItems: 0,
    completedItems: 0,
    succeededAI: 0,
    succeededFallback: 0,
    providerSuccessCounts: { groq: 0, blackbox: 0, gemini: 0, local: 0 },
    failedItems: 0,
    currentIndex: 0,
    currentItemName: '',
    percentComplete: 0,
    resumeFromIndex: 0,
    lastError: null,
    activeProvider: null,
    activeKeyId: null,
    activeKeyLabel: null,
    activeProfileName: 'Standard Stock Profile',
    activeProfileId: 'default',
    usageHistory: [],
    startedAt: null,
    finishedAt: null,
  },
  providers: {
    groq: { apiKey: null, status: 'missing', keyPool: [], activeKeyId: null },
    blackbox: { apiKey: null, status: 'missing', keyPool: [], activeKeyId: null },
    gemini: { apiKey: null, status: 'missing', keyPool: [], activeKeyId: null },
    local: { apiKey: null, status: 'connected', keyPool: [], activeKeyId: null },
  },
  quotaGroups: [],
  providerPriority: ['groq', 'blackbox', 'gemini', 'local'],
  preferredProvider: 'groq',
  projectProfiles: [
    {
      id: 'default',
      name: 'Standard Stock Profile',
      preferredProvider: 'groq',
      preferredGroupId: null,
      preferredKeyId: null,
      fallbackOrder: ['groq', 'blackbox', 'gemini', 'local'],
      generationMode: 'auto_failover',
      notes: 'Default profile for general stock photography'
    }
  ],
  activeProfileId: 'default',
  apiKey: null,
  apiKeyStatus: 'missing',
  export: { built: false, count: 0 },
  log: [{ type: 'pass', msg: 'Microstock AI Agent PRO initialized', time: new Date().toLocaleTimeString('en-US', { hour12: false }) }],
  uploadedItems: [],
  uploadPage: 1,
  pageSize: 48,
  selectedImageId: null,
  isUploading: false,
  useAI: true,
};

interface AppContextType {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  setView: (view: string) => void;
  setMode: (mode: AppState['mode']) => void;
  isPhotorealisticMode: () => boolean;
  getModeLabel: () => string;
  resetPipeline: () => void;
  runPipeline: () => Promise<void>;
  addLog: (type: string, msg: string) => void;
  toastMsg: string | null;
  setToastMsg: (msg: string | null) => void;
  showToast: (msg: string) => void;
  updateMetadataJob: (update: Partial<AppState['metadataJob']>) => void;
  updateProviderConfig: (provider: MetadataProvider, update: Partial<AppState['providers']['gemini']>) => void;
  setApiKey: (key: string | null) => void;
  addKeyToPool: (provider: MetadataProvider, key: string, label?: string) => void;
  removeKeyFromPool: (provider: MetadataProvider, keyId: string) => void;
  toggleKeyInPool: (provider: MetadataProvider, keyId: string) => void;
  updateKeyInPool: (provider: MetadataProvider, keyId: string, update: Partial<AppState['providers']['gemini']['keyPool'][0]>) => void;
  addQuotaGroup: (group: Omit<AppState['quotaGroups'][0], 'id'>) => void;
  removeQuotaGroup: (id: string) => void;
  updateQuotaGroup: (id: string, update: Partial<AppState['quotaGroups'][0]>) => void;
  assignKeyToGroup: (provider: MetadataProvider, keyId: string, groupId: string | null) => void;
  addProjectProfile: (profile: Omit<ProjectProfile, 'id'>) => void;
  removeProjectProfile: (id: string) => void;
  setActiveProfile: (id: string) => void;
  updateProjectProfile: (id: string, update: Partial<ProjectProfile>) => void;
  replaceKeyPool: (provider: MetadataProvider, keys: { key: string, label: string, isEnabled: boolean }[]) => void;
  clearAllKeys: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const getInitialState = (): AppState => {
  try {
    const savedProviders = localStorage.getItem(STORAGE_KEY_PROVIDERS);
    const savedProfiles = localStorage.getItem(STORAGE_KEY_PROFILES);
    const savedQuota = localStorage.getItem(STORAGE_KEY_QUOTA);

    return {
      ...initialState,
      providers: savedProviders ? JSON.parse(savedProviders) : initialState.providers,
      projectProfiles: savedProfiles ? JSON.parse(savedProfiles) : initialState.projectProfiles,
      quotaGroups: savedQuota ? JSON.parse(savedQuota) : initialState.quotaGroups,
    };
  } catch (e) {
    console.error('Failed to load state from localStorage', e);
    return initialState;
  }
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>(getInitialState);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(state.providers));
    localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(state.projectProfiles));
    localStorage.setItem(STORAGE_KEY_QUOTA, JSON.stringify(state.quotaGroups));
  }, [state.providers, state.projectProfiles, state.quotaGroups]);

  const setView = (view: string) => setState(s => ({ ...s, view }));
  
  const isPhotorealisticMode = () => state.mode === 'strict_photorealistic';
  const getModeLabel = () => state.mode === 'strict_photorealistic' ? 'Strict Photorealistic' : 'All Strict';

  const setMode = (mode: AppState['mode']) => {
    setState(s => ({ ...s, mode }));
    addLog('info', `Pipeline mode switched to: ${mode === 'strict_photorealistic' ? 'Strict Photorealistic' : 'All Strict'}`);
  };

  const resetPipeline = () => {
    state.uploadedItems.forEach(item => {
      if (item.previewUrl && !item.previewUrl.startsWith('http')) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });

    setState(s => ({
      ...initialState,
      providers: s.providers,
      projectProfiles: s.projectProfiles,
      quotaGroups: s.quotaGroups,
      mode: s.mode, // Preserve selected mode
      view: 'upload', // Always return to upload
      log: [{ type: 'pass', msg: 'Pipeline reset · Batch cleared · Ready for new upload', time: new Date().toLocaleTimeString('en-US', { hour12: false }) }, ...s.log].slice(0, 20)
    }));
    showToast('↺ Pipeline reset — ready for new batch');
  };

  const addLog = (type: string, msg: string) => {
    setState(s => ({
      ...s,
      log: [{ type, msg, time: new Date().toLocaleTimeString('en-US', { hour12: false }) }, ...s.log].slice(0, 20)
    }));
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const updateMetadataJob = (update: Partial<AppState['metadataJob']>) => {
    setState(s => ({
      ...s,
      metadataJob: { ...s.metadataJob, ...update }
    }));
  };

  const updateProviderConfig = (provider: MetadataProvider, update: Partial<AppState['providers']['gemini']>) => {
    setState(s => ({
      ...s,
      providers: {
        ...s.providers,
        [provider]: { ...s.providers[provider], ...update }
      }
    }));
  };

  const setApiKey = (key: string | null) => {
    setState(s => ({ ...s, apiKey: key }));
  };

  const addKeyToPool = (provider: MetadataProvider, key: string, label?: string) => {
    setState(s => {
      const config = s.providers[provider];
      const existingPool = config.keyPool || [];
      if (existingPool.some(k => k.key === key)) return s;

      const newKey = {
        id: Math.random().toString(36).substr(2, 9),
        key,
        label: label || `Key ${existingPool.length + 1}`,
        status: 'unknown' as const,
        isEnabled: true,
        successCount: 0,
        failureCount: 0,
        healthScore: 100
      };

      const newPool = [...existingPool, newKey];
      return {
        ...s,
        providers: {
          ...s.providers,
          [provider]: {
            ...config,
            keyPool: newPool,
            activeKeyId: config.activeKeyId || newKey.id
          }
        }
      };
    });
  };

  const replaceKeyPool = (provider: MetadataProvider, keys: { key: string, label: string, isEnabled: boolean }[]) => {
    setState(s => {
      const config = s.providers[provider];
      const newPool = keys.map(k => ({
        id: Math.random().toString(36).substr(2, 9),
        key: k.key,
        label: k.label,
        status: 'unknown' as const,
        isEnabled: k.isEnabled,
        successCount: 0,
        failureCount: 0,
        healthScore: 100
      }));

      return {
        ...s,
        providers: {
          ...s.providers,
          [provider]: {
            ...config,
            keyPool: newPool,
            activeKeyId: newPool.length > 0 ? newPool[0].id : null
          }
        }
      };
    });
  };

  const removeKeyFromPool = (provider: MetadataProvider, keyId: string) => {
    setState(s => {
      const config = s.providers[provider];
      const newPool = config.keyPool.filter(k => k.id !== keyId);
      let newActiveId = config.activeKeyId;
      if (newActiveId === keyId) {
        newActiveId = newPool.length > 0 ? newPool[0].id : null;
      }
      return {
        ...s,
        providers: {
          ...s.providers,
          [provider]: {
            ...config,
            keyPool: newPool,
            activeKeyId: newActiveId
          }
        }
      };
    });
  };

  const toggleKeyInPool = (provider: MetadataProvider, keyId: string) => {
    setState(s => {
      const config = s.providers[provider];
      const newPool = config.keyPool.map(k => 
        k.id === keyId ? { ...k, isEnabled: !k.isEnabled } : k
      );
      return {
        ...s,
        providers: {
          ...s.providers,
          [provider]: { ...config, keyPool: newPool }
        }
      };
    });
  };

  const updateKeyInPool = (provider: MetadataProvider, keyId: string, update: any) => {
    setState(s => {
      const config = s.providers[provider];
      const newPool = config.keyPool.map(k => 
        k.id === keyId ? { ...k, ...update } : k
      );
      return {
        ...s,
        providers: {
          ...s.providers,
          [provider]: { ...config, keyPool: newPool }
        }
      };
    });
  };

  const addQuotaGroup = (group: any) => {
    setState(s => ({
      ...s,
      quotaGroups: [...s.quotaGroups, { ...group, id: Math.random().toString(36).substr(2, 9) }]
    }));
  };

  const removeQuotaGroup = (id: string) => {
    setState(s => ({
      ...s,
      quotaGroups: s.quotaGroups.filter(g => g.id !== id),
      providers: Object.keys(s.providers).reduce((acc, p) => {
        const provider = p as MetadataProvider;
        acc[provider] = {
          ...s.providers[provider],
          keyPool: s.providers[provider].keyPool.map(k => 
            k.identityGroupId === id ? { ...k, identityGroupId: null } : k
          )
        };
        return acc;
      }, {} as any)
    }));
  };

  const updateQuotaGroup = (id: string, update: any) => {
    setState(s => ({
      ...s,
      quotaGroups: s.quotaGroups.map(g => g.id === id ? { ...g, ...update } : g)
    }));
  };

  const assignKeyToGroup = (provider: MetadataProvider, keyId: string, groupId: string | null) => {
    setState(s => {
      const config = s.providers[provider];
      const newPool = config.keyPool.map(k => 
        k.id === keyId ? { ...k, identityGroupId: groupId } : k
      );
      return {
        ...s,
        providers: {
          ...s.providers,
          [provider]: { ...config, keyPool: newPool }
        }
      };
    });
  };

  const addProjectProfile = (profile: Omit<ProjectProfile, 'id'>) => {
    setState(s => {
      const newProfile = { ...profile, id: Math.random().toString(36).substr(2, 9) };
      return { ...s, projectProfiles: [...s.projectProfiles, newProfile] };
    });
    showToast(`✅ Profile "${profile.name}" created`);
  };

  const removeProjectProfile = (id: string) => {
    setState(s => {
      if (id === 'default') return s;
      const newProfiles = s.projectProfiles.filter(p => p.id !== id);
      const newActiveId = s.activeProfileId === id ? 'default' : s.activeProfileId;
      return { ...s, projectProfiles: newProfiles, activeProfileId: newActiveId };
    });
  };

  const setActiveProfile = (id: string) => {
    setState(s => {
      const profile = s.projectProfiles.find(p => p.id === id);
      if (!profile) return s;
      return { 
        ...s, 
        activeProfileId: id,
        preferredProvider: profile.preferredProvider,
        providerPriority: profile.fallbackOrder,
        providers: {
          ...s.providers,
          [profile.preferredProvider]: {
            ...s.providers[profile.preferredProvider],
            activeKeyId: profile.preferredKeyId || s.providers[profile.preferredProvider].activeKeyId
          }
        },
        metadataJob: { 
          ...s.metadataJob, 
          mode: profile.generationMode, 
          activeProfileName: profile.name,
          activeProfileId: id
        }
      };
    });
    showToast(`📁 Switched to profile`);
  };

  const updateProjectProfile = (id: string, update: Partial<ProjectProfile>) => {
    setState(s => ({
      ...s,
      projectProfiles: s.projectProfiles.map(p => p.id === id ? { ...p, ...update } : p)
    }));
  };

  const clearAllKeys = () => {
    setState(s => ({
      ...s,
      providers: {
        groq: { ...s.providers.groq, keyPool: [], activeKeyId: null },
        blackbox: { ...s.providers.blackbox, keyPool: [], activeKeyId: null },
        gemini: { ...s.providers.gemini, keyPool: [], activeKeyId: null },
        local: { ...s.providers.local, keyPool: [], activeKeyId: null },
      },
      quotaGroups: []
    }));
    showToast('🗑 All keys and quota groups cleared');
  };

  const runPipeline = async () => {
    if (state.uploadedItems.length === 0) {
      showToast('⚠ No images uploaded');
      setView('upload');
      return;
    }

    // F. If everything is already complete
    if (state.export.built && state.metadata.generated > 0) {
      addLog('info', 'Pipeline already complete. Navigating to Export.');
      showToast('✅ Pipeline complete');
      setView('export');
      return;
    }

    addLog('info', '🚀 Starting One-Click Pipeline Orchestrator...');
    showToast('🚀 Starting Automated Pipeline...');

    try {
      let currentItems = [...state.uploadedItems];
      let currentPrefiltered = { ...state.prefiltered };
      let currentQC = { ...state.qc };
      let currentASI = { ...state.asi };
      let currentSelector = { ...state.selector };
      let currentApproval = { ...state.approval };
      let currentMetadata = { ...state.metadata };
      let currentExport = { ...state.export };

      // A. If uploaded items exist but prefilter has not run
      const hasPrefilterRun = currentItems.some(i => i.status !== 'queued');
      if (!hasPrefilterRun) {
        addLog('info', 'Step 1: Running Pre-Filter...');
        const { runPreFilterLogic } = await import('./views/AllViews');
        const result = runPreFilterLogic(currentItems, state.mode);
        currentItems = result.updatedItems;
        currentPrefiltered = result.prefilterStats;
        addLog('pass', `Pre-Filter complete: ${currentPrefiltered.ready} ready`);
      }

      // B. If prefilter is done but QC has not run
      const hasQCRun = currentQC.pass + currentQC.fix + currentQC.reject > 0;
      if (!hasQCRun) {
        addLog('info', 'Step 2: Running Technical QC...');
        const { runQC } = await import('./views/QCAndAntiSimilar');
        const readyForQC = currentItems.filter(i => i.status === 'ready_for_qc');
        if (readyForQC.length === 0) {
          addLog('warn', 'Pipeline stopped: No assets passed Pre-Filter');
          showToast('⚠ No assets passed Pre-Filter');
          setState(s => ({ ...s, uploadedItems: currentItems, prefiltered: currentPrefiltered }));
          return;
        }
        const result = await runQC(readyForQC, currentItems, state.mode);
        currentItems = result.updatedItems;
        currentQC = result.qcStats;
        addLog('pass', `QC complete: ${currentQC.pass} passed`);
      }

      // C. If QC is done but no selectedAfterQC items exist
      const selectedAfterQC = currentItems.filter(i => i.selectedAfterQC);
      if (selectedAfterQC.length === 0) {
        addLog('warn', 'Manual QC review required before downstream run');
        showToast('⚠ Manual QC review required');
        setState(s => ({ ...s, uploadedItems: currentItems, prefiltered: currentPrefiltered, qc: currentQC, view: 'qc' }));
        return;
      }

      // D. If selectedAfterQC items exist -> run real Anti Similar, Selector, Metadata, Export
      
      // Run Anti Similar
      addLog('info', 'Step 3: Running Anti-Similar Clustering...');
      const { runAntiSimilarLogic } = await import('./views/QCAndAntiSimilar');
      const asiResult = await runAntiSimilarLogic(selectedAfterQC, currentItems, state.mode);
      currentItems = asiResult.updatedItems;
      currentASI = asiResult.asiStats;
      addLog('pass', `ASI complete: ${currentASI.heroes} heroes selected`);

      // Run Best Selector
      addLog('info', 'Step 4: Running Best Selector & Approval...');
      const { runSelectorLogic } = await import('./views/SelectorAndApproval');
      const selectorResult = runSelectorLogic(selectedAfterQC, currentItems, state.mode);
      currentItems = selectorResult.updatedItems;
      currentSelector = selectorResult.selectorStats;
      currentApproval = selectorResult.approvalStats;
      addLog('pass', `Selector complete: ${currentSelector.now} approved now`);

      // Generate Metadata
      addLog('info', `Step 5: Generating Metadata SEO (${state.useAI ? 'GEMINI' : 'Rule-based'})...`);
      const { processMetadataForItem } = await import('./views/MetaAndExport');
      
      const eligibleForMeta = currentItems.filter(i => i.metaReady);
      
      const availableSlots = Math.max(0, 500 - currentMetadata.dailyUsed);
      const itemsToProcess = eligibleForMeta.slice(0, availableSlots);
      
      const generatedItems: UploadedImageItem[] = [];

      for (const img of itemsToProcess) {
        const { result } = await processMetadataForItem(img, state.metadataJob.mode, state);
        generatedItems.push({ ...img, ...result });
      }

      generatedItems.forEach(genItem => {
        const idx = currentItems.findIndex(i => i.id === genItem.id);
        if (idx !== -1) currentItems[idx] = genItem;
      });

      // Update metadata items list
      const existingMetaItems = [...currentMetadata.items];
      generatedItems.forEach(genItem => {
        const existingIdx = existingMetaItems.findIndex(i => i.id === genItem.id);
        if (existingIdx !== -1) existingMetaItems[existingIdx] = genItem;
        else existingMetaItems.push(genItem);
      });
      
      currentMetadata = {
        ...currentMetadata,
        generated: existingMetaItems.length,
        items: existingMetaItems,
        dailyUsed: existingMetaItems.length,
        overflow: Math.max(0, eligibleForMeta.length - availableSlots)
      };
      addLog('pass', `Metadata generated: ${generatedItems.length} records`);

      // E. Build Export
      addLog('info', 'Step 6: Building Export Package...');
      currentExport = { built: true, count: currentMetadata.generated };
      addLog('pass', `Export package built: ${currentExport.count} records`);

      // Final State Update
      setState(s => ({
        ...s,
        uploadedItems: currentItems,
        prefiltered: currentPrefiltered,
        qc: currentQC,
        asi: currentASI,
        selector: currentSelector,
        approval: currentApproval,
        metadata: currentMetadata,
        export: currentExport,
        view: 'export'
      }));

      addLog('pass', '✅ Pipeline Complete: All stages finished');
      showToast('✅ Pipeline complete');

    } catch (error) {
      console.error('Pipeline Error:', error);
      addLog('error', `Pipeline failed: ${error instanceof Error ? error.message : String(error)}`);
      showToast('❌ Pipeline failed — check logs');
    }
  };

  return (
    <AppContext.Provider value={{ 
      state, 
      setState, 
      setView, 
      setMode, 
      isPhotorealisticMode, 
      getModeLabel, 
      resetPipeline, 
      runPipeline, 
      addLog, 
      toastMsg, 
      setToastMsg, 
      showToast,
      updateMetadataJob,
      updateProviderConfig,
      setApiKey,
      addKeyToPool,
      removeKeyFromPool,
      toggleKeyInPool,
      updateKeyInPool,
      addProjectProfile,
      removeProjectProfile,
      setActiveProfile,
      updateProjectProfile,
      addQuotaGroup,
      removeQuotaGroup,
      updateQuotaGroup,
      assignKeyToGroup,
      replaceKeyPool,
      clearAllKeys
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
