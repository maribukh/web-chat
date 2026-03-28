import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { usePresenceStore } from '../../store/presenceStore';
import { useAuthStore } from '../../store/authStore';
import { Crown, Shield, MoreVertical } from 'lucide-react';
import { useState } from 'react';

interface RoomMemberPanelProps {
  roomId: string;
}

function getAvatarColor(username: string) {
  const colors = ['#6c63ff', '#e85d75', '#3ba55d', '#faa61a', '#5b9bd5', '#e67e22', '#9b59b6', '#1abc9c'];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

type PresenceStatus = 'online' | 'afk' | 'offline';

// PRESENCE_LABEL is unused for now, so I'll comment it out or remove it
/*
const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  online: 'Online',
  afk: 'Away',
  offline: 'Offline',
};
*/

export default function RoomMemberPanel({ roomId }: RoomMemberPanelProps) {
  const { user } = useAuthStore();
  const getStatus = usePresenceStore((s) => s.getStatus);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data: room } = useQuery({
    queryKey: ['roomDetails', roomId],
    queryFn: async () => {
      const res = await api.get(`/rooms/${roomId}`);
      return res.data;
    },
    enabled: !!roomId,
  });

  const members: any[] = room?.members ?? [];
  const myMember = members.find((m) => m.userId === user?.id);
  const isAdmin = myMember?.role === 'owner' || myMember?.role === 'admin';

  const online = members.filter((m) => getStatus(m.userId) === 'online');
  const afk = members.filter((m) => getStatus(m.userId) === 'afk');
  const offline = members.filter((m) => getStatus(m.userId) === 'offline');

  const renderMember = (m: any) => {
    const status = getStatus(m.userId) as PresenceStatus;
    const username = m.user?.username ?? m.userId;

    return (
      <div key={m.userId} className="member-item" style={{ position: 'relative' }}>
        <div className="avatar avatar-sm" style={{ background: getAvatarColor(username) }}>
          {username.charAt(0).toUpperCase()}
          <span className={`avatar-presence ${status}`} />
        </div>
        <span className="member-name" title={username}>{username}</span>
        {(m.role === 'owner' || m.role === 'admin') && (
          <span className={`member-role-badge ${m.role}`}>
            {m.role === 'owner' ? <Crown size={10} /> : <Shield size={10} />}
          </span>
        )}
        {isAdmin && m.userId !== user?.id && m.role !== 'owner' && (
          <button
            className="message-action-btn"
            style={{ opacity: 0, padding: '2px', transition: 'opacity 0.15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
            onClick={() => setMenuOpen(menuOpen === m.userId ? null : m.userId)}
            title="Member actions"
          >
            <MoreVertical size={14} />
          </button>
        )}
        {menuOpen === m.userId && (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              zIndex: 50,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              minWidth: '140px',
              overflow: 'hidden',
            }}
          >
            {['Kick', 'Ban', m.role === 'admin' ? 'Demote' : 'Promote to Admin'].map((action) => (
              <button
                key={action}
                className="message-action-btn"
                style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: '0.875rem', color: action === 'Ban' || action === 'Kick' ? '#ed4245' : 'var(--text-secondary)' }}
                onClick={() => {
                  setMenuOpen(null);
                  // Actions handled via API calls from parent or dedicated handler
                  handleMemberAction(action.toLowerCase().split(' ')[0], m.userId, roomId, myMember?.role);
                }}
              >
                {action}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="member-panel custom-scrollbar" onClick={() => setMenuOpen(null)}>
      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', padding: '0 8px 12px', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
        Members — {members.length}
      </div>

      {online.length > 0 && (
        <>
          <div className="member-panel-section-title">Online — {online.length}</div>
          {online.map(renderMember)}
        </>
      )}
      {afk.length > 0 && (
        <>
          <div className="member-panel-section-title">Away — {afk.length}</div>
          {afk.map(renderMember)}
        </>
      )}
      {offline.length > 0 && (
        <>
          <div className="member-panel-section-title">Offline — {offline.length}</div>
          {offline.map(renderMember)}
        </>
      )}
    </div>
  );
}

async function handleMemberAction(action: string, targetUserId: string, roomId: string, _myRole?: string) {
  try {
    if (action === 'kick' || action === 'ban') {
      await api.post(`/rooms/${roomId}/${action}`, { targetUserId });
    } else if (action === 'promote') {
      await api.post(`/rooms/${roomId}/promote`, { targetUserId });
    } else if (action === 'demote') {
      await api.post(`/rooms/${roomId}/demote`, { targetUserId });
    }
  } catch (err: any) {
    console.error(`Failed to ${action}:`, err.response?.data?.error || err.message);
  }
}
