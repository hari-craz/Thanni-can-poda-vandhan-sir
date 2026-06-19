import React, { useState } from 'react';

export default function ReportsGenerator() {
  const [generated, setGenerated] = useState(false);

  return (
    <div className="space-y-6">
      <div className="border-b border-border-subtle pb-6">
        <h2 className="font-headline-md text-headline-md text-on-surface">Reports Generator</h2>
        <p className="text-on-surface-variant text-sm">Generate compliance and operational reports for regulatory submission</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Form */}
        <div className="w-full lg:w-[40%]">
          <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6 space-y-6">
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Report Type</label>
              <select className="w-full border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none">
                <option>Water Quality Compliance</option>
                <option>Operational Summary</option>
                <option>Anomaly Report</option>
                <option>Maintenance Log</option>
              </select>
            </div>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Date Range</label>
              <div className="flex gap-2">
                <input type="date" className="flex-1 border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary outline-none" defaultValue="2024-01-01" />
                <input type="date" className="flex-1 border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary outline-none" defaultValue="2024-01-31" />
              </div>
            </div>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Devices</label>
              <select multiple className="w-full border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md h-32 focus:ring-2 focus:ring-primary outline-none">
                <option>HYDRO-001 (Chennai North)</option>
                <option>HYDRO-003 (Chennai South)</option>
                <option>HYDRO-007 (Tambaram)</option>
                <option>HYDRO-012 (Avadi)</option>
              </select>
              <p className="text-[10px] text-outline mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Format</label>
              <div className="flex gap-2">
                {['PDF', 'CSV', 'JSON'].map(f => (
                  <button key={f} className={`flex-1 py-2 border text-label-sm font-bold transition-all ${f === 'PDF' ? 'border-primary bg-primary text-on-primary' : 'border-border-subtle hover:bg-surface-container'}`}>{f}</button>
                ))}
              </div>
            </div>
            <button 
              className="w-full bg-primary text-on-primary py-4 font-title-md primary-action-btn flex items-center justify-center gap-2"
              onClick={() => setGenerated(true)}
            >
              <span className="material-symbols-outlined">description</span> Generate Report
            </button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="w-full lg:w-[60%]">
          <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6 min-h-[500px] flex flex-col">
            {!generated ? (
              <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[64px] opacity-20">description</span>
                <p className="text-title-md mt-4">Report Preview</p>
                <p className="text-label-sm text-outline">Configure and generate a report to see the preview</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-title-md text-title-md">Water Quality Compliance Report</h3>
                  <button className="px-4 py-2 border border-border-subtle text-label-sm font-bold hover:bg-surface-container transition-all flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">download</span> Download
                  </button>
                </div>
                <div className="border border-border-subtle p-6 bg-surface-container-low rounded space-y-4">
                  <div className="text-center border-b border-border-subtle pb-4">
                    <h4 className="font-headline-md text-primary">HYDRONIX</h4>
                    <p className="text-label-sm text-outline">Water Quality Compliance Report • Jan 2024</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-outline">Period:</span> <span className="font-bold">Jan 1 – Jan 31, 2024</span></div>
                    <div><span className="text-outline">Devices:</span> <span className="font-bold">4 nodes selected</span></div>
                    <div><span className="text-outline">Avg WQI:</span> <span className="font-bold text-status-nominal">92.4</span></div>
                    <div><span className="text-outline">Compliance:</span> <span className="font-bold text-status-nominal">98.7%</span></div>
                  </div>
                  <div className="h-32 bg-surface-container rounded flex items-end justify-between p-3 gap-1">
                    {[70, 85, 90, 88, 92, 95, 91, 89, 94, 92, 90, 93].map((h, i) => (
                      <div key={i} className="flex-1 bg-primary/40 rounded-t-sm" style={{height: `${h}%`}}></div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
