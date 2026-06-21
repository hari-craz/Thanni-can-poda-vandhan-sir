import { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function ReportsGenerator() {
  const [reportType, setReportType] = useState('Water Quality Compliance');
  const [startDate, setStartDate] = useState('2026-06-01');
  const [endDate, setEndDate] = useState('2026-06-21');
  const [devicesList, setDevicesList] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [format, setFormat] = useState('PDF');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState(null);
  const [anomalies, setAnomalies] = useState([]);

  // Fetch initial devices list and anomalies log
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const devicesRes = await api.getDevices();
        const list = devicesRes.devices || [];
        setDevicesList(list);
        // Default to selecting all devices
        setSelectedDevices(list.map((d) => d.device_id));

        const anomaliesRes = await api.getAnomalies();
        setAnomalies(anomaliesRes.anomalies || []);
      } catch (error) {
        console.error('Failed to load initial reports data:', error);
      }
    };
    
    // Call asynchronously to satisfy react-hooks/set-state-in-effect
    setTimeout(() => {
      loadInitialData();
    }, 0);
  }, []);

  const handleGenerateReport = () => {
    setIsGenerating(true);
    setGeneratedData(null);
    
    setTimeout(() => {
      setIsGenerating(false);

      // Filter anomalies in date range for selected devices
      const filteredAnomalies = anomalies.filter((a) => {
        const timestamp = new Date(a.timestamp);
        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return selectedDevices.includes(a.device_id) && timestamp >= start && timestamp <= end;
      });

      setGeneratedData({
        reportType,
        startDate,
        endDate,
        format,
        devicesCount: selectedDevices.length,
        devicesSelected: selectedDevices,
        anomaliesList: filteredAnomalies,
        timestamp: new Date().toISOString()
      });
    }, 700);
  };

  // Timezone formatting helper for India Standard Time (IST, UTC+5:30)
  const formatToIST = (dateStr) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    }).format(date);
  };

  const handleDownload = () => {
    if (!generatedData) return;
    let filename = `report_${reportType.toLowerCase().replace(/\s+/g, '_')}_${startDate}_to_${endDate}`;
    let content = '';
    let mimeType = 'text/plain';

    if (format === 'JSON') {
      mimeType = 'application/json';
      filename += '.json';
      content = JSON.stringify({
        reportType,
        period: { startDate, endDate },
        generatedAt: formatToIST(generatedData.timestamp),
        devicesCount: generatedData.devicesCount,
        devices: generatedData.devicesSelected,
        ...(reportType === 'Anomaly Report' ? { anomaliesCount: generatedData.anomaliesList.length, anomalies: generatedData.anomaliesList } : {})
      }, null, 2);
    } else if (format === 'CSV') {
      mimeType = 'text/csv';
      filename += '.csv';
      if (reportType === 'Anomaly Report') {
        content = `Anomaly Report\nPeriod,${startDate} to ${endDate}\nGenerated At (IST),${formatToIST(generatedData.timestamp)}\n\nID,Device,Failing Values,Confidence,Time (IST)\n`;
        generatedData.anomaliesList.forEach((a) => {
          const valString = Object.keys(a.values || {}).map((k) => `${k}: ${a.values[k]}`).join('; ');
          const mlConf = a.anomaly_flags?.ml_score ? `${(a.anomaly_flags.ml_score * 100).toFixed(0)}%` : 'Rule-based';
          content += `#ANM-${a.id},${a.device_id},"${valString}",${mlConf},"${formatToIST(a.timestamp)}"\n`;
        });
      } else {
        content = `Report Type,${reportType}\nPeriod,${startDate} to ${endDate}\nGenerated At (IST),${formatToIST(generatedData.timestamp)}\nDevices Count,${generatedData.devicesCount}\n`;
      }
    } else {
      // PDF Mockup as structured text file
      filename += '.txt';
      content = `====================================================\n${reportType.toUpperCase()} REPORT\n====================================================\n`;
      content += `Period: ${startDate} to ${endDate}\n`;
      content += `Generated At (IST): ${formatToIST(generatedData.timestamp)}\n`;
      content += `Devices Evaluated: ${generatedData.devicesSelected.join(', ')}\n\n`;
      
      if (reportType === 'Anomaly Report') {
        content += `DETECTED ANOMALIES LOG:\n\n`;
        if (generatedData.anomaliesList.length === 0) {
          content += `No anomalies detected in selected window.\n`;
        } else {
          generatedData.anomaliesList.forEach((a) => {
            const valString = Object.keys(a.values || {}).map((k) => `${k}: ${a.values[k]}`).join(', ');
            const mlConf = a.anomaly_flags?.ml_score ? `${(a.anomaly_flags.ml_score * 100).toFixed(0)}%` : 'Rule-based';
            content += `[#ANM-${a.id}] Device: ${a.device_id} | Values: ${valString} | Confidence: ${mlConf} | Time (IST): ${formatToIST(a.timestamp)}\n`;
          });
        }
      } else if (reportType === 'Water Quality Compliance') {
        content += `SUMMARY STATISTICS:\n`;
        content += `- Average Quality Score: 92.4 / 100\n`;
        content += `- Compliance Rate: 98.7%\n`;
      } else if (reportType === 'Operational Summary') {
        content += `SUMMARY STATISTICS:\n`;
        content += `- Active Hours: 504 hrs\n`;
        content += `- Network Uptime: 99.2%\n`;
      } else {
        content += `SUMMARY STATISTICS:\n`;
        content += `- Calibration Cycles: 3 complete\n`;
        content += `- Diagnostics Result: Nominal (100%)\n`;
      }
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-border-subtle pb-6">
        <h2 className="font-headline-md text-headline-md text-on-surface">Reports Generator</h2>
        <p className="text-on-surface-variant text-sm">Generate compliance and operational reports for regulatory submission</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Form Card */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6 space-y-6 h-full flex flex-col justify-between">
            <div className="space-y-5">
              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2 font-semibold">Report Type</label>
                <select 
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer font-semibold text-on-surface"
                >
                  <option value="Water Quality Compliance">Water Quality Compliance</option>
                  <option value="Operational Summary">Operational Summary</option>
                  <option value="Anomaly Report">Anomaly Report</option>
                  <option value="Maintenance Log">Maintenance Log</option>
                </select>
              </div>

              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2 font-semibold">Date Range</label>
                <div className="flex gap-2">
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="flex-1 border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary outline-none cursor-pointer" 
                  />
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="flex-1 border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md focus:ring-2 focus:ring-primary outline-none cursor-pointer" 
                  />
                </div>
              </div>

              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2 font-semibold">Devices</label>
                <select 
                  multiple 
                  value={selectedDevices}
                  onChange={(e) => {
                    const options = [...e.target.options];
                    const selected = options.filter((o) => o.selected).map((o) => o.value);
                    setSelectedDevices(selected);
                  }}
                  className="w-full border border-border-subtle rounded p-3 bg-surface-container-lowest text-body-md h-32 focus:ring-2 focus:ring-primary outline-none custom-scrollbar font-mono"
                >
                  {devicesList.map((d) => (
                    <option key={d.device_id} value={d.device_id}>
                      {d.device_id} ({d.location || 'Unknown Location'})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-outline mt-1 font-bold">Hold Ctrl/Cmd to select multiple. ({selectedDevices.length} selected)</p>
              </div>

              <div>
                <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2 font-semibold">Format</label>
                <div className="flex gap-2">
                  {['PDF', 'CSV', 'JSON'].map((f) => (
                    <button 
                      key={f} 
                      onClick={() => setFormat(f)}
                      className={`flex-1 py-2.5 border text-label-sm font-bold transition-all rounded cursor-pointer ${
                        format === f 
                          ? 'border-primary bg-primary text-on-primary shadow-sm' 
                          : 'border-border-subtle hover:bg-surface-container text-on-surface-variant'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button 
              className={`w-full text-on-primary py-4 font-title-md primary-action-btn flex items-center justify-center gap-2 rounded cursor-pointer mt-6 transition-all hover:bg-primary/95 ${
                isGenerating ? 'bg-surface-container text-outline cursor-wait' : 'bg-primary'
              }`}
              onClick={handleGenerateReport}
              disabled={isGenerating || selectedDevices.length === 0}
            >
              <span className="material-symbols-outlined">
                {isGenerating ? 'sync' : 'description'}
              </span>
              {isGenerating ? 'Generating Report...' : 'Generate Report'}
            </button>
          </div>
        </div>

        {/* Right: Preview Card */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-6 h-full flex flex-col min-h-[500px]">
            {isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center text-primary animate-pulse">
                <span className="material-symbols-outlined animate-spin text-[48px] mb-2">sync</span>
                <p className="text-sm font-semibold">Generating Operational Report...</p>
                <p className="text-xs text-outline mt-1 font-semibold">Extracting telemetry logs and formatting data</p>
              </div>
            ) : !generatedData ? (
              <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[64px] opacity-20">description</span>
                <p className="text-title-md mt-4">Report Preview</p>
                <p className="text-label-sm text-outline font-semibold">Configure and generate a report to see the preview</p>
              </div>
            ) : (
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                <div className="flex justify-between items-center">
                  <h3 className="font-title-md text-title-md text-on-surface">{generatedData.reportType} Preview</h3>
                  <button 
                    onClick={handleDownload}
                    className="px-4 py-2 border border-border-subtle text-label-sm font-bold hover:bg-surface-container transition-all flex items-center gap-2 rounded cursor-pointer btn-premium"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span> Download ({generatedData.format})
                  </button>
                </div>

                <div className="border border-border-subtle p-6 bg-surface-container-low rounded space-y-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="text-center border-b border-border-subtle/70 pb-4 mb-4">
                      <h4 className="font-headline-md text-primary font-black tracking-tighter">HYDRONIX</h4>
                      <p className="text-[11px] uppercase tracking-wider text-outline font-bold mt-1">
                        {generatedData.reportType} • {generatedData.startDate} to {generatedData.endDate}
                      </p>
                    </div>

                    {/* Report Specific Render Cards */}
                    {generatedData.reportType === 'Water Quality Compliance' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                          <div className="bg-white p-3 rounded border border-border-subtle/50"><span className="text-outline uppercase block text-[9px] mb-0.5">Evaluation Period</span> <span className="font-bold text-on-surface">{generatedData.startDate} to {generatedData.endDate}</span></div>
                          <div className="bg-white p-3 rounded border border-border-subtle/50"><span className="text-outline uppercase block text-[9px] mb-0.5">Active Nodes</span> <span className="font-bold text-on-surface">{generatedData.devicesCount} selected</span></div>
                          <div className="bg-white p-3 rounded border border-border-subtle/50"><span className="text-outline uppercase block text-[9px] mb-0.5">Avg WQI Score</span> <span className="font-bold text-status-nominal">92.4 / 100</span></div>
                          <div className="bg-white p-3 rounded border border-border-subtle/50"><span className="text-outline uppercase block text-[9px] mb-0.5 font-bold">Compliance Status</span> <span className="font-bold text-status-nominal">98.7%</span></div>
                        </div>
                        <div className="h-32 bg-surface-container rounded flex items-end justify-between p-3 gap-1 border border-border-subtle/50">
                          {[70, 85, 90, 88, 92, 95, 91, 89, 94, 92, 90, 93].map((h, i) => (
                            <div key={i} className="flex-1 bg-primary/40 rounded-t-sm" style={{height: `${h}%`}}></div>
                          ))}
                        </div>
                      </div>
                    )}

                    {generatedData.reportType === 'Operational Summary' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                          <div className="bg-white p-3 rounded border border-border-subtle/50"><span className="text-outline uppercase block text-[9px] mb-0.5">Active Run-Hours</span> <span className="font-bold text-on-surface">504 hours</span></div>
                          <div className="bg-white p-3 rounded border border-border-subtle/50"><span className="text-outline uppercase block text-[9px] mb-0.5">Uptime Ratio</span> <span className="font-bold text-status-nominal">99.2%</span></div>
                          <div className="bg-white p-3 rounded border border-border-subtle/50"><span className="text-outline uppercase block text-[9px] mb-0.5">Packets Received</span> <span className="font-bold text-on-surface">24,592 logs</span></div>
                          <div className="bg-white p-3 rounded border border-border-subtle/50"><span className="text-outline uppercase block text-[9px] mb-0.5 font-bold">Transmission Loss</span> <span className="font-bold text-status-nominal">0.15%</span></div>
                        </div>
                        <div className="h-32 bg-surface-container rounded flex items-end justify-between p-3 gap-1 border border-border-subtle/50">
                          {[80, 85, 90, 95, 100, 98, 97, 95, 92, 90, 94, 96].map((h, i) => (
                            <div key={i} className="flex-1 bg-primary/40 rounded-t-sm" style={{height: `${h}%`}}></div>
                          ))}
                        </div>
                      </div>
                    )}

                    {generatedData.reportType === 'Anomaly Report' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-3 text-xs font-semibold">
                          <div className="bg-white p-2.5 rounded border border-border-subtle/50"><span className="text-outline uppercase block text-[8px] mb-0.5">Total Anomalies</span> <span className="font-bold text-status-critical">{generatedData.anomaliesList.length} Flagged</span></div>
                          <div className="bg-white p-2.5 rounded border border-border-subtle/50"><span className="text-outline uppercase block text-[8px] mb-0.5">Confidence Avg</span> <span className="font-bold text-primary">92.4%</span></div>
                          <div className="bg-white p-2.5 rounded border border-border-subtle/50"><span className="text-outline uppercase block text-[8px] mb-0.5 font-bold">Alert timezone</span> <span className="font-bold text-on-surface">IST (UTC+5.5)</span></div>
                        </div>
                        
                        <div className="border border-border-subtle rounded overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-surface-container border-b border-border-subtle text-[10px] font-bold uppercase tracking-wider text-on-surface">
                                <th className="px-3 py-2">ID</th>
                                <th className="px-3 py-2">Node</th>
                                <th className="px-3 py-2 font-mono">Time (IST)</th>
                                <th className="px-3 py-2">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle/50 bg-white">
                              {generatedData.anomaliesList.length === 0 ? (
                                <tr>
                                  <td colSpan="4" className="text-center py-6 text-outline text-xs">No anomalies flagged in this period.</td>
                                </tr>
                              ) : (
                                generatedData.anomaliesList.slice(0, 4).map((a) => (
                                  <tr key={a.id} className="hover:bg-surface-container-low/30">
                                    <td className="px-3 py-2 font-bold">#ANM-{a.id}</td>
                                    <td className="px-3 py-2 font-semibold text-primary">{a.device_id}</td>
                                    <td className="px-3 py-2 text-outline font-mono">{formatToIST(a.timestamp)}</td>
                                    <td className="px-3 py-2 text-status-critical font-bold text-[9px] uppercase">Flagged</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        {generatedData.anomaliesList.length > 4 && (
                          <p className="text-[10px] text-outline text-right font-bold">and {generatedData.anomaliesList.length - 4} more anomalies in export file...</p>
                        )}
                      </div>
                    )}

                    {generatedData.reportType === 'Maintenance Log' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                          <div className="bg-white p-3 rounded border border-border-subtle/50"><span className="text-outline uppercase block text-[9px] mb-0.5">Calibrated Nodes</span> <span className="font-bold text-on-surface">3 devices</span></div>
                          <div className="bg-white p-3 rounded border border-border-subtle/50"><span className="text-outline uppercase block text-[9px] mb-0.5">Firmware Channel</span> <span className="font-bold text-on-surface">stable-v2</span></div>
                          <div className="bg-white p-3 rounded border border-border-subtle/50"><span className="text-outline uppercase block text-[9px] mb-0.5">Diagnostics test</span> <span className="font-bold text-status-nominal">Passed</span></div>
                          <div className="bg-white p-3 rounded border border-border-subtle/50"><span className="text-outline uppercase block text-[9px] mb-0.5 font-bold">Next Maintenance</span> <span className="font-bold text-primary">01-07-2026</span></div>
                        </div>
                        <div className="bg-white p-4 rounded border border-border-subtle/50 space-y-2 text-xs font-mono text-on-surface-variant">
                          <p>[21-06-2026] HYDRO-001: Sensor probe calibrated.</p>
                          <p>[20-06-2026] HYDRO-003: Flow control valve rotated.</p>
                          <p>[18-06-2026] HYDRO-012: Wi-Fi antenna diagnostics clean.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-outline pt-4 border-t border-border-subtle/70 font-semibold uppercase">
                    <span>Authorized Tier: Level 3 Operator</span>
                    <span>System Generated (IST): {formatToIST(generatedData.timestamp)}</span>
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
