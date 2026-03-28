import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Hash, MessageSquare, LogOut, Plus, Bell, Search, Globe } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../../lib/api';
import { usePresence } from '../../hooks/usePresence';
import { usePresenceStore } from '../../store/presenceStore';
import CreateRoomModal from '../chat/CreateRoomModal';
import AddFriendModal from '../chat/AddFriendModal';

function getAvatarColor(username: string) {
  const colors = ['#6c63ff', '#e85d75', '#3ba55d', '#faa61a', '#5b9bd5', '#e67e22', '#9b59b6', '#1abc9c'];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function ChatLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const queryClient = useQueryClient();
  const getStatus = usePresenceStore((s) => s.getStatus);

  // Activate AFK detection
  usePresence();

  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [showCatalog, setShowCatalog] = useState(false);

  // My joined rooms
  const { data: myRooms = [] } = useQuery({
    queryKey: ['myRooms'],
    queryFn: async () => {
      const res = await api.get('/rooms/mine');
      return res.data;
    },
  });

  // Public catalog rooms (for browsing)
  const { data: publicRooms = [] } = useQuery({
    queryKey: ['publicRooms'],
    queryFn: async () => {
      const res = await api.get('/rooms/public');
      return res.data;
    },
    enabled: showCatalog,
  });

  // Friends
  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      const res = await api.get('/friends');
      return res.data;
    },
  });

  // Friend requests (pending)
  const { data: requests = [] } = useQuery({
    queryKey: ['friendRequests'],
    queryFn: async () => {
      const res = await api.get('/friends/requests');
      return res.data;
    },
    refetchInterval: 15000,
  });

  const handleAcceptRequest = async (id: string, accept: boolean) => {
    try {
      await api.post(`/friends/request/${id}/respond`, { accept });
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      if (accept) queryClient.invalidateQueries({ queryKey: ['friends'] });
    } catch (err) {
      console.error('Failed to respond to request', err);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    try {
      await api.post(`/rooms/${roomId}/join`);
      queryClient.invalidateQueries({ queryKey: ['myRooms'] });
      setShowCatalog(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to join room');
    }
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/') && path !== '/';
  const myStatus = user ? getStatus(user.id) : 'offline';

  const filteredRooms = myRooms.filter((r: any) =>
    r.name.toLowerCase().includes(roomSearch.toLowerCase())
  );
  const filteredFriends = friends.filter((f: any) =>
    f.username.toLowerCase().includes(friendSearch.toLowerCase())
  );

  return (
    <div className="chat-root">
      {/* Sidebar */}
      <div className="sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <MessageSquare size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span className="sidebar-header-title">Web Chat</span>
          {requests.length > 0 && (
            <span className="sidebar-badge">{requests.length}</span>
          )}
        </div>

        <div className="sidebar-body custom-scrollbar">
          {/* ===== ROOMS ===== */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <span className="sidebar-section-title">Rooms</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="sidebar-icon-btn"
                  title="Browse public rooms"
                  onClick={() => setShowCatalog(!showCatalog)}
                >
                  <Globe size={14} />
                </button>
                <button
                  className="sidebar-icon-btn"
                  title="Create room"
                  onClick={() => setShowCreateRoom(true)}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Room search */}
            <div style={{ padding: '0 0 6px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  className="search-input"
                  style={{ paddingLeft: 28, fontSize: '0.8rem', padding: '5px 8px 5px 26px' }}
                  placeholder="Search rooms..."
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Public room catalog */}
            {showCatalog && (
              <div style={{ marginBottom: 8, padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, padding: '0 4px' }}>
                  Public Rooms
                </div>
                {publicRooms.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '4px 8px' }}>No public rooms</div>
                ) : (
                  publicRooms.map((room: any) => {
                    const alreadyMember = myRooms.some((r: any) => r.id === room.id);
                    return (
                      <div key={room.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', borderRadius: 6, marginBottom: 2 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#{room.name}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{room._count?.members ?? 0} members</div>
                        </div>
                        {!alreadyMember && (
                          <button className="btn btn-primary" style={{ padding: '3px 8px', fontSize: '0.72rem' }} onClick={() => handleJoinRoom(room.id)}>
                            Join
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* My rooms list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {filteredRooms.length === 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '4px 8px' }}>
                  {roomSearch ? 'No rooms match' : 'No rooms yet'}
                </div>
              )}
              {filteredRooms.map((room: any) => (
                <Link
                  key={room.id}
                  to={`/room/${room.id}`}
                  className={`sidebar-item ${isActive(`/room/${room.id}`) ? 'active' : ''}`}
                >
                  <Hash size={16} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                  <span className="sidebar-item-name">{room.name}</span>
                  {room.visibility === 'private' && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>🔒</span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* ===== DIRECT MESSAGES ===== */}
          <div className="sidebar-section">
            <div className="sidebar-section-header">
              <span className="sidebar-section-title">Direct Messages</span>
              <button
                className="sidebar-icon-btn"
                title="Add friend"
                onClick={() => setShowAddFriend(true)}
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Friend search */}
            <div style={{ padding: '0 0 6px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  className="search-input"
                  style={{ paddingLeft: 28, fontSize: '0.8rem', padding: '5px 8px 5px 26px' }}
                  placeholder="Search friends..."
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {filteredFriends.length === 0 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '4px 8px' }}>
                  {friendSearch ? 'No friends match' : 'No friends yet'}
                </div>
              )}
              {filteredFriends.map((friend: any) => {
                const status = getStatus(friend.id);
                return (
                  <Link
                    key={friend.id}
                    to={`/dm/${friend.id}`}
                    className={`sidebar-item ${isActive(`/dm/${friend.id}`) ? 'active' : ''}`}
                  >
                    <div className="avatar avatar-sm" style={{ background: getAvatarColor(friend.username) }}>
                      {friend.username.charAt(0).toUpperCase()}
                      <span className={`avatar-presence ${status}`} />
                    </div>
                    <span className="sidebar-item-name">{friend.username}</span>
                    <span className={`presence-dot ${status}`} style={{ width: 6, height: 6 }} />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ===== PENDING REQUESTS ===== */}
          {requests.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-section-header">
                <span className="sidebar-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Bell size={11} /> Requests
                  <span className="sidebar-badge">{requests.length}</span>
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {requests.map((req: any) => (
                  <div
                    key={req.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      background: 'rgba(108,99,255,0.08)',
                      borderRadius: 8,
                      border: '1px solid rgba(108,99,255,0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div className="avatar avatar-sm" style={{ background: getAvatarColor(req.fromUser.username) }}>
                        {req.fromUser.username.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.fromUser.username}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => handleAcceptRequest(req.id, true)}
                        style={{ background: 'rgba(59,165,93,0.2)', border: '1px solid rgba(59,165,93,0.4)', color: '#3ba55d', borderRadius: 4, padding: '2px 7px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700 }}
                      >✓</button>
                      <button
                        onClick={() => handleAcceptRequest(req.id, false)}
                        style={{ background: 'rgba(237,66,69,0.12)', border: '1px solid rgba(237,66,69,0.3)', color: '#ed4245', borderRadius: 4, padding: '2px 7px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 700 }}
                      >✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-user" title={user?.email}>
            <div className="avatar avatar-sm" style={{ background: user ? getAvatarColor(user.username) : '#6c63ff' }}>
              {user?.username?.charAt(0).toUpperCase() || 'U'}
              <span className={`avatar-presence ${myStatus}`} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="sidebar-footer-name">{user?.username}</div>
              <div className="sidebar-footer-status" style={{ color: myStatus === 'online' ? 'var(--online)' : myStatus === 'afk' ? 'var(--afk)' : 'var(--offline)' }}>
                {myStatus === 'online' ? 'Online' : myStatus === 'afk' ? 'Away' : 'Offline'}
              </div>
            </div>
          </div>
          <button className="sidebar-footer-btn" onClick={logout} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="chat-main">
        <Outlet />
      </div>

      {/* Modals */}
      {showCreateRoom && <CreateRoomModal onClose={() => setShowCreateRoom(false)} />}
      {showAddFriend && <AddFriendModal onClose={() => setShowAddFriend(false)} />}
    </div>
  );
}
