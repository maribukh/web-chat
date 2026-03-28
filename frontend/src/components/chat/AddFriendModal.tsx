import { useState } from 'react';
import Modal from '../ui/Modal';
import api from '../../lib/api';
import { Loader2 } from 'lucide-react';

interface AddFriendModalProps {
  onClose: () => void;
}

export default function AddFriendModal({ onClose }: AddFriendModalProps) {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/friends/request', { username: username.trim(), message: message.trim() || undefined });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send friend request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add Friend" onClose={onClose}>
      {success ? (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--online)', fontSize: '1rem', fontWeight: 600 }}>
          ✓ Friend request sent!
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="auth-error" style={{ marginBottom: '16px' }}>{error}</div>
          )}
          <div className="modal-field">
            <label className="modal-label">Username</label>
            <input
              className="modal-input"
              placeholder="Enter exact username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="modal-field">
            <label className="modal-label">Message (optional)</label>
            <input
              className="modal-input"
              placeholder="Hi! Let's chat."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !username.trim()}>
              {loading ? <><Loader2 size={14} className="animate-spin" /> Sending...</> : 'Send Request'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
