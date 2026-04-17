import React, { useState, useEffect } from 'react';
import { Calendar, Target, PlusSquare, Image, RefreshCw, Copy, CheckCircle, Tag, TrendingUp, Filter, BarChart, ShoppingBag, Search, Compass, BookOpen, Layers, Lightbulb, Map, Wand2, X, ChevronDown, ChevronRight, Check, Settings } from 'lucide-react';
import { AssetFormat, MarketPriority, CalendarEvent, GeneratedPrompt } from '../types';
import { getRelevantEvents, generatePrompts, getAllEvents } from '../services/calendarEngine';
import { useAppContext } from '../store';

const ASSET_GROUPS = [
  {
    name: 'SINGLE ASSET',
    formats: ['Object', 'Photorealistic', 'Sticker', 'Icon', 'Vector'] as AssetFormat[]
  },
  {
    name: 'STICKER GRID',
    formats: ['Sticker - Grid 1x1', 'Sticker - Grid 3x3', 'Sticker - Grid 4x4'] as AssetFormat[]
  },
  {
    name: 'ICON GRID',
    formats: ['Icon - Grid 1x1', 'Icon - Grid 3x3', 'Icon - Grid 4x4'] as AssetFormat[]
  },
  {
    name: 'VECTOR GRID',
    formats: ['Vector - Grid 1x1', 'Vector - Grid 3x3', 'Vector - Grid 4x4'] as AssetFormat[]
  }
];

const MARKETS = [
  'Global', 'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Australia', 'Japan', 'South Korea'
];

const MARKET_MAP: Record<string, MarketPriority> = {
  'Global': 'GLOBAL',
  'United States': 'US',
  'Canada': 'CA',
  'United Kingdom': 'GB',
  'Germany': 'DE',
  'France': 'FR',
  'Australia': 'AU',
  'Japan': 'JP',
  'South Korea': 'KR'
};

const TIME_RANGES = [
  'Today', 'This Week', 'This Month', 
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 
  'All Year'
];

const MANUAL_MODES = [
  { id: 'researcher', label: 'Trend Researcher' },
  { id: 'niche', label: 'Niche Finder' },
  { id: 'planner', label: 'Content Planner' },
  { id: 'holiday', label: 'Holiday Browser' }
];

type EngineMode = 'auto' | 'researcher' | 'niche' | 'planner' | 'holiday';
export type SelectionStyle = 'Chips' | 'Radio' | 'Checkbox' | 'Toggle';

export const PromptCalendarView = () => {
  const { showToast } = useAppContext();
  
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Global State
  const [selectedFormat, setSelectedFormat] = useState<AssetFormat>('Sticker');
  const [activeMode, setActiveMode] = useState<EngineMode>('researcher'); // Changed default per instructions
  const [timeRange, setTimeRange] = useState<string>('This Month');
  const [marketFocus, setMarketFocus] = useState<string[]>(['Global']);
  
  const [selectionStyle, setSelectionStyle] = useState<SelectionStyle>(() => {
    return (localStorage.getItem('prompt_cal_style') as SelectionStyle) || 'Chips';
  });

  useEffect(() => {
    localStorage.setItem('prompt_cal_style', selectionStyle);
  }, [selectionStyle]);

  // Toggles State
  const [autoFillActive, setAutoFillActive] = useState(true);
  const [todayTrendFirst, setTodayTrendFirst] = useState(false);
  const [strictGridRules, setStrictGridRules] = useState(true);
  const [dailyWorkflow, setDailyWorkflow] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copyNegativePrompt, setCopyNegativePrompt] = useState(true);

  const [activeEvents, setActiveEvents] = useState<CalendarEvent[]>([]);
  const [generatedPrompts, setGeneratedPrompts] = useState<GeneratedPrompt[]>([]);

  // Trend Researcher / Niche Finder State
  const [trendInput, setTrendInput] = useState('');
  const [nicheInput, setNicheInput] = useState('');

  useEffect(() => {
    refreshEvents();
  }, [timeRange, todayTrendFirst]);

  const refreshEvents = () => {
    const today = new Date();
    let lookahead = 30; // default This Month
    if (timeRange === 'Today') lookahead = 1;
    else if (timeRange === 'This Week') lookahead = 7;
    else if (timeRange === 'All Year') lookahead = 365;
    else if (['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].includes(timeRange)) {
        lookahead = 365;
    }
    
    if (todayTrendFirst && timeRange === 'Today') lookahead = 1;

    const events = getRelevantEvents(today, lookahead);
    setActiveEvents(events);
  };

  const copyToClipboard = (prompt: GeneratedPrompt) => {
    const text = copyNegativePrompt ? `${prompt.mainPrompt} --no ${prompt.negativePrompt}` : prompt.mainPrompt;
    navigator.clipboard.writeText(text);
    setCopiedId(prompt.id);
    showToast('✅ Prompt copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    if (generatedPrompts.length === 0) {
      showToast('❌ No generated prompts to copy');
      return;
    }
    const textToCopy = generatedPrompts.map((p, i) => {
      const typeParts = p.assetFormat.split(' - ');
      const assetType = typeParts[0];
      const grid = typeParts[1] || 'None';
      
      const negPart = copyNegativePrompt ? `\nNegative Prompt: ${p.negativePrompt}` : '';

      return `[Prompt ${i + 1}]
Title: ${p.promptTitle}
Asset Type: ${assetType}
Grid: ${grid}
Theme: ${p.theme}
Main Prompt: ${p.mainPrompt}${negPart}`;
    }).join('\n\n');
    navigator.clipboard.writeText(textToCopy);
    showToast(`✅ Copied ${generatedPrompts.length} prompts to clipboard`);
  };

  const getFilteredEvents = () => {
    const focuses = marketFocus.map(mf => MARKET_MAP[mf] || 'GLOBAL');
    return activeEvents.filter(ev => 
      focuses.includes('GLOBAL') || 
      ev.regions.includes('GLOBAL') || 
      focuses.some(f => ev.regions.includes(f))
    );
  };

  const handleGenerateBatch = () => {
    const filteredEvents = getFilteredEvents();
    const topEvent = filteredEvents[0];
    
    if (!topEvent) {
      showToast('❌ No events match the selected market focus');
      return;
    }

    const primaryMarket = marketFocus[0] ? (MARKET_MAP[marketFocus[0]] || 'GLOBAL') : 'GLOBAL';
    const prompts = generatePrompts(topEvent, selectedFormat, primaryMarket, 10);
    setGeneratedPrompts(prompts);
    setActiveMode('auto');
    showToast(`✅ Generated ${prompts.length} high-priority prompts`);
  };

  const handleGeneratePrompt = () => {
    if (activeMode === 'researcher') {
      handleTrendResearch();
    } else if (activeMode === 'niche') {
      handleNicheFinder();
    } else {
      const filteredEvents = getFilteredEvents();
      const topEvent = filteredEvents[0];
      if (topEvent) {
        const primaryMarket = marketFocus[0] ? (MARKET_MAP[marketFocus[0]] || 'GLOBAL') : 'GLOBAL';
        const prompts = generatePrompts(topEvent, selectedFormat, primaryMarket, 10);
        setGeneratedPrompts(prompts);
        showToast(`✅ Generated 10 prompts for ${topEvent.eventName}`);
      } else {
        showToast('❌ No events available to generate prompts');
      }
    }
  };

  const handleManualEventAction = (ev: CalendarEvent) => {
    const primaryMarket = marketFocus[0] ? (MARKET_MAP[marketFocus[0]] || 'GLOBAL') : 'GLOBAL';
    const freshPrompts = generatePrompts(ev, selectedFormat, primaryMarket, 10);
    setGeneratedPrompts(freshPrompts);
    setActiveMode('auto');
    showToast(`✅ Generated 10 prompts for ${ev.eventName}`);
  };

  const handleTrendResearch = () => {
    let inputToUse = trendInput.trim();
    if (!inputToUse) {
      if (!autoFillActive) {
        showToast('❌ Auto Fill is fully disabled. Please enter a trend.');
        return;
      }
      const topEvent = getFilteredEvents()[0];
      if (topEvent) {
        inputToUse = topEvent.eventName;
        setTrendInput(inputToUse);
        showToast(`✨ Auto-filled with current trend: ${inputToUse}`);
      } else {
        showToast('❌ Please enter a trend or theme');
        return;
      }
    }
    const syntheticEvent: CalendarEvent = {
      id: `manual_${Date.now()}`,
      eventName: inputToUse,
      dateStart: '01-01', dateEnd: '12-31', eventType: 'evergreen', regions: ['GLOBAL'],
      priorityScore: 7, commercialStrength: 8,
      assetFamilySuitability: ['Photorealistic', 'Vector', 'Sticker', 'Icon', 'Object'],
      notes: `Manual trend research for ${inputToUse}`,
      tags: [inputToUse.toLowerCase().replace(/\s+/g, ''), 'trend', 'commercial']
    };

    const primaryMarket = marketFocus[0] ? (MARKET_MAP[marketFocus[0]] || 'GLOBAL') : 'GLOBAL';
    const results = generatePrompts(syntheticEvent, selectedFormat, primaryMarket, 10);
    setGeneratedPrompts(results);
    setActiveMode('researcher');
    showToast(`✅ Explored 10 commercial angles for "${inputToUse}"`);
  };

  const handleNicheFinder = () => {
    let inputToUse = nicheInput.trim();
    if (!inputToUse) {
      if (!autoFillActive) {
        showToast('❌ Auto Fill is fully disabled. Please enter a niche.');
        return;
      }
      const topEvent = getFilteredEvents()[0];
      if (topEvent) {
        inputToUse = topEvent.eventName;
        setNicheInput(inputToUse);
        showToast(`✨ Auto-filled with current niche opportunity: ${inputToUse}`);
      } else {
        showToast('❌ Please enter a broad niche to analyze');
        return;
      }
    }
    const niches = [
      `Minimalist ${inputToUse}`,
      `${inputToUse} for Professionals`,
      `Playful & Cute ${inputToUse}`,
      `Abstract ${inputToUse} Concepts`
    ];

    let results: GeneratedPrompt[] = [];
    const primaryMarket = marketFocus[0] ? (MARKET_MAP[marketFocus[0]] || 'GLOBAL') : 'GLOBAL';
    niches.forEach((nicheName, i) => {
      const syntheticEvent: CalendarEvent = {
        id: `niche_${Date.now()}_${i}`,
        eventName: nicheName,
        dateStart: '01-01', dateEnd: '12-31', eventType: 'evergreen', regions: ['GLOBAL'],
        priorityScore: 8, commercialStrength: 9,
        assetFamilySuitability: ['Vector', 'Object', 'Icon', 'Photorealistic', 'Sticker'],
        notes: `Niche breakout angle focused on commercial sub-themes of ${inputToUse}.`,
        tags: [inputToUse.toLowerCase(), 'niche', 'collection']
      };
      results.push(...generatePrompts(syntheticEvent, selectedFormat, primaryMarket, 3));
    });

    const finalResults = results.slice(0, 10);
    setGeneratedPrompts(finalResults);
    setActiveMode('niche');
    showToast(`✅ Discovered ${finalResults.length} micro-niches for "${inputToUse}"`);
  };

  const handleClear = () => {
    setTrendInput('');
    setNicheInput('');
    setGeneratedPrompts([]);
    showToast('✨ Cleared inputs and results');
  };

  const renderPromptCard = (prompt: GeneratedPrompt) => (
    <div key={prompt.id} className="bg-slate-900 border border-indigo-500/20 rounded-xl overflow-hidden group mb-4 shadow-sm hover:shadow-indigo-500/10 transition-shadow">
      <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center">
        <div>
          <div className="text-sm font-bold text-slate-200">{prompt.promptTitle}</div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            <span className="text-indigo-400 uppercase">{prompt.assetFormat}</span> · {prompt.dateRelevance}
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded">
          <TrendingUp size={12} className="text-emerald-400" />
          <span className="text-[10px] font-bold text-emerald-400 tracking-wide uppercase">Priority {prompt.priorityScore}</span>
        </div>
      </div>
      
      <div className="p-5">
        <div className="mb-5">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-2 flex items-center justify-between">
            <span>Generation Prompt</span>
            <button onClick={() => copyToClipboard(prompt)} className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors">
              {copiedId === prompt.id ? <CheckCircle size={12} /> : <Copy size={12} />} {copiedId === prompt.id ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-sm text-slate-300 leading-relaxed font-serif shadow-inner">
            {prompt.mainPrompt}
          </div>
        </div>
        <div className="mb-5">
          <div className="text-[10px] text-slate-500 uppercase font-bold mb-2 flex items-center justify-between">
             <span>Negative Prompt & Constraints</span>
             {!copyNegativePrompt && <span className="text-[9px] text-rose-500 italic lowercase tracking-tight">(Excluded from Copy)</span>}
          </div>
          <div className="text-xs text-rose-400 bg-rose-500/5 p-3 rounded-lg border border-rose-500/10 italic">
            {prompt.negativePrompt}
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 pt-4 border-t border-slate-800/50">
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1.5">Commercial Angle</div>
            <div className="text-xs text-slate-400 leading-relaxed">{prompt.commercialAngle}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1.5">Stock Metadata Keywords</div>
            <div className="flex flex-wrap gap-1.5">
              {prompt.keywords.map((k, idx) => (
                <span key={idx} className="text-[9px] bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded border border-slate-700/50">{k}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const getFilteredEventsForPlanners = (isHoliday: boolean) => {
    const all = getAllEvents();
    let filtered = all;

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let selectedMonthIndex = -1;
    if (months.includes(timeRange)) {
      selectedMonthIndex = months.indexOf(timeRange);
    }
    
    if (selectedMonthIndex !== -1) {
      filtered = all.filter(e => {
        if (e.eventType === 'evergreen') return true;
        const [m] = e.dateStart.split('-');
        return parseInt(m, 10) === selectedMonthIndex + 1;
      });
    }

    if (!isHoliday) {
       return filtered.filter(e => e.eventType !== 'evergreen' || (e.eventType==='evergreen' && Math.random() > 0.5)).slice(0, 10);
    }

    return filtered;
  };

  const renderHolidayCalendar = () => {
    const filtered = getFilteredEventsForPlanners(true);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filtered.map(ev => (
            <div key={ev.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col justify-between group hover:border-slate-700 transition-colors">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="font-bold text-slate-200 text-sm">{ev.eventName}</div>
                  <div className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase font-bold tracking-wide ${ev.eventType === 'evergreen' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {ev.eventType === 'evergreen' ? 'Evergreen' : `${ev.dateStart} - ${ev.dateEnd}`}
                  </div>
                </div>
                <div className="text-xs text-slate-400 mb-4 line-clamp-2 leading-relaxed">{ev.notes}</div>
              </div>
              <button 
                onClick={() => handleManualEventAction(ev)}
                className="w-full mt-auto py-2.5 bg-slate-800 hover:bg-indigo-500 hover:border-indigo-500 hover:text-white text-slate-300 transition-colors border border-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-2 group-hover:shadow-md"
              >
                <PlusSquare size={14} /> Send to Auto Gen
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderContentPlanner = () => {
    const filtered = getFilteredEventsForPlanners(false);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
             <div className="text-xs font-bold text-slate-400 uppercase mb-5 flex items-center gap-2">
                <Target size={16} className="text-amber-400"/> Primary Focus: <span className="text-slate-200">{timeRange}</span>
             </div>
             {filtered.length === 0 ? (
               <div className="text-sm text-slate-500 italic py-4">No major hardcoded events found.</div>
             ) : (
               <div className="space-y-3">
                 {filtered.slice(0, 5).map(ev => (
                   <div key={ev.id} className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
                     <div>
                       <div className="font-bold text-slate-200 text-sm mb-1">{ev.eventName}</div>
                       <div className="text-xs text-slate-400">Ideal formats: <span className="text-slate-300">{ev.assetFamilySuitability.slice(0,3).join(', ')}</span></div>
                     </div>
                     <button onClick={() => handleManualEventAction(ev)} className="text-[11px] text-indigo-400 font-bold hover:text-indigo-300 bg-indigo-500/10 px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors">Generate <ChevronRight size={12}/></button>
                   </div>
                 ))}
               </div>
             )}
          </div>
          {showAdvanced && (
             <div className="p-5 border border-dashed border-slate-700 rounded-xl bg-slate-900/50">
               <div className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-2"><Lightbulb size={14} className="text-amber-400" /> Pro Tip: Formats</div>
               <div className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                 During slow seasonal periods, focus on filling holes in your portfolio by creating <strong>Sticker Sheets</strong> or <strong>Icon Sets</strong> for evergreen topics. This maximizes your return on output during low-demand months.
               </div>
             </div>
          )}
        </div>
      </div>
    );
  };

  const UniversalOption: React.FC<{
    label: string;
    isSelected?: boolean;
    onClick: () => void;
    style: SelectionStyle;
    isAction?: boolean;
  }> = ({ label, isSelected, onClick, style, isAction }) => {
    
    if (isAction) {
      if (style === 'Chips') {
        return (
          <button
            onClick={onClick}
            className="px-3.5 py-1.5 text-[11px] font-semibold rounded-full border transition-all bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20 active:scale-[0.98]"
          >
            {label}
          </button>
        );
      }
      return (
        <div onClick={onClick} className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-slate-800/70 rounded-lg transition-colors border border-transparent">
          <div className="w-4 h-4 flex items-center justify-center shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50 group-hover:bg-indigo-400 transition-colors" />
          </div>
          <span className="text-xs font-bold text-indigo-400 group-hover:text-indigo-300 transition-colors uppercase tracking-wider">{label}</span>
        </div>
      );
    }

    if (style === 'Chips') {
      return (
        <button
          onClick={onClick}
          className={`px-3.5 py-1.5 text-[11px] font-semibold rounded-full border transition-all ${isSelected ? 'bg-indigo-500 text-white border-indigo-500 shadow-md shadow-indigo-500/20 scale-[1.02]' : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200 hover:bg-slate-900'}`}
        >
          {label}
        </button>
      );
    }

    if (style === 'Radio') {
      return (
        <div onClick={onClick} className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-slate-800/50 rounded-lg transition-colors border border-transparent hover:border-slate-700/50">
          <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${isSelected ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-600 group-hover:border-slate-400 bg-slate-950'}`}>
            {isSelected && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
          </div>
          <span className={`text-[11px] font-medium transition-colors ${isSelected ? 'text-indigo-400 font-bold' : 'text-slate-400 group-hover:text-slate-300'}`}>{label}</span>
        </div>
      );
    }

    if (style === 'Checkbox') {
      return (
        <div onClick={onClick} className="flex items-start gap-2.5 cursor-pointer group p-2 hover:bg-slate-800/50 rounded-lg transition-colors border border-transparent hover:border-slate-700/50">
          <div className={`w-4 h-4 rounded border mt-0.5 flex items-center justify-center transition-all shrink-0 ${isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-slate-600 bg-slate-950 group-hover:border-slate-400'}`}>
            {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
          </div>
          <span className={`text-[11px] transition-colors leading-tight mt-0.5 ${isSelected ? 'text-slate-200 font-bold' : 'text-slate-400 font-medium group-hover:text-slate-300'}`}>{label}</span>
        </div>
      );
    }

    if (style === 'Toggle') {
      return (
        <div className="flex items-center justify-between group cursor-pointer p-2 hover:bg-slate-800/50 rounded-lg transition-colors border border-transparent hover:border-slate-700/50" onClick={onClick}>
          <span className={`text-[11px] font-bold transition-colors ${isSelected ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300'}`}>{label}</span>
          <div className={`w-[28px] h-[16px] rounded-full p-[2px] transition-colors relative flex items-center shrink-0 ${isSelected ? 'bg-indigo-500' : 'bg-slate-700'}`}>
             <div className={`w-3 h-3 rounded-full bg-white transition-all shadow-sm ${isSelected ? 'translate-x-[12px]' : 'translate-x-0'}`} />
          </div>
        </div>
      );
    }

    return null;
  };

  const OptionGroup: React.FC<{ children: React.ReactNode, style: SelectionStyle }> = ({ children, style }) => {
    if (style === 'Chips') {
      return <div className="flex flex-wrap gap-2">{children}</div>;
    }
    return <div className="flex flex-col gap-0.5">{children}</div>;
  };

  const Collapsible: React.FC<{ title: string; children: React.ReactNode, isExpandedDefault?: boolean }> = ({ title, children, isExpandedDefault = true }) => {
    const [isExpanded, setIsExpanded] = useState(isExpandedDefault);
    return (
      <div className="border border-slate-800 bg-slate-900/50 rounded-xl overflow-hidden shrink-0 shadow-sm">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-2 p-4 text-[10px] font-bold text-slate-400 hover:text-slate-200 transition-colors bg-slate-900 uppercase"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {title}
        </button>
        {isExpanded && (
          <div className="p-4 border-t border-slate-800/50 bg-slate-900">
            {children}
          </div>
        )}
      </div>
    );
  };

  const ToggleSwitch = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: (c: boolean) => void }) => (
    <div className="flex items-center justify-between group cursor-pointer" onClick={() => onChange(!checked)}>
       <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-300 transition-colors uppercase tracking-wide">{label}</span>
       <div className={`w-9 h-5 rounded-full p-0.5 transition-colors relative flex items-center ${checked ? 'bg-indigo-500' : 'bg-slate-700'}`}>
          <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-sm ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
       </div>
    </div>
  );

  return (
    <div className="min-h-full pb-12 animate-in fade-in duration-300">
      <div className="mb-6">
        <div className="font-mono text-lg font-bold text-slate-100 flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Calendar size={18} />
          </div>
          Prompt Production & Planning Engine
        </div>
        <div className="text-sm text-slate-400">Auto-generate prompts based on calendars, or manually research stock trends and niches.</div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Sidebar - Configuration Controls */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-5">

           {/* SELECTION STYLE SETTINGS */}
           <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm mb-1">
             <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Settings size={14} className="text-indigo-400"/> Selection Style
                </div>
             </div>
             <div className="grid grid-cols-2 gap-2">
               {['Chips', 'Radio', 'Checkbox', 'Toggle'].map(s => (
                 <button 
                   key={s} 
                   onClick={() => setSelectionStyle(s as SelectionStyle)}
                   className={`py-1.5 px-2 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors border ${selectionStyle === s ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700'}`}
                 >
                   {s}
                 </button>
               ))}
             </div>
           </div>

          {ASSET_GROUPS.map(group => (
            <Collapsible key={group.name} title={group.name}>
              <OptionGroup style={selectionStyle}>
                {group.formats.map(f => (
                  <UniversalOption 
                    key={f} 
                    label={f} 
                    style={selectionStyle} 
                    isSelected={selectedFormat === f} 
                    onClick={() => setSelectedFormat(f)} 
                  />
                ))}
              </OptionGroup>
            </Collapsible>
          ))}

          <Collapsible title="MANUAL CALENDAR">
            <OptionGroup style={selectionStyle}>
              {MANUAL_MODES.map(m => (
                <UniversalOption 
                  key={m.id} 
                  label={m.label} 
                  style={selectionStyle} 
                  isSelected={activeMode === m.id} 
                  onClick={() => { setActiveMode(m.id as EngineMode); setGeneratedPrompts([]); }} 
                />
              ))}
            </OptionGroup>
          </Collapsible>

          <Collapsible title="TIME RANGE">
            <OptionGroup style={selectionStyle}>
              {TIME_RANGES.map(tr => (
                <UniversalOption 
                  key={tr} 
                  label={tr} 
                  style={selectionStyle} 
                  isSelected={timeRange === tr} 
                  onClick={() => setTimeRange(tr)} 
                />
              ))}
            </OptionGroup>
          </Collapsible>

          <Collapsible title="MARKET FOCUS">
            <OptionGroup style={selectionStyle}>
              {MARKETS.map(mf => {
                  const isSelected = marketFocus.includes(mf);
                  return (
                    <UniversalOption 
                      key={mf} 
                      label={mf} 
                      style={selectionStyle} 
                      isSelected={isSelected} 
                      onClick={() => {
                          if (isSelected) {
                            setMarketFocus(marketFocus.filter(m => m !== mf).length > 0 ? marketFocus.filter(m => m !== mf) : ['Global']); // ensure at least one
                          } else {
                            setMarketFocus([...marketFocus, mf]);
                          }
                      }} 
                    />
                  );
              })}
            </OptionGroup>
          </Collapsible>

          <Collapsible title="ACTION">
            <OptionGroup style={selectionStyle}>
              <UniversalOption label="Auto Fill" style={selectionStyle} onClick={() => {
                if (activeMode === 'researcher') handleTrendResearch();
                else if (activeMode === 'niche') handleNicheFinder();
              }} isAction />
              <UniversalOption label="Clear" style={selectionStyle} onClick={handleClear} isAction />
              <UniversalOption label="Generate Prompt" style={selectionStyle} onClick={handleGeneratePrompt} isAction />
              <UniversalOption label="Generate Batch" style={selectionStyle} onClick={handleGenerateBatch} isAction />
              <UniversalOption label="Add to Planner" style={selectionStyle} onClick={() => setActiveMode('planner')} isAction />
              <UniversalOption label="Copy All Prompts" style={selectionStyle} onClick={handleCopyAll} isAction />
            </OptionGroup>
          </Collapsible>

        </div>

        {/* Right Content Area - Results & Inputs */}
        <div className="flex-1 w-full flex flex-col gap-6">

          {/* 4. TOGGLE SWITCHES - Global Action Settings Top panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col gap-5">
             <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <Target size={20} className="text-indigo-400" />
                 </div>
                 <div>
                   <h2 className="text-sm font-bold text-slate-200">Execution Panel & Settings</h2>
                   <p className="text-[11px] text-slate-400">Configure your workflow behaviors and outputs.</p>
                 </div>
               </div>
               <div className="flex flex-wrap gap-2">
                 <button onClick={handleGenerateBatch} className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-transform active:scale-95 shadow-lg shadow-indigo-500/20 flex items-center gap-2">
                    <Lightbulb size={14} /> Batch Generate (10)
                 </button>
                 {generatedPrompts.length > 0 && (
                   <button onClick={handleCopyAll} className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-2">
                      <Copy size={14} /> Copy All Output
                   </button>
                 )}
               </div>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-x-6 gap-y-4 pt-5 border-t border-slate-800/80">
                <ToggleSwitch label="Auto Fill" checked={autoFillActive} onChange={setAutoFillActive} />
                <ToggleSwitch label="Today Trend First" checked={todayTrendFirst} onChange={setTodayTrendFirst} />
                <ToggleSwitch label="Strict Grid Rules" checked={strictGridRules} onChange={setStrictGridRules} />
                <ToggleSwitch label="Daily Workflow" checked={dailyWorkflow} onChange={setDailyWorkflow} />
                <ToggleSwitch label="Show Advanced" checked={showAdvanced} onChange={setShowAdvanced} />
                <ToggleSwitch label="Copy Negative" checked={copyNegativePrompt} onChange={setCopyNegativePrompt} />
             </div>
          </div>

          {/* Conditional Workflow Inputs for Researcher / Niche */}
          {(activeMode === 'researcher' || activeMode === 'niche') && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row gap-3 items-start md:items-center shadow-sm">
               <input 
                 type="text" 
                 placeholder={activeMode === 'researcher' ? "Enter a topic (e.g., eco travel)" : "Enter a broad niche (e.g., Fitness)"} 
                 className="flex-1 w-full bg-slate-950 border border-slate-700 rounded-lg p-3.5 text-sm text-slate-200 outline-none focus:border-indigo-500 shadow-inner"
                 value={activeMode === 'researcher' ? trendInput : nicheInput}
                 onChange={e => activeMode === 'researcher' ? setTrendInput(e.target.value) : setNicheInput(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && handleGeneratePrompt()}
               />
               <div className="flex gap-2 w-full md:w-auto">
                 <button 
                   onClick={handleGeneratePrompt} 
                   className="flex-1 md:flex-none px-6 py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 active:scale-95"
                 >
                   <Search size={16} /> Explore
                 </button>
                 <button 
                   onClick={handleClear} 
                   className="px-4 py-3.5 bg-slate-800 hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 rounded-lg flex items-center justify-center transition-colors border border-slate-700" title="Clear input"
                 >
                   <X size={18} />
                 </button>
               </div>
            </div>
          )}

          {/* Content Rendering Output */}
          {(activeMode === 'auto' || activeMode === 'researcher' || activeMode === 'niche') && (
             <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center px-1">
                  <div className="font-mono text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                     Generated Pipeline Output <span className="text-indigo-400 ml-1">({generatedPrompts.length})</span>
                  </div>
                </div>

                {generatedPrompts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-16 bg-slate-900/30 border border-dashed border-slate-800 rounded-xl text-slate-500">
                    <Target size={40} className="mb-4 opacity-20" />
                    <div className="text-sm font-bold mb-1 text-slate-300">Awaiting Generation</div>
                    <div className="text-xs max-w-sm text-center leading-relaxed text-slate-500">
                      Use the Execution Panel above to auto-generate prompts based on your selected controls configuration.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {generatedPrompts.map(renderPromptCard)}
                  </div>
                )}
             </div>
          )}

          {/* Planner views */}
          {activeMode === 'planner' && renderContentPlanner()}
          {activeMode === 'holiday' && renderHolidayCalendar()}

        </div>
      </div>
    </div>
  );
};
