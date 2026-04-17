import React from 'react';
import { useAppContext } from '../store';
import { ChevronRight } from 'lucide-react';

export const PipelineBar = () => {
  const { state, setView } = useAppContext();

  const steps = [
    { id: 'upload', label: 'UPLOAD', done: state.uploaded > 0 },
    { id: 'prefilter', label: 'PRE-FILTER', done: state.prefiltered.ready > 0 },
    { id: 'qc', label: 'QC CENTER', done: state.qc.pass > 0 },
    { id: 'antisimilar', label: 'ANTI SIMILAR', done: state.asi.clusters > 0 },
    { id: 'selector', label: 'BEST SELECTOR', done: state.selector.now > 0 },
    { id: 'approval', label: 'APPROVAL QUEUE', done: state.approval.metaReady > 0 },
    { id: 'metadata', label: 'METADATA SEO', done: state.metadata.generated > 0 },
    { id: 'export', label: 'DAILY EXPORT', done: state.export.built },
    { id: 'archive', label: 'ARCHIVE', done: false },
  ];

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-6 h-10 flex items-center overflow-x-auto flex-shrink-0 no-scrollbar">
      {steps.map((step, i) => {
        const isActive = state.view === step.id;
        const isDone = step.done;
        return (
          <React.Fragment key={step.id}>
            <div 
              onClick={() => setView(step.id)}
              className={`flex items-center cursor-pointer flex-shrink-0 font-mono text-[10px] font-bold px-2.5 py-1 rounded transition-colors whitespace-nowrap
                ${isActive ? 'text-cyan-400 bg-cyan-400/10' : isDone ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-500 hover:text-slate-400'}`}
            >
              {step.label}
            </div>
            {i < steps.length - 1 && (
              <ChevronRight size={14} className={`mx-1 flex-shrink-0 ${isDone ? 'text-emerald-400' : isActive ? 'text-cyan-400' : 'text-slate-700'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
