import { useState, useEffect } from 'react';

const defaultStats = {
  algorithm: 'Isolation Forest',
  version: 'v2.1.0',
  lastTrained: '12 Hours Ago',
  accuracy: '89.4%',
  datasetSize: '2.4M readings',
  featureCount: '12 parameters'
};

const defaultHistory = [
  {
    id: 'run-3',
    version: 'v2.1.0',
    timestamp: '2026-06-21 00:40:00',
    datasetSize: '2.4M readings',
    accuracy: '89.4%',
    trigger: 'Nightly Retraining',
    status: 'Completed'
  },
  {
    id: 'run-2',
    version: 'v2.0.0',
    timestamp: '2026-06-20 02:00:00',
    datasetSize: '2.3M readings',
    accuracy: '88.1%',
    trigger: 'Nightly Retraining',
    status: 'Superceded'
  },
  {
    id: 'run-1',
    version: 'v1.9.0',
    timestamp: '2026-06-19 14:30:00',
    datasetSize: '2.2M readings',
    accuracy: '87.5%',
    trigger: 'Manual Trigger',
    status: 'Superceded'
  }
];

const STAGES = [
  { id: 1, label: 'Loading balanced water potability dataset (3,000 samples)', minPercent: 0, maxPercent: 15 },
  { id: 2, label: 'Imputing missing data with KNNImputer (k=5)', minPercent: 15, maxPercent: 35 },
  { id: 3, label: 'Standardizing features with StandardScaler', minPercent: 35, maxPercent: 55 },
  { id: 4, label: 'Fitting XGBoost Classifier (n_estimators=100, max_depth=6)', minPercent: 55, maxPercent: 75 },
  { id: 5, label: 'Evaluating model performance metrics on 5-fold cross-validation', minPercent: 75, maxPercent: 90 },
  { id: 6, label: 'Deploying Preprocessor.pkl & XGBoost.pkl to production models directory', minPercent: 90, maxPercent: 100 }
];

export default function AIModelConfig() {
  const [retrainEnabled, setRetrainEnabled] = useState(true);
  const [autoDeployEnabled, setAutoDeployEnabled] = useState(true);
  const [sensitivity, setSensitivity] = useState(7);

  const [modelStats, setModelStats] = useState(() => {
    const saved = localStorage.getItem('hydronix_model_stats');
    return saved ? JSON.parse(saved) : defaultStats;
  });

  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('hydronix_model_history');
    return saved ? JSON.parse(saved) : defaultHistory;
  });

  const [isRetraining, setIsRetraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [highlightedRunId, setHighlightedRunId] = useState(null);

  // Sync to local storage
  const updateModelStats = (newStats) => {
    setModelStats(newStats);
    localStorage.setItem('hydronix_model_stats', JSON.stringify(newStats));
  };

  const updateHistory = (newHistory) => {
    setHistory(newHistory);
    localStorage.setItem('hydronix_model_history', JSON.stringify(newHistory));
  };

  const handleRetrain = () => {
    setSuccessMessage('');
    setIsRetraining(true);
    setProgress(0);
    setCurrentStage(1);
  };

  const handleCancelRetraining = () => {
    setIsRetraining(false);
    setProgress(0);
    setCurrentStage(0);

    const now = new Date();
    const formatTimestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    const newLog = {
      id: `run-${Date.now()}`,
      version: 'v-.-.-',
      timestamp: formatTimestamp,
      datasetSize: modelStats.datasetSize,
      accuracy: 'N/A',
      trigger: 'Manual Trigger',
      status: 'Failed'
    };

    updateHistory([newLog, ...history]);
  };

  const handleResetDefaults = () => {
    updateModelStats(defaultStats);
    updateHistory(defaultHistory);
    setSuccessMessage('Successfully reset model stats and history to defaults.');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  // Unified asynchronous progress & stage simulation ticker
  useEffect(() => {
    if (!isRetraining) return;

    let currentProgress = 0;
    const interval = setInterval(() => {
      const step = 1.5 + Math.random() * 2.5;
      currentProgress = Math.min(currentProgress + step, 100);
      
      // Update progress state
      setProgress(currentProgress);

      // Determine stage
      let stage = 1;
      if (currentProgress >= 90) stage = 6;
      else if (currentProgress >= 75) stage = 5;
      else if (currentProgress >= 55) stage = 4;
      else if (currentProgress >= 35) stage = 3;
      else if (currentProgress >= 15) stage = 2;
      
      setCurrentStage(stage);

      if (currentProgress >= 100) {
        clearInterval(interval);
        setCurrentStage(7);
        setIsRetraining(false);

        // Update stats and history in async callback (perfectly safe from synchronous effect limits)
        setModelStats((prevStats) => {
          const currentVer = prevStats.version;
          const verMatch = currentVer.match(/v(\d+)\.(\d+)\.(\d+)/);
          let newVer = 'v2.1.1';
          if (verMatch) {
            const major = parseInt(verMatch[1], 10);
            const minor = parseInt(verMatch[2], 10);
            const patch = parseInt(verMatch[3], 10);
            newVer = `v${major}.${minor}.${patch + 1}`;
          }

          const newAccuracyNum = (88.0 + Math.random() * 4.5).toFixed(1);
          const newAccuracy = `${newAccuracyNum}%`;

          const newStats = {
            ...prevStats,
            version: newVer,
            lastTrained: 'Just Now',
            accuracy: newAccuracy
          };
          localStorage.setItem('hydronix_model_stats', JSON.stringify(newStats));

          setHistory((prevHistory) => {
            const now = new Date();
            const formatTimestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            
            const newRunId = `run-${Date.now()}`;
            const newLog = {
              id: newRunId,
              version: newVer,
              timestamp: formatTimestamp,
              datasetSize: prevStats.datasetSize,
              accuracy: newAccuracy,
              trigger: 'Manual Trigger',
              status: 'Completed'
            };

            const updated = [
              newLog,
              ...prevHistory.map(item => ({
                ...item,
                status: item.status === 'Completed' ? 'Superceded' : item.status
              }))
            ];
            localStorage.setItem('hydronix_model_history', JSON.stringify(updated));
            
            setHighlightedRunId(newRunId);
            setTimeout(() => {
              setHighlightedRunId(null);
            }, 4000);

            setSuccessMessage(`Model successfully retrained to version ${newVer} with accuracy ${newAccuracy}!`);
            return updated;
          });

          return newStats;
        });
      }
    }, 120);

    return () => clearInterval(interval);
  }, [isRetraining]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="border-b border-border-subtle pb-6">
        <h2 className="font-headline-md text-headline-md text-on-surface">AI Model Configuration</h2>
        <p className="text-on-surface-variant text-sm">Manage machine learning model settings and retraining schedules</p>
      </div>

      {/* Success Banner */}
      {successMessage && (
        <div className="bg-status-nominal/10 border border-status-nominal/30 text-on-surface rounded-lg p-4 flex items-center justify-between animate-fade-in shadow-sm">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-status-nominal">check_circle</span>
            <p className="text-sm font-semibold">{successMessage}</p>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-outline hover:text-on-surface transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      {/* Model Status Card */}
      <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6">
        <h3 className="font-title-md text-title-md mb-4 text-on-surface">Current Model</h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div className="flex justify-between py-3 border-b border-border-subtle/50">
            <span className="text-on-surface-variant">Algorithm</span>
            <span className="font-bold text-on-surface">{modelStats.algorithm}</span>
          </div>
          <div className="flex justify-between py-3 border-b border-border-subtle/50">
            <span className="text-on-surface-variant">Current Version</span>
            <span className="font-bold font-mono text-primary">{modelStats.version}</span>
          </div>
          <div className="flex justify-between py-3 border-b border-border-subtle/50">
            <span className="text-on-surface-variant">Last Trained</span>
            <span className="font-bold text-on-surface">{modelStats.lastTrained}</span>
          </div>
          <div className="flex justify-between py-3 border-b border-border-subtle/50">
            <span className="text-on-surface-variant">Accuracy</span>
            <span className="font-bold text-status-nominal">{modelStats.accuracy}</span>
          </div>
          <div className="flex justify-between py-3 border-b border-border-subtle/50">
            <span className="text-on-surface-variant">Training Dataset</span>
            <span className="font-bold text-on-surface">{modelStats.datasetSize}</span>
          </div>
          <div className="flex justify-between py-3 border-b border-border-subtle/50">
            <span className="text-on-surface-variant">Feature Count</span>
            <span className="font-bold text-on-surface">{modelStats.featureCount}</span>
          </div>
        </div>
      </div>

      {/* Toggle Settings */}
      <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6 space-y-6">
        <h3 className="font-title-md text-title-md text-on-surface">Training Settings</h3>
        
        <div className="flex items-center justify-between py-4 border-b border-border-subtle/50">
          <div>
            <p className="font-bold text-sm text-on-surface">Enable Nightly Isolation Forest Retraining</p>
            <p className="text-label-sm text-outline">Model will retrain automatically at 02:00 AM daily</p>
          </div>
          <button 
            className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${retrainEnabled ? 'bg-primary' : 'bg-outline-variant'}`}
            onClick={() => setRetrainEnabled(!retrainEnabled)}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${retrainEnabled ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
          </button>
        </div>

        <div className="flex items-center justify-between py-4 border-b border-border-subtle/50">
          <div>
            <p className="font-bold text-sm text-on-surface">Auto-Deploy After Training</p>
            <p className="text-label-sm text-outline">Automatically deploy model if accuracy exceeds 85%</p>
          </div>
          <button 
            className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${autoDeployEnabled ? 'bg-primary' : 'bg-outline-variant'}`}
            onClick={() => setAutoDeployEnabled(!autoDeployEnabled)}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoDeployEnabled ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
          </button>
        </div>

        <div className="flex items-center justify-between py-4">
          <div>
            <p className="font-bold text-sm text-on-surface">Anomaly Sensitivity</p>
            <p className="text-label-sm text-outline font-semibold">Higher sensitivity = more alerts, fewer false negatives (Current: {sensitivity})</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-label-sm text-outline font-semibold">Low</span>
            <input 
              type="range" 
              min="1" 
              max="10" 
              value={sensitivity} 
              onChange={(e) => setSensitivity(parseInt(e.target.value))}
              className="w-32 accent-primary cursor-pointer" 
            />
            <span className="text-label-sm text-outline font-semibold">High</span>
          </div>
        </div>
      </div>

      {/* Retraining Progress Card */}
      {isRetraining && (
        <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-md p-6 space-y-6 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-title-md text-title-md flex items-center gap-2 text-on-surface">
                <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                Retraining XGBoost Pipeline
              </h3>
              <p className="text-outline text-label-sm mt-0.5 font-semibold">Please do not navigate away or close the browser tab</p>
            </div>
            <div className="text-right">
              <span className="text-title-md font-bold font-mono text-primary">{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2.5 bg-surface-container-low rounded-full overflow-hidden relative">
            <div 
              className="h-full bg-gradient-to-r from-primary to-status-nominal transition-all duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Stages List */}
          <div className="space-y-3.5 pt-2 border-t border-border-subtle/30">
            {STAGES.map((stage) => {
              const isCompleted = currentStage > stage.id;
              const isActive = currentStage === stage.id;
              const isPending = currentStage < stage.id;

              return (
                <div 
                  key={stage.id} 
                  className={`flex items-start gap-3 transition-colors duration-200 ${
                    isActive ? 'text-on-surface font-semibold' : isPending ? 'text-outline/40' : 'text-on-surface-variant'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {isCompleted ? (
                      <span className="material-symbols-outlined text-status-nominal text-[20px]">check_circle</span>
                    ) : isActive ? (
                      <span className="material-symbols-outlined animate-spin text-primary text-[20px]">sync</span>
                    ) : (
                      <span className="material-symbols-outlined text-outline/30 text-[20px]">radio_button_unchecked</span>
                    )}
                  </div>
                  <div className="text-sm">
                    {stage.label}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-2 border-t border-border-subtle/50">
            <button 
              onClick={handleCancelRetraining}
              className="px-4 py-2 text-sm font-semibold border border-error/30 text-error hover:bg-error-container hover:text-on-error-container rounded-md btn-premium cursor-pointer"
            >
              Cancel Retraining
            </button>
          </div>
        </div>
      )}

      {/* Force Retrain Button */}
      {!isRetraining && (
        <button 
          className="w-full py-4 font-title-md primary-action-btn flex items-center justify-center gap-2 bg-primary text-on-primary rounded-lg shadow-sm cursor-pointer hover:bg-primary-container/90"
          onClick={handleRetrain}
        >
          <span className="material-symbols-outlined">
            model_training
          </span>
          Force Retrain Now
        </button>
      )}

      {/* Retraining History Card */}
      <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-border-subtle/50">
          <div>
            <h3 className="font-title-md text-title-md flex items-center gap-2 text-on-surface">
              <span className="material-symbols-outlined text-primary">history</span>
              Retraining History
            </h3>
            <p className="text-on-surface-variant text-sm">Detailed log of previous model training runs</p>
          </div>
          <button 
            onClick={handleResetDefaults}
            className="px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-container/10 border border-primary/20 rounded-md transition-colors cursor-pointer"
          >
            Reset Logs
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border-subtle/80 text-on-surface-variant font-semibold">
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4">Trained At</th>
                <th className="py-3 px-4">Dataset Size</th>
                <th className="py-3 px-4">Accuracy</th>
                <th className="py-3 px-4">Trigger</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/40">
              {history.map((run) => {
                const isNew = run.id === highlightedRunId;
                return (
                  <tr 
                    key={run.id} 
                    className={`transition-all duration-700 ${
                      isNew 
                        ? 'bg-status-nominal/10 font-bold border-l-4 border-status-nominal' 
                        : 'hover:bg-surface-container-low/30'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-primary">{run.version}</td>
                    <td className="py-3 px-4 text-on-surface-variant">{run.timestamp}</td>
                    <td className="py-3 px-4">{run.datasetSize}</td>
                    <td className={`py-3 px-4 ${run.accuracy !== 'N/A' ? 'font-semibold text-status-nominal' : 'text-outline/60'}`}>
                      {run.accuracy}
                    </td>
                    <td className="py-3 px-4 text-on-surface-variant">{run.trigger}</td>
                    <td className="py-3 px-4 text-xs font-bold">
                      {run.status === 'Completed' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-nominal/10 text-status-nominal border border-status-nominal/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-status-nominal animate-pulse"></span>
                          Completed
                        </span>
                      )}
                      {run.status === 'Superceded' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-container-highest/60 text-outline border border-border-subtle">
                          Superceded
                        </span>
                      )}
                      {run.status === 'Failed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-status-critical/10 text-status-critical border border-status-critical/20">
                          Failed
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
