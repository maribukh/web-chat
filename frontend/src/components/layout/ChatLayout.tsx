import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Hash, MessageSquare, LogOut, Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

export default function ChatLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const res = await api.get('/rooms/public');
      return res.data;
    }
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      const res = await api.get('/friends');
      return res.data;
    }
  });

  const handleCreateRoom = async () => {
    const name = prompt('Enter room name:');
    if (!name) return;
    try {
      await api.post('/rooms', { name, visibility: 'public' });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    } catch (error) {
      console.error('Failed to create room', error);
      alert('Failed to create room');
    }
  };

  const handleAddFriend = async () => {
    const username = prompt('Enter friend username:');
    if (!username) return;
    try {
      await api.post('/friends/request', { username });
      alert('Friend request sent!');
    } catch (error: any) {
      console.error('Failed to send friend request', error);
      alert(error.response?.data?.error || 'Failed to send friend request');
    }
  };

  const { data: requests = [] } = useQuery({
    queryKey: ['friendRequests'],
    queryFn: async () => {
      const res = await api.get('/friends/requests');
      return res.data;
    }
  });

  const handleAcceptRequest = async (id: string, accept: boolean) => {
    try {
      await api.post(`/friends/request/${id}/respond`, { accept });
      queryClient.invalidateQueries({ queryKey: ['friendRequests'] });
      if (accept) queryClient.invalidateQueries({ queryKey: ['friends'] });
    } catch (error) {
      console.error('Failed to respond to request', error);
    }
  };

  const isActive = (path: string) => location.pathname.includes(path);

  return (
    <div className="flex h-screen bg-[#f3f4f6] font-sans text-gray-800">
      {/* Sidebar */}
      <div className="w-64 bg-[#1e1f22] text-gray-300 flex flex-col shadow-xl z-20">
        {/* Header */}
        <div className="h-16 flex items-center px-4 font-bold text-white shadow-sm border-b border-gray-800 bg-[#2b2d31]">
          <MessageSquare className="w-5 h-5 mr-2 text-indigo-400" />
          <span>Web Chat App</span>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar">
          {/* Rooms Section */}
          <div className="mb-6 px-2">
            <div className="px-2 mb-2 flex items-center justify-between group">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Public Rooms</h2>
              <button onClick={handleCreateRoom} className="text-gray-400 hover:text-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-[2px]">
              {rooms.map((room: any) => (
                <Link 
                  key={room.id}
                  to={`/room/${room.id}`} 
                  className={`flex items-center px-2 py-1.5 rounded-md group transition-colors ${isActive(`/room/${room.id}`) ? 'bg-[#404249] text-white' : 'hover:bg-[#35373c] hover:text-gray-100'}`}
                >
                  <Hash className="w-4 h-4 mr-1.5 text-gray-400 group-hover:text-gray-300" />
                  <span className="truncate">{room.name}</span>
                </Link>
              ))}
            </div>
          </div>
          
          {/* Direct Messages Section */}
          <div className="mb-6 px-2">
            <div className="px-2 mb-2 flex items-center justify-between group">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Direct Messages</h2>
              <button onClick={handleAddFriend} className="text-gray-400 hover:text-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-[2px]">
              {friends.map((friend: any) => (
                <Link 
                  key={friend.id}
                  to={`/dm/${friend.id}`}
                  className={`flex items-center px-2 py-1.5 rounded-md cursor-pointer transition-colors ${isActive(`/dm/${friend.id}`) ? 'bg-[#404249] text-white' : 'hover:bg-[#35373c] hover:text-gray-100'}`}
                >
                  <div className="relative mr-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                      {friend.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#1e1f22]"></div>
                  </div>
                  <span className="truncate">{friend.username}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Pending Requests */}
          {requests.length > 0 && (
            <div className="px-2">
              <div className="px-2 mb-2 flex items-center justify-between group">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Requests</h2>
              </div>
              <div className="space-y-[2px]">
                {requests.map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between px-2 py-1.5 rounded-md bg-[#35373c]">
                    <span className="truncate text-sm">{req.fromUser.username}</span>
                    <div className="flex space-x-1">
                      <button onClick={() => handleAcceptRequest(req.id, true)} className="text-green-400 hover:text-green-300 text-xs font-bold px-1">✓</button>
                      <button onClick={() => handleAcceptRequest(req.id, false)} className="text-red-400 hover:text-red-300 text-xs font-bold px-1">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* User Profile Footer */}
        <div className="h-16 bg-[#232428] p-2 flex items-center justify-between">
          <div className="flex items-center hover:bg-[#35373c] p-1.5 rounded-md cursor-pointer transition-colors flex-1 overflow-hidden">
            <div className="relative mr-2 flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-[#232428]"></div>
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-white truncate">{user?.username}</span>
              <span className="text-xs text-gray-400 truncate">Online</span>
            </div>
          </div>
          <button 
            onClick={logout} 
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-[#35373c] rounded-md transition-colors ml-1"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-[#313338] min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
