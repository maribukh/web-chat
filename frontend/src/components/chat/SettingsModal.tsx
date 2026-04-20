import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Loader2, Trash2, LogOut, MonitorSmartphone } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'account' | 'sessions'>('account');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { logout } = useAuthStore();

  const fetchSessions = async () => {
    try {
      const res = await api.get('/auth/sessions');
      setSessions(res.data);
    } catch {
      setError('Failed to load sessions');
    }
  };

  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchSessions();
    }
  }, [activeTab]);

  const handleDeleteAccount = async () => {
    if (!window.confirm('Are you sure you want to delete your account? This action is permanent and will delete all rooms you own and their messages.')) {
      return;
    }
    setLoading(true);
    try {
      await api.delete('/auth/account');
      logout();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete account');
      setLoading(false);
    }
  };

  const handleLogoutSession = async (id: string) => {
    try {
      await api.delete(`/auth/sessions/${id}`);
      setSessions(sessions.filter((s) => s.id !== id));
    } catch {
      alert('Failed to delete session');
    }
  };

  return (
    <Modal title="User Settings" onClose={onClose}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <button
          className={`modal-toggle ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveTab('account')}
          style={{ padding: '6px 12px', flex: 1 }}
        >
          Account
        </button>
        <button
          className={`modal-toggle ${activeTab === 'sessions' ? 'active' : ''}`}
          onClick={() => setActiveTab('sessions')}
          style={{ padding: '6px 12px', flex: 1 }}
        >
          Sessions
        </button>
      </div>

      {error && <div className="auth-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {activeTab === 'account' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '4px' }}>Danger Zone</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
              Deleting your account will permanently remove your data, including any public or private rooms you created.
            </p>
            <button
              className="btn"
              style={{ background: 'rgba(237, 66, 69, 0.1)', color: '#ed4245', border: '1px solid #ed4245', display: 'flex', alignItems: 'center', gap: '8px' }}
              onClick={handleDeleteAccount}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Delete Account
            </button>
          </div>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }} className="custom-scrollbar">
          {sessions.length === 0 && <span style={{ color: 'var(--text-muted)' }}>Loading sessions...</span>}
          {sessions.map((session) => (
            <div key={session.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <MonitorSmartphone size={24} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600 }}>
                    {session.ipAddress || 'Unknown IP'} {session.isCurrent && <span style={{ fontSize: '0.7rem', color: '#43b581', marginLeft: '6px' }}>(Current)</span>}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    {session.userAgent ? session.userAgent.split(' ')[0] : 'Unknown Browser'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    Active: {new Date(session.lastActivity).toLocaleString()}
                  </div>
                </div>
              </div>
              {!session.isCurrent && (
                <button
                  className="btn"
                  style={{ background: 'transparent', padding: '6px 12px', color: 'var(--text-muted)' }}
                  onClick={() => handleLogoutSession(session.id)}
                  title="Log out session"
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="modal-footer" style={{ marginTop: '20px' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
