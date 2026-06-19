import React, { useState } from 'react';

export default function AIModelConfig() {
  const [retrainEnabled, setRetrainEnabled] = useState(true);
  const [isRetraining, setIsRetraining] = useState(false);

  const handleRetrain = () => {
    setIsRetraining(true);
    setTimeout(() => setIsRetraining(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="border-b border-border-subtle pb-6">
        <h2 className="font-headline-md text-headline-md text-on-surface">AI Model Configuration</h2>
        <p className="text-on-surface-variant text-sm">Manage machine learning model settings and retraining schedules</p>
      </div>

      {/* Model Status Card */}
      <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6">
        <h3 className="font-title-md text-title-md mb-4">Current Model</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between py-3 border-b border-border-subtle/50">
            <span className="text-on-surface-variant">Algorithm</span>
            <span className="font-bold">Isolation Forest</span>
          </div>
          <div className="flex justify-between py-3 border-b border-border-subtle/50">
            <span className="text-on-surface-variant">Current Version</span>
            <span className="font-bold font-mono">v2.1.0</span>
          </div>
          <div className="flex justify-between py-3 border-b border-border-subtle/50">
            <span className="text-on-surface-variant">Last Trained</span>
            <span className="font-bold">12 Hours Ago</span>
          </div>
          <div className="flex justify-between py-3 border-b border-border-subtle/50">
            <span className="text-on-surface-variant">Accuracy</span>
            <span className="font-bold text-status-nominal">89.4%</span>
          </div>
          <div className="flex justify-between py-3 border-b border-border-subtle/50">
            <span className="text-on-surface-variant">Training Dataset</span>
            <span className="font-bold">2.4M readings</span>
          </div>
          <div className="flex justify-between py-3 border-b border-border-subtle/50">
            <span className="text-on-surface-variant">Feature Count</span>
            <span className="font-bold">12 parameters</span>
          </div>
        </div>
      </div>

      {/* Toggle Settings */}
      <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6 space-y-6">
        <h3 className="font-title-md text-title-md">Training Settings</h3>
        
        <div className="flex items-center justify-between py-4 border-b border-border-subtle/50">
          <div>
            <p className="font-bold text-sm">Enable Nightly Isolation Forest Retraining</p>
            <p className="text-label-sm text-outline">Model will retrain automatically at 02:00 AM daily</p>
          </div>
          <button 
            className={`relative w-12 h-6 rounded-full transition-colors ${retrainEnabled ? 'bg-primary' : 'bg-outline-variant'}`}
            onClick={() => setRetrainEnabled(!retrainEnabled)}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${retrainEnabled ? 'translate-x-6' : 'translate-x-0.5'}`}></div>
          </button>
        </div>

        <div className="flex items-center justify-between py-4 border-b border-border-subtle/50">
          <div>
            <p className="font-bold text-sm">Auto-Deploy After Training</p>
            <p className="text-label-sm text-outline">Automatically deploy model if accuracy exceeds 85%</p>
          </div>
          <button className="relative w-12 h-6 rounded-full bg-primary transition-colors">
            <div className="absolute top-0.5 translate-x-6 w-5 h-5 bg-white rounded-full shadow transition-transform"></div>
          </button>
        </div>

        <div className="flex items-center justify-between py-4">
          <div>
            <p className="font-bold text-sm">Anomaly Sensitivity</p>
            <p className="text-label-sm text-outline">Higher sensitivity = more alerts, fewer false negatives</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-label-sm text-outline">Low</span>
            <input type="range" min="1" max="10" defaultValue="7" className="w-32 accent-primary" />
            <span className="text-label-sm text-outline">High</span>
          </div>
        </div>
      </div>

      {/* Force Retrain */}
      <button 
        className={`w-full py-4 font-title-md primary-action-btn flex items-center justify-center gap-2 ${isRetraining ? 'bg-surface-container text-outline cursor-wait' : 'bg-primary text-on-primary'}`}
        onClick={handleRetrain}
        disabled={isRetraining}
      >
        <span className={`material-symbols-outlined ${isRetraining ? 'animate-spin' : ''}`}>
          {isRetraining ? 'sync' : 'model_training'}
        </span>
        {isRetraining ? 'Retraining in Progress...' : 'Force Retrain Now'}
      </button>
    </div>
  );
}
