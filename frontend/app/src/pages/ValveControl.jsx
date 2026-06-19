import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';

export default function ValveControl() {
  const { id } = useParams();
  const [valveState, setValveState] = useState('open'); // open or closed
  const [lastToggled, setLastToggled] = useState('');
  const [closeReason, setCloseReason] = useState('');
  const [history, setHistory] = useState([]);
  const [isActing, setIsActing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchValveData = async () => {
    try {
      const status = await api.getValveStatus(id);
      setValveState(status.valve_state || 'open');
      setLastToggled(status.valve_last_toggled ? new Date(status.valve_last_toggled).toLocaleString() : '—');
      setCloseReason(status.valve_close_reason || '');

      const hist = await api.getValveHistory(id, 20);
      setHistory(hist.operations || []);
    } catch (e) {
      console.error('Error fetching valve status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchValveData();
    const interval = setInterval(fetchValveData, 8000); // Poll status every 8s
    return () => clearInterval(interval);
  }, [id]);

  const handleValveAction = async (action) => {
    setIsActing(true);
    try {
      const reasonText = prompt(`Reason for manually ${action === 'open' ? 'opening' : 'closing'} the valve:`, `Manual override by operator`);
      if (reasonText === null) {
        setIsActing(false);
        return; // user cancelled
      }
      
      if (action === 'open') {
        await api.openValve(id, reasonText);
      } else {
        await api.closeValve(id, reasonText);
      }
      
      await fetchValveData();
    } catch (e) {
      alert(`Action failed: ${e.message}`);
    } finally {
      setIsActing(false);
    }
  };

  if (loading && history.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="material-symbols-outlined animate-spin text-[48px] text-primary">sync</span>
      </div>
    );
  }

  const isValveOpen = valveState.toLowerCase() === 'open';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-end border-b border-border-subtle pb-6">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">{id} Valve Control</h2>
          <p className="text-on-surface-variant text-sm">Remote actuation and flow management interface</p>
        </div>
        <Link 
          to={`/admin/device/${id}/telemetry`} 
          className="px-4 py-2 border border-border-subtle bg-surface-container-lowest text-label-sm font-bold hover:bg-surface-container transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">monitoring</span> View Telemetry
        </Link>
      </div>

      {/* Valve Status Card */}
      <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm p-8 text-center">
        <div className="mb-6">
          <span className={`material-symbols-outlined text-[96px] ${isValveOpen ? 'text-status-nominal' : 'text-status-critical'} transition-colors`}>
            {isValveOpen ? 'valve' : 'block'}
          </span>
        </div>
        <div className="mb-2">
          <span className={`px-4 py-2 rounded-full font-bold text-label-sm ${isValveOpen ? 'bg-status-nominal/10 text-status-nominal border border-status-nominal/30' : 'bg-status-critical/10 text-status-critical border border-status-critical/30'}`}>
            {isActing ? 'ACTUATING...' : `VALVE ${valveState.toUpperCase()}`}
          </span>
        </div>
        {closeReason && (
          <p className="text-status-critical font-semibold mt-2 text-sm">Reason for closure: {closeReason}</p>
        )}
        <p className="text-outline text-label-sm mt-4">Last toggled: {lastToggled}</p>

        {/* Control Buttons */}
        <div className="flex justify-center gap-4 mt-8">
          <button 
            className={`px-8 py-4 font-bold text-title-md primary-action-btn flex items-center gap-2 ${isValveOpen ? 'bg-surface-container text-outline cursor-not-allowed' : 'bg-status-nominal text-on-primary'}`}
            onClick={() => !isValveOpen && handleValveAction('open')}
            disabled={isValveOpen || isActing}
          >
            <span className="material-symbols-outlined">lock_open</span> Force Open
          </button>
          <button 
            className={`px-8 py-4 font-bold text-title-md primary-action-btn flex items-center gap-2 ${!isValveOpen ? 'bg-surface-container text-outline cursor-not-allowed' : 'bg-status-critical text-on-primary'}`}
            onClick={() => isValveOpen && handleValveAction('close')}
            disabled={!isValveOpen || isActing}
          >
            <span className="material-symbols-outlined">lock</span> Force Close
          </button>
        </div>
      </div>

      {/* Actuation Log */}
      <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border-subtle bg-surface-container">
          <h3 className="font-title-md text-title-md">Actuation History</h3>
        </div>
        <div className="divide-y divide-border-subtle max-h-[400px] overflow-y-auto custom-scrollbar">
          {history.length === 0 ? (
            <p className="p-6 text-center text-outline text-sm">No recorded valve events.</p>
          ) : (
            history.map((log) => {
              const isOpenAct = log.action === 'open';
              return (
                <div key={log.id} className="flex items-center gap-4 px-6 py-4 hover:bg-surface-container-low transition-colors">
                  <span className={`material-symbols-outlined ${isOpenAct ? 'text-status-nominal' : 'text-status-critical'}`}>
                    {isOpenAct ? 'lock_open' : 'lock'}
                  </span>
                  <div className="flex-1">
                    <p className="font-bold text-sm uppercase">{log.action}</p>
                    <p className="text-label-sm text-outline">{log.reason || 'No reason provided'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-label-sm font-bold">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-outline">
                      {log.triggered_by} {log.operator_id ? `(${log.operator_id})` : ''}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
