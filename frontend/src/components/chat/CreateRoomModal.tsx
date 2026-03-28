import { useState } from 'react';
import Modal from '../ui/Modal';
import api from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

interface CreateRoomModalProps {
  onClose: () => void;
}

export default function CreateRoomModal({ onClose }: CreateRoomModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/rooms', { name: name.trim(), description: description.trim(), visibility });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['myRooms'] });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Create Room" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="auth-error" style={{ marginBottom: '16px' }}>{error}</div>
        )}

        <div className="modal-field">
          <label className="modal-label">Room Name</label>
          <input
            className="modal-input"
            placeholder="e.g. general"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={60}
            autoFocus
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">Description (optional)</label>
          <textarea
            className="modal-input"
            placeholder="What is this room for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={200}
          />
        </div>

        <div className="modal-field">
          <label className="modal-label">Visibility</label>
          <div className="modal-toggle-group">
            <button
              type="button"
              className={`modal-toggle ${visibility === 'public' ? 'active' : ''}`}
              onClick={() => setVisibility('public')}
            >
              🌐 Public
            </button>
            <button
              type="button"
              className={`modal-toggle ${visibility === 'private' ? 'active' : ''}`}
              onClick={() => setVisibility('private')}
            >
              🔒 Private
            </button>
          </div>
          <span className="auth-hint">
            {visibility === 'public'
              ? 'Anyone can find and join this room'
              : 'Only invited users can join'}
          </span>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading || !name.trim()}>
            {loading ? <><Loader2 size={14} className="animate-spin" /> Creating...</> : 'Create Room'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
