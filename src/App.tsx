/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useAppContext } from './store';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { PipelineBar } from './components/PipelineBar';
import { MissionControl } from './views/MissionControl';
import { UploadView, PreFilterView } from './views/AllViews';
import { QCCenterView, AntiSimilarView } from './views/QCAndAntiSimilar';
import { BestSelectorView, ApprovalQueueView } from './views/SelectorAndApproval';
import { MetadataSEOView, DailyExportView } from './views/MetaAndExport';
import { PromptCalendarView } from './views/PromptCalendarView';
import { ArchiveView } from './views/Archive';

const MainContent = () => {
  const { state, toastMsg } = useAppContext();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-200 font-sans selection:bg-cyan-400/30">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <Topbar />
        <PipelineBar />
        <main className="flex-1 overflow-y-auto p-6">
          {state.view === 'mission' && <MissionControl />}
          {state.view === 'prompt_calendar' && <PromptCalendarView />}
          {state.view === 'upload' && <UploadView />}
          {state.view === 'prefilter' && <PreFilterView />}
          {state.view === 'qc' && <QCCenterView />}
          {state.view === 'antisimilar' && <AntiSimilarView />}
          {state.view === 'selector' && <BestSelectorView />}
          {state.view === 'approval' && <ApprovalQueueView />}
          {state.view === 'metadata' && <MetadataSEOView />}
          {state.view === 'export' && <DailyExportView />}
          {state.view === 'archive' && <ArchiveView />}
        </main>
      </div>
      
      {/* Toast */}
      <div className={`fixed bottom-6 right-6 bg-slate-800 border border-cyan-500 rounded-lg px-4 py-3 font-mono text-xs text-cyan-400 shadow-[0_4px_20px_rgba(0,212,255,0.2)] max-w-sm transition-all duration-300 transform ${toastMsg ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'} z-[9999]`}>
        {toastMsg}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
