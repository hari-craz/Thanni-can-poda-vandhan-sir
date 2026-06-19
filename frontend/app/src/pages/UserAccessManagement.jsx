import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export default function UserAccessManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Modals & Forms State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  
  // Invite Form Inputs
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState('admin');
  const [inviteError, setInviteError] = useState(null);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  
  // Reset Form Inputs
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  useEffect(() => {
    const userProfile = api.getCurrentUser();
    setCurrentUser(userProfile);
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch users list.');
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteSubmit(e) {
    e.preventDefault();
    setInviteError(null);
    setInviteSubmitting(true);
    try {
      await api.createUser({
        name: inviteName.trim(),
        email: inviteEmail.trim().toLowerCase(),
        password: invitePassword,
        role: inviteRole,
      });
      // Clear form & close
      setInviteName('');
      setInviteEmail('');
      setInvitePassword('');
      setInviteRole('admin');
      setInviteModalOpen(false);
      // Refresh user list
      fetchUsers();
    } catch (err) {
      setInviteError(err.message || 'Failed to invite user.');
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function handleResetPasswordSubmit(e) {
    e.preventDefault();
    setResetError(null);
    setResetSubmitting(true);
    try {
      await api.resetUserPassword(selectedUser.id, resetPassword);
      setResetPassword('');
      setSelectedUser(null);
      setResetModalOpen(false);
      alert('Password reset successfully.');
    } catch (err) {
      setResetError(err.message || 'Failed to reset password.');
    } finally {
      setResetSubmitting(false);
    }
  }

  async function handleRevokeAccess(user) {
    if (!window.confirm(`Are you sure you want to revoke access and delete the user account for ${user.name || user.email}?`)) {
      return;
    }
    setMenuOpen(null);
    try {
      await api.deleteUser(user.id);
      fetchUsers();
    } catch (err) {
      alert(`Failed to revoke access: ${err.message}`);
    }
  }

  const isSuperAdmin = currentUser?.role === 'superadmin';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-border-subtle pb-6">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">User & Access Management</h2>
          <p className="text-on-surface-variant text-sm">Manage administrator accounts and access permissions</p>
        </div>
        {isSuperAdmin && (
          <button 
            onClick={() => setInviteModalOpen(true)}
            className="px-6 py-3 bg-primary text-on-primary font-bold text-label-sm primary-action-btn flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span> Invite User
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-status-critical/10 border border-status-critical/30 text-status-critical rounded text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <span className="animate-spin material-symbols-outlined text-[36px] text-primary">progress_activity</span>
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-subtle text-[10px] font-bold uppercase tracking-widest text-on-primary bg-on-surface">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Created At</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {users.map((user, i) => {
                  const isSelf = user.email === currentUser?.email;
                  return (
                    <tr key={user.id} className="border-b border-border-subtle hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4 font-bold flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-sm">
                          {(user.name || user.email).split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        {user.name || 'N/A'} {isSelf && <span className="text-xs text-primary font-normal">(You)</span>}
                      </td>
                      <td className="px-6 py-4 text-outline">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase border rounded ${
                          user.role === 'superadmin' ? 'border-primary text-primary bg-primary/5' :
                          'border-status-nominal text-status-nominal bg-status-nominal/5'
                        }`}>{user.role}</span>
                      </td>
                      <td className="px-6 py-4 text-outline">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-center relative">
                        {isSuperAdmin && !isSelf ? (
                          <>
                            <button 
                              className="p-1 hover:bg-surface-container rounded transition-colors" 
                              onClick={() => setMenuOpen(menuOpen === i ? null : i)}
                            >
                              <span className="material-symbols-outlined">more_vert</span>
                            </button>
                            {menuOpen === i && (
                              <div className="absolute right-6 top-full mt-1 bg-surface-container-lowest border border-border-subtle shadow-lg rounded z-10 w-48">
                                <button 
                                  className="w-full text-left px-4 py-3 text-sm hover:bg-surface-container transition-colors flex items-center gap-2" 
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setResetModalOpen(true);
                                    setMenuOpen(null);
                                  }}
                                >
                                  <span className="material-symbols-outlined text-[18px]">lock_reset</span> Reset Password
                                </button>
                                <button 
                                  className="w-full text-left px-4 py-3 text-sm hover:bg-status-critical/10 text-status-critical transition-colors flex items-center gap-2" 
                                  onClick={() => handleRevokeAccess(user)}
                                >
                                  <span className="material-symbols-outlined text-[18px]">block</span> Revoke Access
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-outline italic">No Actions</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border-subtle pb-3">
              <h3 className="font-bold text-lg">Invite New Administrator</h3>
              <button 
                onClick={() => setInviteModalOpen(false)}
                className="p-1 rounded-full hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            {inviteError && (
              <div className="p-3 bg-status-critical/10 border border-status-critical/30 text-status-critical rounded text-xs">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline">Full Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. John Doe"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full p-3 border border-border-subtle rounded bg-surface-container-lowest text-sm focus:outline-none focus:border-primary"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline">Email Address</label>
                <input 
                  type="email" 
                  required
                  placeholder="e.g. john@localhost.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full p-3 border border-border-subtle rounded bg-surface-container-lowest text-sm focus:outline-none focus:border-primary"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline">Initial Password</label>
                <input 
                  type="password" 
                  required
                  placeholder="At least 4 characters"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  className="w-full p-3 border border-border-subtle rounded bg-surface-container-lowest text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-outline">Role</label>
                <select 
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full p-3 border border-border-subtle rounded bg-surface-container-lowest text-sm focus:outline-none focus:border-primary"
                >
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <button 
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 border border-border-subtle rounded text-sm font-semibold hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={inviteSubmitting}
                  className="px-4 py-2 bg-primary text-on-primary rounded text-sm font-semibold hover:bg-primary-dark transition-colors flex items-center gap-1"
                >
                  {inviteSubmitting ? (
                    <>
                      <span className="animate-spin material-symbols-outlined text-[16px]">progress_activity</span>
                      Inviting...
                    </>
                  ) : 'Invite User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest border border-border-subtle rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border-subtle pb-3">
              <h3 className="font-bold text-lg">Reset Password</h3>
              <button 
                onClick={() => {
                  setSelectedUser(null);
                  setResetModalOpen(false);
                }}
                className="p-1 rounded-full hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            
            <p className="text-sm text-outline">
              Enter a new password for <strong>{selectedUser.name || selectedUser.email}</strong>.
            </p>

            {resetError && (
              <div className="p-3 bg-status-critical/10 border border-status-critical/30 text-status-critical rounded text-xs">
                {resetError}
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-outline">New Password</label>
                <input 
                  type="password" 
                  required
                  placeholder="At least 4 characters"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full p-3 border border-border-subtle rounded bg-surface-container-lowest text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <button 
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setResetModalOpen(false);
                  }}
                  className="px-4 py-2 border border-border-subtle rounded text-sm font-semibold hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={resetSubmitting}
                  className="px-4 py-2 bg-primary text-on-primary rounded text-sm font-semibold hover:bg-primary-dark transition-colors flex items-center gap-1"
                >
                  {resetSubmitting ? (
                    <>
                      <span className="animate-spin material-symbols-outlined text-[16px]">progress_activity</span>
                      Resetting...
                    </>
                  ) : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
