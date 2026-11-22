import { useState, useEffect, useRef } from 'react';
import { Download, Globe, Loader2, Sparkles, Terminal, StopCircle, RefreshCw, CheckCircle2, Settings, Maximize2, Minimize2, History, X, ExternalLink, RotateCcw, Trash2, Eye, ArrowLeft, ArrowRight, LogOut, Sun, Moon, Play } from 'lucide-react';
import { startScrape, getStatus, stopJob, continueScrape, getHistory, getHistoryPreview, deleteHistoryEntry, getDownloadZipUrl, getDownloadUrlsUrl } from './api/client';
import AuthScreen from './components/AuthScreen';
import LandingPage from './components/LandingPage';
import { getToken, setToken, getUser, validateToken } from './api/auth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [user, setUser] = useState(getUser());

  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    if (isAuthenticated) {
      validateToken().then(userData => {
        setUser(userData);
      }).catch(() => {
        setIsAuthenticated(false);
        setUser(null);
      });
    }
  }, []);

  const [showActiveRerunConfirm, setShowActiveRerunConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');

  const [scrapeMode, setScrapeMode] = useState('full');
  const [targetedUrls, setTargetedUrls] = useState('');
  const [jobType, setJobType] = useState(null);
  const [rerunUrls, setRerunUrls] = useState([]);

  // Status can be: idle, starting, running, completed, error, stopped
  const [status, setStatus] = useState('idle');
  const [phase, setPhase] = useState('');
  const [logs, setLogs] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [jobId, setJobId] = useState(null);
  const [stats, setStats] = useState({ scraped: 0, total: 0, images: 0 });
  const [previewData, setPreviewData] = useState(null);

  const [selectedPreviewPage, setSelectedPreviewPage] = useState('');
  const [selectedPreviewFormat, setSelectedPreviewFormat] = useState('json');
  const [showUrlsList, setShowUrlsList] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isClosingFullscreen, setIsClosingFullscreen] = useState(false);
  const [activeUrlTab, setActiveUrlTab] = useState('working');
  const [isHistoryPreview, setIsHistoryPreview] = useState(false);
  const [previousAppState, setPreviousAppState] = useState(null);
  
  const closeHistoryPreview = () => {
    setIsFullscreen(false);
    setIsHistoryPreview(false);
    setIsHistoryOpen(true);
    if (previousAppState) {
      setStatus(previousAppState.status);
      setJobId(previousAppState.jobId);
      setName(previousAppState.name);
      setScrapeMode(previousAppState.scrapeMode);
      setPreviewData(previousAppState.previewData);
      setSelectedPreviewPage(previousAppState.selectedPreviewPage);
      setShowUrlsList(previousAppState.showUrlsList);
      setLogs(previousAppState.logs);
      setStats(previousAppState.stats);
      setPhase(previousAppState.phase);
      setPreviousAppState(null);
    } else {
      setPreviewData(null);
      setJobId(null);
      setStatus('stopped');
      setPhase('');
      setLogs([]);
      setSelectedPreviewPage('');
    }
  };

  // History Vault state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isClosingHistory, setIsClosingHistory] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState(null);
  const [pendingRerunEntry, setPendingRerunEntry] = useState(null);
  const [historyActiveTab, setHistoryActiveTab] = useState('url_only');

  // Ref for the terminal container and a state for auto-scroll
  const terminalRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Sync active job to localStorage to survive page refreshes
  useEffect(() => {
    if (jobId && !isHistoryPreview) {
      localStorage.setItem('activeJobId', jobId);
      localStorage.setItem('activeJobName', name);
      localStorage.setItem('activeJobUrl', url);
      localStorage.setItem('activeJobScrapeMode', scrapeMode);
      localStorage.setItem('activeJobTargetedUrls', targetedUrls);
    }
  }, [jobId, name, url, scrapeMode, targetedUrls, isHistoryPreview]);

  // Rehydrate active job from localStorage on initial load
  useEffect(() => {
    const savedJobId = localStorage.getItem('activeJobId');
    if (savedJobId) {
      const rehydrate = async () => {
        try {
          const response = await getStatus(savedJobId);
          if (response.ok) {
            const data = await response.json();
            setJobId(savedJobId);
            setStatus(data.status);
            setPhase(data.phase);
            setLogs(data.logs);
            if (data.stats) setStats(data.stats);
            if (data.preview_data) {
              setPreviewData(data.preview_data);
              const validKeys = Object.keys(data.preview_data).filter(k => !['urls.txt', 'working_urls', 'failed_urls'].includes(k));
              setSelectedPreviewPage(validKeys[0] || '');
            }
            if (data.status === 'error') {
              setErrorMsg(data.error || 'An unknown error occurred.');
            }
            setName(localStorage.getItem('activeJobName') || '');
            setUrl(localStorage.getItem('activeJobUrl') || '');
            setScrapeMode(localStorage.getItem('activeJobScrapeMode') || 'full');
            setTargetedUrls(localStorage.getItem('activeJobTargetedUrls') || '');
          } else {
            localStorage.removeItem('activeJobId');
          }
        } catch (err) {
          console.error('Failed to rehydrate active job:', err);
        }
      };
      rehydrate();
    }
  }, []);

  const handleScroll = () => {
    if (!terminalRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;

    // If we are within 20px of the bottom, turn auto-scroll back on
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 20;
    setAutoScroll(isAtBottom);
  };

  // Refs for tracking current state inside polling closure to prevent late responses from overwriting
  const currentJobIdRef = useRef(jobId);
  const isHistoryPreviewRef = useRef(isHistoryPreview);

  useEffect(() => {
    currentJobIdRef.current = jobId;
    isHistoryPreviewRef.current = isHistoryPreview;
  }, [jobId, isHistoryPreview]);

  // Polling logic for status updates
  useEffect(() => {
    let intervalId;

    const fetchStatus = async () => {
      if (!jobId || status === 'completed' || status === 'error' || status === 'stopped') return;

      try {
        const response = await getStatus(jobId);
        if (!response.ok) throw new Error('Failed to fetch status');

        const data = await response.json();
        
        // Prevent late response from overwriting state if the job changed or we opened history preview
        if (currentJobIdRef.current !== jobId || isHistoryPreviewRef.current) return;

        setStatus(prev => prev === 'stopped' ? 'stopped' : data.status);
        setPhase(data.phase);
        setLogs(data.logs);
        if (data.stats) setStats(data.stats);
        if (data.preview_data) {
          setPreviewData(data.preview_data);
          setSelectedPreviewPage(prev => {
            if (prev && !['urls.txt', 'working_urls', 'failed_urls'].includes(prev)) return prev;
            const validKeys = Object.keys(data.preview_data).filter(k => !['urls.txt', 'working_urls', 'failed_urls'].includes(k));
            return validKeys[0] || '';
          });
        }

        if (data.status === 'error') {
          setErrorMsg(data.error || 'An unknown error occurred.');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    if (jobId && (status === 'starting' || status === 'running')) {
      intervalId = setInterval(fetchStatus, 1000); // Poll every 1 second
    }

    return () => clearInterval(intervalId);
  }, [jobId, status]);


  const handleScrape = async (e, overrides = null) => {
    if (e) e.preventDefault();
    
    const runName = overrides ? overrides.name : name;
    const runMode = overrides ? overrides.scrapeMode : scrapeMode;
    const runUrl = overrides ? overrides.url : url;
    const runTargeted = overrides ? overrides.targetedUrls : targetedUrls;
    const runJobType = (overrides && overrides.jobType) ? overrides.jobType : jobType;
    const runJobId = (overrides && overrides.jobId) ? overrides.jobId : null;

    if (!runName) return;
    if (runMode === 'full' && !runUrl) return;
    if (runMode === 'targeted' && !runTargeted.trim()) return;

    setStatus('starting');
    setPhase('Initializing');
    setLogs(['Connecting to server...']);
    setErrorMsg('');
    setJobId(null);
    setStats({ scraped: 0, total: 0, images: 0 });
    setPreviewData(null);
    setSelectedPreviewPage('');
    setShowUrlsList(false);
    setIsHistoryPreview(false);
    setAutoScroll(true);

    const payloadUrls = runMode === 'full' 
      ? runUrl
      : runTargeted.split('\n').filter(u => u.trim());
    
    let finalPayloadUrls = payloadUrls;
    const runHiddenUrls = overrides && overrides.hiddenUrls ? overrides.hiddenUrls : rerunUrls;
    if (runMode === 'full' && runHiddenUrls && runHiddenUrls.length > 1) {
      finalPayloadUrls = runHiddenUrls;
    }
    
    const payload = {
      mode: runMode,
      name: runName,
      urls: finalPayloadUrls,
      job_type: runJobType,
    };
    if (runJobId) {
      payload.job_id = runJobId;
    }

    try {
      const response = await startScrape(payload);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to start scraping');
      }

      const data = await response.json();
      setJobId(data.job_id);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
      setStatus('error');
    }
  };

  const handleStop = async () => {
    if (!jobId) return;
    try {
      setStatus('stopped');
      setPhase('Stopped by user');
      await stopJob(jobId);
    } catch (err) {
      console.error('Failed to stop job:', err);
    }
  };

  const handleContinueScrape = async () => {
    if (!jobId) return;
    try {
      setStatus('running');
      setPhase('Initializing Scraping');
      setIsHistoryPreview(false); // Reset history preview flag since this is now an active running job
      closeFullscreen();
      await continueScrape(jobId);
    } catch (err) {
      console.error('Failed to continue scrape:', err);
    }
  };

  const handleDownloadUrls = () => {
    if (!jobId) return;
    window.location.href = getDownloadUrlsUrl(jobId);
  };

  const resetState = async () => {
    setStatus('idle');
    setPhase('');
    setUrl('');
    setTargetedUrls('');
    setName('');
    setJobId(null);
    setJobType(null);
    setRerunUrls([]);


    setLogs([]);
    setStats({ scraped: 0, total: 0, images: 0 });
    setPreviewData(null);
    setSelectedPreviewPage('');

    localStorage.removeItem('activeJobId');
    localStorage.removeItem('activeJobName');
    localStorage.removeItem('activeJobUrl');
    localStorage.removeItem('activeJobScrapeMode');
    localStorage.removeItem('activeJobTargetedUrls');
  };

  const closeFullscreen = () => {
    setIsClosingFullscreen(true);
    setTimeout(() => {
      setIsFullscreen(false);
      setIsClosingFullscreen(false);
    }, 250);
  };

  const handleFullscreenToggle = () => {
    if (isFullscreen) {
      closeFullscreen();
    } else {
      setIsFullscreen(true);
    }
  };

  const openHistoryVault = async () => {
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await getHistory();
      const data = await res.json();
      setHistoryEntries(data);
    } catch {
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryVault = () => {
    setIsClosingHistory(true);
    setTimeout(() => {
      setIsHistoryOpen(false);
      setIsClosingHistory(false);
    }, 250);
  };

  const loadHistoricalPreview = async (entry, forceUrlInspector = false) => {
    try {
      const res = await getHistoryPreview(entry.job_id);
      if (res.ok) {
        const data = await res.json();
        
        // Save current state before overriding
        setPreviousAppState({
          status,
          jobId,
          name,
          scrapeMode,
          previewData,
          selectedPreviewPage,
          showUrlsList,
          logs,
          stats,
          phase,
        });
        
        setPreviewData(data);
        setStatus(entry.job_type === 'url_only' || forceUrlInspector ? 'urls_discovered' : 'completed');
        setName(entry.name);
        setJobId(entry.job_id);
        setScrapeMode(entry.mode);
        
        const validKeys = Object.keys(data).filter(k => !['urls.txt', 'working_urls', 'failed_urls'].includes(k));
        setSelectedPreviewPage(validKeys[0] || '');
        setShowUrlsList(false);
        setIsHistoryPreview(true);
        // If they forced URL inspector on a full scrape, it means they shouldn't be able to continue scraping
        if (forceUrlInspector && entry.job_type === 'full_scrape') {
          // We can use a special flag, or just hide the bottom buttons if the job_type was full_scrape
          // We will check historyActiveTab === 'full_scrape' to hide the bottom buttons in renderUrlInspectorContent
        }
        
        closeHistoryVault();
        setIsFullscreen(true);
      }
    } catch (err) {
      console.error('Failed to load historical preview:', err);
    }
  };

  const handleRerunFromHistory = (entry) => {
    setPendingRerunEntry(entry);
  };

  const confirmRerun = (entry) => {
    closeHistoryVault();
    setName(entry.name);
    
    let actualMode = 'full';
    let jobTypeParam = entry.job_type || 'full_scrape';
    
    if (entry.job_type === 'full_scrape') {
      actualMode = 'full'; 
      jobTypeParam = 'full_scrape'; 
    } else if (entry.job_type === 'url_only') {
      actualMode = 'full';
      jobTypeParam = 'url_only';
    } else {
      actualMode = 'targeted';
      jobTypeParam = 'targeted';
    }
    
    const runUrl = entry.urls && entry.urls.length > 0 ? entry.urls[0] : '';
    const runTargeted = (entry.urls || []).join('\n');

    setJobType(jobTypeParam);
    if (actualMode === 'full') {
      setScrapeMode('full');
      setUrl(runUrl);
      setTargetedUrls(''); 
      setRerunUrls(entry.urls || []);
    } else {
      setScrapeMode('targeted');
      setTargetedUrls(runTargeted);
      setUrl('');
      setRerunUrls([]);
    }

    setStatus('idle');
    setLogs([]);
    setStats({ scraped: 0, total: 0, images: 0 });
    setPreviewData(null);
    setSelectedPreviewPage('');
    setJobId(null);

    handleScrape(null, {
      name: entry.name,
      scrapeMode: actualMode,
      url: actualMode === 'full' ? runUrl : '',
      targetedUrls: actualMode === 'full' ? '' : runTargeted
    });
  };

  const handleScrapeFromHistory = async (entry) => {
    closeHistoryVault();
    const newName = entry.name;
    const runTargeted = (entry.urls || []).join('\n');
    const runUrl = entry.urls?.[0] || '';
    
    setName(newName);
    
    let actualMode = 'full';
    let jobTypeParam = entry.job_type || 'full_scrape';
    
    if (entry.job_type === 'full_scrape') {
      actualMode = 'full'; 
      jobTypeParam = 'full_scrape'; 
    } else if (entry.job_type === 'url_only') {
      actualMode = 'full';
      jobTypeParam = 'full_scrape'; // Upgraded because we are continuing to scrape data
    } else {
      actualMode = 'targeted';
      jobTypeParam = 'targeted';
    }
    
    const hiddenUrls = entry.urls || [];
    
    setScrapeMode(actualMode); 
    setUrl(runUrl);
    setTargetedUrls(actualMode === 'targeted' ? runTargeted : '');
    setRerunUrls(actualMode === 'full' ? hiddenUrls : []);
    setJobType(jobTypeParam);
    setStatus('idle');
    setLogs([]);
    setStats({ scraped: 0, total: 0, images: 0 });
    setPreviewData(null);
    setSelectedPreviewPage('');
    setJobId(null);
    setErrorMsg('');

    handleScrape(null, {
      name: newName,
      scrapeMode: actualMode,
      url: runUrl,
      targetedUrls: runTargeted,
      jobType: jobTypeParam,
      hiddenUrls: hiddenUrls,
      jobId: entry.job_id
    });
  };


  const handleDeleteHistory = async (jobId) => {
    try {
      await deleteHistoryEntry(jobId);
      setHistoryEntries(prev => prev.filter(e => e.job_id !== jobId));
    } catch {
      // silently fail
    } finally {
      setPendingDeleteEntry(null);
    }
  };


  const renderUrlInspectorContent = () => (
    <>
      <div className="absolute inset-0 bg-purple-500/5 pointer-events-none mix-blend-screen opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

      <div className="bg-[#1e293b]/90 border-b border-slate-700/50 px-5 py-3 shrink-0 flex items-center justify-between gap-3 z-30 relative">
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-purple-400"><Globe className="w-4 h-4" /></div>
          <h3 className="text-sm font-bold text-slate-200 font-mono tracking-wide">URL Inspector</h3>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {isHistoryPreview && isFullscreen ? (
            <button
              onClick={closeHistoryPreview}
              className="bg-red-900/30 p-1.5 rounded-lg hover:bg-red-900/30 text-red-400 hover:text-red-700 transition-colors cursor-pointer shadow-inner border border-red-900 shrink-0"
              title="Close Preview and return to History"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFullscreenToggle}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition-colors bg-[#0f172a] text-slate-300 dark:text-slate-400 border-slate-600 hover:text-slate-900 hover:text-white hover:border-slate-400 cursor-pointer shrink-0"
              title={isFullscreen ? "Exit Fullscreen" : "Expand to Fullscreen"}
            >
              {isFullscreen ? <><Minimize2 className="w-3.5 h-3.5" /></> : <><Maximize2 className="w-3.5 h-3.5" /></>}
            </button>
          )}
        </div>
      </div>
      
      <div className="p-6 flex-1 mt-[-12px] overflow-y-auto flex flex-col items-center text-center bg-[#0f172a]">
        
        <div className="flex gap-4 mb-3 max-w-3xl w-full">
          <div 
            onClick={() => setActiveUrlTab('working')}
            className={`flex-1 rounded-xl border px-4 py-2 cursor-pointer transition-all flex items-center justify-between ${activeUrlTab === 'working' ? 'bg-emerald-500/20 border-emerald-500/50 scale-[1.02] shadow-md' : 'bg-emerald-500/5 border-emerald-500/10 hover:bg-emerald-500/10'}`}>
            <p className="text-emerald-500/70 text-[10px] font-bold uppercase tracking-wider">Working URLs</p>
            <p className="text-xl font-black text-emerald-400">{previewData?.working_urls?.length || stats.working_count || 0}</p>
          </div>
          <div 
            onClick={() => setActiveUrlTab('failed')}
            className={`flex-1 rounded-xl border px-4 py-2 cursor-pointer transition-all flex items-center justify-between ${activeUrlTab === 'failed' ? 'bg-red-500/20 border-red-500/50 scale-[1.02] shadow-md' : 'bg-red-500/5 border-red-500/10 hover:bg-red-500/10'}`}>
            <p className="text-red-500/70 text-[10px] font-bold uppercase tracking-wider">Non-Working</p>
            <p className="text-xl font-black text-red-400">{previewData?.failed_urls?.length || stats.failed_count || 0}</p>
          </div>
        </div>
        
        <div className="w-full max-w-3xl flex-1 min-h-0 flex flex-col bg-[#0f172a] border border-slate-700 rounded-2xl overflow-hidden mb-6 text-left shadow-lg">
            
            {activeUrlTab === 'working' ? (
                <>
                {/* Working URLs List */}
                <div className="bg-[#1e293b] px-4 py-2.5 text-xs font-bold text-slate-300 border-b border-slate-700 flex justify-between shrink-0">
                    <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-400"></div>Working URLs</span>
                </div>
                <div className="p-4 text-sm font-mono text-slate-300 flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-600/50 hover:[&::-webkit-scrollbar-thumb]:bg-slate-500/80 bg-[#0f172a] selection:bg-emerald-500 selection:text-white">
                    {previewData?.working_urls?.length > 0 ? previewData.working_urls.map((u, i) => (
                        <div key={i} className="truncate mb-1.5 text-emerald-400/90 hover:text-emerald-300 transition-colors cursor-text" title={u}>{u}</div>
                    )) : "No working URLs found or list not available."}
                </div>
                </>
            ) : (
                <>
                {/* Non-Working URLs List */}
                <div className="bg-[#1e293b] px-4 py-2.5 text-xs font-bold text-slate-300 border-b border-slate-700 flex justify-between shrink-0">
                    <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-400"></div>Failed / Broken Links</span>
                </div>
                <div className="p-4 text-sm font-mono text-slate-300 flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-600/50 hover:[&::-webkit-scrollbar-thumb]:bg-slate-500/80 bg-[#0f172a] selection:bg-red-500 selection:text-white">
                    {previewData?.failed_urls?.length > 0 ? previewData.failed_urls.map((u, i) => (
                        <div key={i} className="mb-1.5 text-red-500 hover:text-red-300 transition-colors cursor-text flex items-center justify-between" title={typeof u === 'string' ? u : u.url}>
                            <span className="truncate">{typeof u === 'string' ? u : u.url}</span>
                            {typeof u === 'object' && u.reason && (
                               <span className="ml-3 shrink-0 px-2 py-0.5 rounded bg-red-900/40 text-[9px] text-red-300 font-bold border border-red-800/50 uppercase tracking-wider">{u.reason}</span>
                            )}
                        </div>
                    )) : "No failed URLs detected."}
                </div>
                </>
            )}
        </div>

        <div className="flex gap-4 w-full max-w-lg mt-4">
          {(!isHistoryPreview || historyActiveTab === 'url_only') && !isFullscreen && (
            <>
              <button
                onClick={() => {
                  if (jobId) stopJob(jobId).catch(console.error);
                  resetState();
                }}
                className="flex-[0.5] bg-slate-800 hover:bg-slate-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 border border-slate-700"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
              
              <button
                onClick={handleContinueScrape}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 group"
              >
                Continue to Scrape Data
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );

  const renderDataPreviewerContent = (isExpanded) => (
    <>
      <div className="absolute inset-0 bg-blue-500/5 pointer-events-none mix-blend-screen opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

      {/* Top Header */}
      <div className="bg-[#1e293b]/90 border-b border-slate-700/50 px-5 py-3 shrink-0 flex items-center justify-between gap-3 z-30 relative">
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-blue-400"><Sparkles className="w-4 h-4" /></div>
          <h3 className="text-sm font-bold text-slate-200 font-mono tracking-wide">Data Inspector</h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {previewData && previewData['urls.txt'] && (
            <button
              onClick={() => setShowUrlsList(!showUrlsList)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition-colors cursor-pointer shrink-0 ${
                showUrlsList 
                  ? 'bg-slate-700 text-white border-slate-500 hover:bg-slate-600' 
                  : 'bg-[#0f172a] text-slate-300 border-slate-600 hover:text-purple-400 hover:border-purple-500/50 hover:bg-purple-900/10'
              }`}
              title={showUrlsList ? "Back to Preview" : "View All Scraped URLs"}
            >
              {showUrlsList ? <><ArrowLeft className="w-3.5 h-3.5" /> Back</> : <><Eye className="w-3.5 h-3.5" /> URLs</>}
            </button>
          )}

          {previewData && Object.keys(previewData).length > 0 && !showUrlsList && (
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`bg-[#0f172a] text-slate-300 text-[11px] font-mono rounded-md px-3 py-1.5 border border-slate-600 outline-none focus:border-blue-500 cursor-pointer shrink-0 flex items-center justify-between gap-3 shadow-inner hover:bg-slate-800 transition-colors ${isExpanded ? 'w-[290px]' : 'w-[140px]'}`}
              >
                <span className="truncate block text-right w-full" style={{ direction: 'rtl' }}>
                  {(() => {
                    let displayPath = selectedPreviewPage;
                    const maxLength = isExpanded ? 65 : 35;
                    if (displayPath.length > maxLength) {
                      const parts = displayPath.split('/');
                      displayPath = parts.length > 1 ? `.../${parts[parts.length - 1]}` : `...${displayPath.slice(-(maxLength - 5))}`;
                    }
                    return <span style={{ direction: 'ltr' }}>{displayPath}</span>;
                  })()}
                </span>
                <span className="text-[9px] text-slate-500 shrink-0">▼</span>
              </button>

              {isDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDropdownOpen(false)}
                  ></div>
                  <div className={`absolute right-0 top-full mt-1.5 bg-[#0f172a] border border-slate-600 rounded-md shadow-2xl z-50 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-600/50 [&::-webkit-scrollbar-thumb]:rounded-full ${isExpanded ? 'w-[290px]' : 'w-[140px]'}`} style={{ maxHeight: '135px' }}>
                    {Object.keys(previewData)
                      .filter(path => !['urls.txt', 'working_urls', 'failed_urls'].includes(path))
                      .map(path => {
                      let displayPath = path;
                      const maxLength = isExpanded ? 65 : 40;
                      if (displayPath.length > maxLength) {
                        const parts = displayPath.split('/');
                        displayPath = parts.length > 1 ? `.../${parts[parts.length - 1]}` : `...${displayPath.slice(-(maxLength - 5))}`;
                      }
                      const isSelected = selectedPreviewPage === path;
                      return (
                        <div
                          key={path}
                          onClick={() => { setSelectedPreviewPage(path); setIsDropdownOpen(false); }}
                          className={`px-3 py-2 text-[11px] font-mono cursor-pointer truncate text-right transition-colors border-b border-slate-700/50 last:border-0 ${isSelected ? 'bg-blue-600/20 text-blue-400' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}
                          style={{ direction: 'rtl' }}
                        >
                          <span style={{ direction: 'ltr' }}>{displayPath}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          {isHistoryPreview && isExpanded ? (
            <button
              onClick={closeHistoryPreview}
              className="bg-red-900/30 p-1.5 rounded-lg hover:bg-red-900/30 text-red-400 hover:text-red-700 transition-colors cursor-pointer shadow-inner border border-red-900 shrink-0"
              title="Close Preview and return to History"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFullscreenToggle}
              className="bg-slate-800 p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shadow-inner border border-slate-600 shrink-0"
              title={isExpanded ? "Exit Fullscreen" : "Expand Fullscreen"}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Tab Bar Sub-header */}
      {!showUrlsList && previewData && Object.keys(previewData).length > 0 && (
        <div className="bg-[#0f172a] border-b border-slate-700/80 flex shrink-0 z-10 relative">
          {['json', 'md', 'html'].map(fmt => {
            const isSelected = selectedPreviewFormat === fmt;
            const icon = fmt === 'json' ? '📄' : fmt === 'md' ? '📝' : '🌐';
            const label = fmt === 'json' ? 'JSON' : fmt === 'md' ? 'Markdown' : 'HTML';
            return (
              <button
                key={fmt}
                onClick={() => setSelectedPreviewFormat(fmt)}
                className={`flex-1 flex justify-center items-center gap-1.5 py-2.5 text-xs font-mono font-bold transition-all border-r border-slate-700/50 last:border-r-0 cursor-pointer
                  ${isSelected
                    ? 'bg-[#1e293b]/50 text-blue-400 shadow-[inset_0_2px_0_#3b82f6]'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                  }`}
              >
                <span>{icon}</span> {label}
              </button>
            );
          })}
        </div>
      )}
      <div className="p-5 overflow-y-auto flex-1 font-mono text-[13px] leading-relaxed text-emerald-300 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-600/50 [&::-webkit-scrollbar-thumb]:rounded-full selection:bg-slate-600/60 selection:text-white z-10 relative">
        {showUrlsList ? (
          <pre className="whitespace-pre-wrap text-slate-300">{previewData['urls.txt']?.json || 'No URLs found.'}</pre>
        ) : previewData && selectedPreviewPage && previewData[selectedPreviewPage] ? (
          <pre className="whitespace-pre-wrap">{previewData[selectedPreviewPage][selectedPreviewFormat] || 'Format not available for this page.'}</pre>
        ) : (
          <div className="text-slate-500 italic flex items-center h-full justify-center">No preview data available for this run.</div>
        )}
      </div>
    </>
  );

  return (
    <>
      {!isAuthenticated ? (
        !showAuthScreen ? (
          <LandingPage 
            onGetStarted={() => {
              setAuthMode('signup');
              setShowAuthScreen(true);
            }}
            onLogin={() => {
              setAuthMode('login');
              setShowAuthScreen(true);
            }}
            theme={theme}
            toggleTheme={toggleTheme}
          />
        ) : (
          <AuthScreen 
            initialMode={authMode}
            onBack={() => setShowAuthScreen(false)}
            onLoginSuccess={(userData) => {
              setIsAuthenticated(true);
              if (userData) setUser(userData);
              showToast('Login successful', 'success');
            }} 
            theme={theme}
            toggleTheme={toggleTheme}
          />
        )
      ) : (
    <div className="h-screen overflow-hidden bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 flex flex-col font-sans selection:bg-blue-200 dark:selection:bg-purple-500/30 mx-2 relative">
      {/* Background decorations */}
      <div className="hidden dark:block">
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <style>{`
        @keyframes modalPop {
          0% { opacity: 0; transform: scale(0.96) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal-pop {
          animation: modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes modalPopOut {
          0% { opacity: 1; transform: scale(1) translateY(0); }
          100% { opacity: 0; transform: scale(0.96) translateY(10px); }
        }
        .animate-modal-pop-out {
          animation: modalPopOut 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeIn {
          0% { opacity: 0; backdrop-filter: blur(0px); }
          100% { opacity: 1; backdrop-filter: blur(4px); }
        }
        .animate-fade-in {
          animation: fadeIn 0.25s ease-out forwards;
        }
        @keyframes fadeOut {
          0% { opacity: 1; backdrop-filter: blur(4px); }
          100% { opacity: 0; backdrop-filter: blur(0px); }
        }
        .animate-fade-out {
          animation: fadeOut 0.25s ease-out forwards;
        }
        @keyframes slideInRight {
          0% { transform: translateX(100%); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes slideOutRight {
          0% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        .animate-slide-out-right {
          animation: slideOutRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Top Navigation Bar */}
      <nav className="bg-white dark:bg-slate-900/80 dark:backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm shrink-0 z-10">
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-800 dark:text-white">Web Scraper</h1>
                <div className="relative">
                  <Terminal className="w-6 h-6 text-purple-500" />
                  <Sparkles className="w-3 h-3 text-blue-400 absolute -top-1 -right-1" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Secondary Actions (History) */}
              <button
                onClick={openHistoryVault}
                className="flex items-center gap-2 px-3 py-2 bg-slate-200/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300/70 dark:hover:bg-slate-700 hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-sm dark:hover:text-white font-semibold rounded-lg transition-all cursor-pointer group"
              >
                <History className="w-4 h-4 text-blue-500 dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300 transition-colors" />
                <span className="hidden sm:inline">History</span>
              </button>

              <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>
              
              {/* Primary Actions (Stop / New Scrape) */}
              {(status === 'starting' || status === 'running') && (
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white hover:bg-red-600 font-semibold rounded-lg transition-all shadow-md shadow-red-500/20 cursor-pointer animate-pulse"
                >
                  <StopCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Stop</span>
                </button>
              )}
              {(status === 'completed' || status === 'error' || status === 'stopped') && (
                <button
                  onClick={resetState}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white hover:bg-slate-900 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 font-semibold rounded-lg transition-all shadow-md cursor-pointer dark:border dark:border-slate-700 dark:hover:border-slate-600"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span className="hidden sm:inline">New Scrape</span>
                </button>
              )}

              {(status === 'starting' || status === 'running' || status === 'completed' || status === 'error' || status === 'stopped') && (
                <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>
              )}

              {/* User Profile & Logout (Combined Pill) */}
              {user && (
                <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full pr-1.5 pl-1.5 py-1.5 shadow-sm hover:shadow transition-shadow">
                  <div className="hidden sm:flex items-center pl-1 pr-3 border-r border-slate-100 dark:border-slate-700">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold mr-2.5 shadow-inner">
                      {user.full_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">
                      {user.full_name?.split(' ')[0] || user.email?.split('@')[0]}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className="p-1.5 ml-1.5 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-500 hover:text-white rounded-full transition-all cursor-pointer group"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors mr-2 cursor-pointer"
                title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* History Vault Drawer */}
      {(isHistoryOpen || isClosingHistory) && (
        <>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] ${isClosingHistory ? 'animate-fade-out' : 'animate-fade-in'}`}
            onClick={closeHistoryVault}
          />
          {/* Drawer Panel */}
          <div className={`fixed top-0 right-0 h-full w-full max-w-[500px] bg-[#0f172a] border-l border-slate-700 z-[210] flex flex-col shadow-2xl ${isClosingHistory ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>
            {/* Drawer Header */}
            <div className="bg-[#1e293b] px-6 py-4 border-b border-slate-700 flex flex-col shrink-0 gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5 text-blue-400" />
                  <h2 className="text-lg font-bold text-white">History Vault</h2>
                  <span className="text-xs font-mono bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">
                    {historyEntries.filter(e => e.job_type === historyActiveTab || (historyActiveTab === 'full_scrape' && (e.job_type === 'targeted' || !e.job_type))).length}
                  </span>
                </div>
                <button
                  onClick={closeHistoryVault}
                  className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Tabs */}
              <div className="flex gap-2 p-1 bg-slate-900 rounded-lg">
                <button
                  onClick={() => setHistoryActiveTab('url_only')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${historyActiveTab === 'url_only' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  URL Discoveries
                </button>
                <button
                  onClick={() => setHistoryActiveTab('full_scrape')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${historyActiveTab === 'full_scrape' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  Full Scrapes
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-600/50 [&::-webkit-scrollbar-thumb]:rounded-full">
              {historyLoading ? (
                <div className="flex items-center justify-center h-40 gap-3 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  <span className="font-mono text-sm">Loading history...</span>
                </div>
              ) : historyEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-500">
                  <History className="w-10 h-10 opacity-30" />
                  <p className="text-sm font-mono">No history yet.</p>
                  <p className="text-xs text-slate-600">Completed jobs will appear here.</p>
                </div>
              ) : (
                historyEntries.filter(e => e.job_type === historyActiveTab || (historyActiveTab === 'full_scrape' && (e.job_type === 'targeted' || !e.job_type))).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-500">
                    <p className="text-sm font-mono">No {historyActiveTab === 'url_only' ? 'URL discoveries' : 'full scrapes'} found.</p>
                  </div>
                ) : historyEntries.filter(e => e.job_type === historyActiveTab || (historyActiveTab === 'full_scrape' && (e.job_type === 'targeted' || !e.job_type))).map((entry, idx) => (
                  <div
                    key={entry.job_id || idx}
                    className="bg-[#1e293b] border border-slate-700/60 rounded-2xl p-4 hover:border-blue-500/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300 group relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-4">
                      {/* Left Column: Title, Date, and Stats */}
                      <div className="flex flex-col min-w-0 flex-1 pr-4">
                        <h3 className="text-white font-bold text-sm truncate" title={entry.name}>{entry.name}</h3>
                        <p className="text-slate-400 text-xs mt-0.5 font-mono mb-4">{entry.scraped_at}</p>
                        
                        <div className="flex gap-6">
                          {historyActiveTab === 'full_scrape' ? (
                            <>
                              <div className="text-left">
                                <p className="text-blue-400 font-bold text-sm">{entry.stats?.scraped ?? 0}</p>
                                <p className="text-slate-400 text-[10px] font-mono">Pages</p>
                              </div>
                              <div className="text-left">
                                <p className="text-emerald-500 font-bold text-sm">{entry.stats?.images ?? 0}</p>
                                <p className="text-slate-400 text-[10px] font-mono">Images</p>
                              </div>
                            </>
                          ) : (
                            <div className="text-left">
                              <p className="text-emerald-500 font-bold text-sm">{entry.stats?.total_discovered ?? (entry.urls?.length ?? 0)}</p>
                              <p className="text-slate-400 text-[10px] font-mono">Total URLs</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Column: Badge, URL Text, Preview */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          entry.mode === 'full'
                            ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                            : 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                        }`}>
                          {entry.mode === 'full' ? 'Full Crawl' : 'Targeted'}
                        </span>
                        <span className="text-slate-400 text-[10px] font-mono max-w-[180px] truncate">
                          {entry.mode === 'full' ? (
                            <span title={entry.urls?.[0]}>{entry.urls?.[0]}</span>
                          ) : (
                            `${entry.urls?.length ?? 0} custom URLs`
                          )}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {historyActiveTab === 'full_scrape' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); loadHistoricalPreview(entry, true); }}
                              className="flex items-center gap-1.5 bg-teal-600/20 hover:bg-teal-600/40 text-teal-400 border border-teal-500/30 rounded-md px-2.5 py-1 cursor-pointer transition-colors"
                              title="View URL Inspector"
                            >
                              <Globe className="w-3 h-3" />
                              <span className="text-[10px] font-bold">URLs</span>
                            </button>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); loadHistoricalPreview(entry); }}
                            className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 border border-indigo-500/30 rounded-md px-2.5 py-1 cursor-pointer transition-colors"
                            title={historyActiveTab === 'full_scrape' ? "Open Data Inspector" : "Open URL Inspector"}
                          >
                            <Eye className="w-3 h-3" />
                            <span className="text-[10px] font-bold">Preview</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 mt-auto">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleRerunFromHistory(entry)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600/10 hover:bg-blue-600/25 text-blue-400 border border-blue-500/20 hover:border-blue-500/50 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                          title="Re-run exactly as before"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Re-run
                        </button>
                        <button
                          onClick={() => window.location.href = getDownloadUrlsUrl(entry.job_id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600/10 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/50 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                          title="Download URLs Excel"
                        >
                          <Download className="w-3.5 h-3.5" />
                          URLs
                        </button>
                        {historyActiveTab === 'full_scrape' && (
                          entry.zip_available ? (
                            <button
                              onClick={() => window.location.href = getDownloadZipUrl(entry.job_id)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-fuchsia-600/10 hover:bg-fuchsia-600/25 text-fuchsia-400 hover:text-fuchsia-300 border border-fuchsia-500/20 hover:border-fuchsia-500/50 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              ZIP
                            </button>
                          ) : (
                            <button
                              disabled
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-500/10 text-gray-500 border border-gray-500/20 rounded-xl text-xs font-semibold cursor-not-allowed"
                              title="ZIP is not available for this job"
                            >
                              <Download className="w-3.5 h-3.5" />
                              No ZIP
                            </button>
                          )
                        )}
                        
                        <button 
                          onClick={() => setPendingDeleteEntry(entry)}
                          className="flex items-center justify-center p-2 bg-red-600/10 hover:bg-red-600/25 text-red-500 hover:text-red-400 border border-red-500/20 hover:border-red-500/50 rounded-xl transition-all cursor-pointer"
                          title="Delete this record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      {historyActiveTab === 'url_only' && (
                        <button
                          onClick={() => handleScrapeFromHistory(entry)}
                          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 border border-violet-500/30 hover:border-violet-400/60 rounded-xl text-xs font-bold transition-all shadow-inner cursor-pointer mt-1"
                          title="Start a new Data Scrape using these discovered URLs"
                        >
                          <Play className="w-4 h-4" />
                          Continue to Scrape Data
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Delete Confirmation Modal */}
            {pendingDeleteEntry && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[10] flex items-center justify-center p-6 rounded-r-none">
                <div className="bg-[#1e293b] border border-red-500/30 rounded-2xl p-6 w-full max-w-[320px] shadow-2xl animate-modal-pop">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-red-500/15 rounded-full flex items-center justify-center shrink-0">
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-sm">Delete Record?</h3>
                      <p className="text-slate-400 text-xs mt-0.5">This action cannot be undone.</p>
                    </div>
                  </div>
                  <p className="text-slate-300 text-xs font-mono bg-slate-900/60 rounded-lg px-3 py-2 mb-5 truncate border border-slate-700">
                    {pendingDeleteEntry.name}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPendingDeleteEntry(null)}
                      className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteHistory(pendingDeleteEntry.job_id)}
                      className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Yes, Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {pendingRerunEntry && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[10] flex items-center justify-center p-6 rounded-r-none">
                <div className="bg-[#1e293b] border border-blue-500/30 rounded-2xl p-6 w-full max-w-[320px] shadow-2xl animate-modal-pop">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-blue-500/15 rounded-full flex items-center justify-center shrink-0">
                      <RotateCcw className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-sm">Re-run Job?</h3>
                      <p className="text-slate-400 text-[11px] mt-0.5 leading-tight">
                        {pendingRerunEntry.job_type === 'url_only' 
                           ? 'Are you sure you want to Discover the URL again?' 
                           : 'Are you sure you want to scrap the website again?'}
                      </p>
                    </div>
                  </div>
                  <p className="text-slate-300 text-xs font-mono bg-slate-900/60 rounded-lg px-3 py-2 mb-5 truncate border border-slate-700">
                    {pendingRerunEntry.name}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPendingRerunEntry(null)}
                      className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                         const entryToRun = pendingRerunEntry;
                         setPendingRerunEntry(null);
                         confirmRerun(entryToRun);
                      }}
                      className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      Yes, Re-run
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Main Content Dashboard */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-8 overflow-hidden">

        {/* Left Column: Form Controls or Success State */}
        <div className="w-full lg:w-[35%] flex flex-col gap-6 h-full min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

          {status === 'completed' || status === 'urls_discovered' ? (
            <div className="flex flex-col h-full gap-5">
              {/* Success Banner */}
              {(status === 'completed' || status === 'urls_discovered') && (
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 dark:from-emerald-900/40 dark:to-emerald-800/40 border border-transparent dark:border-emerald-500/30 rounded-2xl shadow-md p-4 flex flex-col xl:flex-row items-center justify-between text-white dark:text-emerald-400 shrink-0 gap-4 transition-all">
                <div className="flex items-center gap-3 w-full xl:w-auto">
                  <div className="w-8 h-8 bg-white/20 dark:bg-emerald-500/20 rounded-full flex items-center justify-center shadow-inner shrink-0 ring-1 ring-white/30 dark:ring-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4 text-white dark:text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold tracking-tight drop-shadow-sm dark:text-emerald-400">
                      {status === 'urls_discovered' ? 'URL Discovery Complete!' : 'Scraping Complete!'}
                    </h2>
                  </div>
                </div>

                <div className="flex gap-2 w-full xl:w-auto shrink-0">
                  <button
                    onClick={() => {
                        if (status === 'urls_discovered') handleDownloadUrls();
                        else window.location.href = getDownloadZipUrl(jobId);
                    }}
                    className="flex-1 xl:flex-none bg-white dark:bg-emerald-600/20 text-green-700 dark:text-emerald-400 hover:bg-green-50 dark:hover:bg-emerald-600/40 dark:border dark:border-emerald-500/30 font-bold py-2 px-4 rounded-xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <Download className="w-4 h-4" /> {status === 'urls_discovered' ? 'Download URLs (Excel/CSV)' : 'Download ZIP'}
                  </button>
                  <button
                      onClick={() => setShowActiveRerunConfirm(true)}
                      className="bg-green-700/50 dark:bg-emerald-600/20 hover:bg-green-700/80 dark:hover:bg-emerald-600/40 text-white dark:text-emerald-400 font-bold py-2 px-3 rounded-xl shadow transition-all border border-green-400/30 dark:border-emerald-500/30 cursor-pointer"
                      title={status === 'urls_discovered' ? "Re-run Discovery" : "Re-run Scrape"}
                    >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
              )}

              {/* Data Previewer */}
              {(isFullscreen || isClosingFullscreen) && (
                <>
                  <div className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] ${isClosingFullscreen ? 'animate-fade-out' : 'animate-fade-in'}`} onClick={closeFullscreen}></div>
                  <div className={`fixed inset-6 z-[100] flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.5)] bg-[#0f172a] rounded-3xl border border-slate-700/50 overflow-hidden group ${isClosingFullscreen ? 'animate-modal-pop-out' : 'animate-modal-pop'}`}>
                    {status === 'urls_discovered' ? renderUrlInspectorContent() : renderDataPreviewerContent(true)}
                  </div>
                </>
              )}
              
              {/* Normal Inline Panel (Always rendered underneath so layout never breaks) */}
              <div className="flex-1 flex flex-col min-h-0 relative shadow-[0_0_30px_rgba(0,0,0,0.15)] bg-[#0f172a] rounded-3xl border border-slate-700/50 overflow-hidden group">
                {status === 'urls_discovered' ? renderUrlInspectorContent() : renderDataPreviewerContent(false)}
              </div>
            </div>
          ) : (
            <div className="bg-slate-100 dark:bg-slate-900/50 dark:backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl border border-slate-200 dark:border-slate-700/50 p-8 relative overflow-hidden shrink-0">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-blue-50 dark:bg-blue-500/20 rounded-lg text-blue-600 dark:text-blue-400">
                  <Settings className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Configuration</h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 ml-11">Enter details to extract website content.</p>

              <form onSubmit={handleScrape} className="space-y-6">

                {/* Mode Toggle */}
                <div className="flex bg-slate-100/80 dark:bg-slate-900/50 p-1.5 rounded-xl shadow-inner dark:border dark:border-slate-700/50">
                  <button
                    type="button"
                    onClick={() => {
                      if (status !== 'idle') resetState();
                      setScrapeMode('full');
                    }}
                    disabled={status === 'starting' || status === 'running'}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${scrapeMode === 'full' ? 'bg-white dark:bg-slate-700 shadow-md text-blue-600 dark:text-blue-400 scale-[1.02]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}
                  >
                    Full Crawl
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (status !== 'idle') resetState();
                      setScrapeMode('targeted');
                    }}
                    disabled={status === 'starting' || status === 'running'}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${scrapeMode === 'targeted' ? 'bg-white dark:bg-slate-700 shadow-md text-blue-600 dark:text-blue-400 scale-[1.02]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}
                  >
                    Targeted URLs
                  </button>
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Website Name</label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Example Co"
                    disabled={status === 'starting' || status === 'running'}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none disabled:bg-slate-50 dark:disabled:bg-slate-900/50 disabled:text-slate-500 dark:disabled:text-slate-600 text-slate-700 dark:text-slate-200 font-medium dark:placeholder-slate-500"
                    required
                  />
                </div>

                {scrapeMode === 'full' ? (
                  <div>
                    <label htmlFor="url" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Website Base URL</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Globe className="h-5 w-5 text-blue-400" />
                      </div>
                      <input
                        type="url"
                        id="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://example.com"
                        disabled={status === 'starting' || status === 'running'}
                        className="w-full pl-11 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none disabled:bg-slate-50 dark:disabled:bg-slate-900/50 disabled:text-slate-500 dark:disabled:text-slate-600 text-slate-700 dark:text-slate-200 font-medium dark:placeholder-slate-500"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="urls" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Custom URLs (One per line)</label>
                    <textarea
                      id="urls"
                      value={targetedUrls}
                      onChange={(e) => setTargetedUrls(e.target.value)}
                      placeholder="https://example.com/page1&#10;https://example.com/page2"
                      disabled={status === 'starting' || status === 'running'}
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none disabled:bg-slate-50 dark:disabled:bg-slate-900/50 disabled:text-slate-500 dark:disabled:text-slate-600 text-slate-700 dark:text-slate-200 font-medium resize-none leading-relaxed dark:placeholder-slate-500"
                      required
                    />
                  </div>
                )}

                {status === 'error' && (
                  <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200 font-medium">
                    {errorMsg}
                  </div>
                )}

                {status === 'idle' || status === 'error' || status === 'stopped' || status === 'completed' ? (
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transform transition-all duration-300 flex items-center justify-center gap-2 group cursor-pointer mt-2"
                  >
                    Start Scraping
                    <Sparkles className="w-5 h-5 text-blue-200 group-hover:text-white transition-all duration-1000" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed mt-2 border border-slate-200 dark:border-slate-700"
                  >
                    <Loader2 className="w-5 h-5 animate-spin dark:text-slate-600" />
                    Processing...
                  </button>
                )}
              </form>
            </div>
          )}

        </div>

        {/* Right Column: Terminal */}
        <div className="w-full lg:flex-1 flex flex-col h-full min-h-0">
          <div className="bg-gradient-to-br from-[#0f172a] to-[#020617] rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.3)] dark:shadow-[0_0_40px_rgba(59,130,246,0.1)] border border-slate-700/50 overflow-hidden flex flex-col h-full relative">

            {/* Inner glow ambient effect */}
            <div className="absolute inset-0 bg-blue-500/5 pointer-events-none mix-blend-screen"></div>

            {/* Terminal Header */}
            <div className="bg-[#1e293b]/80 backdrop-blur-md px-5 py-4 border-b border-slate-700/50 flex justify-between items-center shrink-0 z-10 relative shadow-sm">
              <div className="flex items-center space-x-2">
                <div className="w-3.5 h-3.5 rounded-full bg-[#ff5f56] shadow-[0_0_8px_#ff5f56aa]"></div>
                <div className="w-3.5 h-3.5 rounded-full bg-[#ffbd2e] shadow-[0_0_8px_#ffbd2eaa]"></div>
                <div className="w-3.5 h-3.5 rounded-full bg-[#27c93f] shadow-[0_0_8px_#27c93faa]"></div>
                <span className="ml-5 text-xs font-semibold font-mono text-slate-300 flex items-center gap-2 tracking-wide">
                  <Terminal className="w-4 h-4 text-slate-400" />
                  {phase || 'Terminal'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {(status === 'starting' || status === 'running') && (
                  <span className="text-xs font-bold text-blue-400 animate-pulse flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-blue-500 rounded-full inline-block"></span>
                    LIVE
                  </span>
                )}
              </div>
            </div>

            {/* Terminal Progress Bar */}
            {(status !== 'idle' && status !== 'error' && stats.total > 0) && (
              <div className="bg-[#0f172a] border-b border-slate-700/50 px-5 py-3 shrink-0 z-10 relative">
                <div className="flex justify-between text-xs font-mono text-slate-400 mb-2">
                  <span>Scraping Progress ({stats.scraped} / {stats.total} URLs)</span>
                  <span className="text-blue-400">Images Downloaded: {stats.images}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-green-400 h-1.5 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(59,130,246,0.6)]"
                    style={{ width: `${Math.min(100, Math.max(5, (stats.scraped / stats.total) * 100))}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Terminal Body */}
            <div
              ref={terminalRef}
              onScroll={handleScroll}
              className="flex-1 p-6 overflow-y-auto font-mono text-sm leading-relaxed scroll-smooth z-10 relative [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-600/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-500/80 transition-colors selection:bg-slate-600/60 selection:text-white"
            >
              {logs.length === 0 ? (
                <div className="text-slate-500 text-sm mt-2 flex items-center gap-3">
                  <div className="w-2.5 h-5 bg-slate-500 animate-pulse rounded-sm"></div>
                  System standing by for instructions...
                </div>
              ) : (
                logs.map((log, index) => {
                  const isError       = log.includes("ERROR") || log.includes("[FAILED]") || log.includes("error:");
                  const isSkip        = log.startsWith("[SKIP]") || log.includes("Not Found") || log.includes("404");
                  const isWarning     = log.includes("[WARNING]");
                  const isRetry       = log.toLowerCase().includes("retry") || log.toLowerCase().includes("retrying");
                  const isPhase       = log.startsWith("---") || log.startsWith("===") || log.includes("Using provided") || log.includes("Launching Chromium") || log.includes("Launching browser");
                  const isFound       = log.startsWith("Found ->") || log.includes("Found ->");
                  const isSaved       = log.startsWith("Saved ->") || log.includes("Saved ->");
                  const isQueued      = log.startsWith("Queued");
                  const isSuccess     = log.includes("successfully") || log.includes("Done!") || log.includes("ZIP file created");
                  const isIndex       = /^\[\d+\]/.test(log);       // URL discovery: [46] (depth=...)
                  const isScrapeIndex = /^\[\d+\/\d+\]/.test(log);  // Scraping phase: [1/260] https://...

                  let textColor = "text-emerald-400 drop-shadow-[0_0_2px_rgba(52,211,153,0.3)]";
                  if (isError)         textColor = "text-red-400 font-bold drop-shadow-[0_0_3px_rgba(248,113,113,0.5)]";
                  else if (isSkip)     textColor = "text-red-500/70 italic";
                  else if (isWarning || isRetry) textColor = "text-yellow-400 drop-shadow-[0_0_2px_rgba(250,204,21,0.3)]";
                  else if (isPhase)    textColor = "text-blue-400 font-bold mt-5 mb-3";
                  else if (isFound)    textColor = "text-emerald-300 font-semibold drop-shadow-[0_0_4px_rgba(52,211,153,0.5)]";
                  else if (isSaved)    textColor = "text-emerald-300 font-semibold drop-shadow-[0_0_4px_rgba(52,211,153,0.5)]";
                  else if (isQueued)   textColor = "text-slate-400";
                  else if (isSuccess)  textColor = "text-green-300 font-bold";
                  else if (isScrapeIndex) textColor = "text-cyan-400/80";
                  else if (isIndex)    textColor = "text-cyan-400/80";

                  return (
                    <div key={index} className={`whitespace-pre-wrap break-all ${textColor}`}>
                      {log}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      {/* Active Job Rerun Confirm */}
      {showActiveRerunConfirm && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-6 rounded-r-none">
          <div className="bg-[#1e293b] border border-blue-500/30 rounded-2xl p-6 w-full max-w-[320px] shadow-2xl animate-modal-pop">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/15 rounded-full flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Re-run Job?</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 leading-tight">
                  {status === 'urls_discovered' 
                     ? 'Are you sure you want to Discover the URL again?' 
                     : 'Are you sure you want to scrap the website again?'}
                </p>
              </div>
            </div>
            <p className="text-slate-300 text-xs font-mono bg-slate-900/60 rounded-lg px-3 py-2 mb-5 truncate border border-slate-700">
              {name}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowActiveRerunConfirm(false)}
                className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowActiveRerunConfirm(false);
                  handleScrape();
                }}
                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Yes, Re-run
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-6 rounded-r-none">
          <div className="bg-white dark:bg-[#1e293b] border border-red-500/30 rounded-2xl p-6 w-[400px] h-[150px] shadow-2xl animate-modal-pop">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/50">
                <LogOut className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-slate-900 dark:text-white font-bold text-sm">Logout</h3>
                <p className="text-slate-400 text-[11px] mt-0.5 leading-tight">
                  Are you sure you want to logout?
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  setToken(null);
                  setIsAuthenticated(false);
                  setShowAuthScreen(false);
                  setUser(null);
                  resetState();
                  showToast('Logout successful', 'success');
                }}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      </main>

    </div>
    )}
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[99999] px-4 py-3 rounded-lg shadow-xl border flex items-center gap-3 animate-modal-pop backdrop-blur-md ${toast.type === 'success' ? 'bg-emerald-600/80 border-emerald-500/50 text-slate-100' : 'bg-red-600/80 border-red-500/50 text-slate-100'}`}>
           {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <X className="w-5 h-5" />}
           <span className="text-sm font-bold tracking-tight">{toast.msg}</span>
        </div>
      )}
    </>
  );
}

export default App;
