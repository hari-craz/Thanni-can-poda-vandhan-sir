import React from 'react';

const logs = [
  { time: '14:32:01', actor: 'admin@hydronix.local', action: 'VALVE_CLOSED', resource: 'HYDRO_001', ip: '192.168.1.42' },
  { time: '14:28:15', actor: 'system', action: 'OTA_DEPLOYED', resource: 'Sector-B (128 nodes)', ip: '—' },
  { time: '14:22:05', actor: 'admin@hydronix.local', action: 'ALERT_ACKNOWLEDGED', resource: '#INC-4921', ip: '192.168.1.42' },
  { time: '14:18:44', actor: 'sarah@hydronix.local', action: 'USER_LOGIN', resource: 'Dashboard', ip: '10.0.0.15' },
  { time: '14:15:59', actor: 'system', action: 'FIRMWARE_HANDSHAKE', resource: 'CE-HUB-GLO-01', ip: '—' },
  { time: '14:10:22', actor: 'mike@hydronix.local', action: 'REPORT_GENERATED', resource: 'WQ Compliance Jan 2024', ip: '10.0.0.23' },
  { time: '14:05:11', actor: 'system', action: 'ANOMALY_DETECTED', resource: 'HYDRO-007 (pH)', ip: '—' },
  { time: '13:58:30', actor: 'admin@hydronix.local', action: 'DEVICE_PROVISIONED', resource: 'HYDRO-015', ip: '192.168.1.42' },
];

export default function SecurityAuditLogs() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-border-subtle pb-6">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Security Audit Logs</h2>
          <p className="text-on-surface-variant text-sm">Immutable, read-only record of all system actions and events</p>
        </div>
        <button className="px-6 py-2 border border-border-subtle bg-surface-container-lowest text-label-sm font-bold hover:bg-surface-container transition-all flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">download</span> Export Logs
        </button>
      </div>

      <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border-subtle bg-surface-container flex justify-between items-center">
          <h3 className="font-bold text-sm uppercase tracking-widest">Event Log</h3>
          <span className="text-[10px] font-bold text-outline uppercase">Today • {logs.length} events</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono">
            <thead>
              <tr className="border-b border-border-subtle text-[10px] font-bold uppercase tracking-widest text-on-primary bg-on-surface">
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Actor</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Resource</th>
                <th className="px-6 py-4">Source IP</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {logs.map((log, i) => (
                <tr key={i} className="border-b border-border-subtle hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-3 text-outline">{log.time}</td>
                  <td className="px-6 py-3">{log.actor}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 text-[9px] font-bold uppercase border rounded ${
                      log.action.includes('CLOSED') || log.action.includes('ANOMALY') ? 'border-status-critical text-status-critical' :
                      log.action.includes('LOGIN') || log.action.includes('ACKNOWLEDGED') ? 'border-status-nominal text-status-nominal' :
                      'border-primary text-primary'
                    }`}>{log.action}</span>
                  </td>
                  <td className="px-6 py-3 text-on-surface-variant">{log.resource}</td>
                  <td className="px-6 py-3 text-outline">{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-surface-container flex justify-between items-center text-[10px] font-bold text-outline border-t border-border-subtle">
          <p className="uppercase tracking-widest">Showing {logs.length} of 2,847 events</p>
          <div className="flex gap-1">
            <button className="w-8 h-8 border border-on-surface flex items-center justify-center bg-surface-container-lowest">1</button>
            <button className="w-8 h-8 border border-border-subtle flex items-center justify-center bg-surface-container-lowest hover:border-on-surface">2</button>
            <button className="w-8 h-8 border border-border-subtle flex items-center justify-center bg-surface-container-lowest hover:border-on-surface">3</button>
          </div>
        </div>
      </div>
    </div>
  );
}
