import { useParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { socketService } from '../../services/socket';
import { Hash, Users, Bell, Pin, Search, Inbox, HelpCircle, PlusCircle, Smile, Gift, Image as ImageIcon, Sticker, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export default function RoomView() {
  const { roomId } = useParams();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const { user } = useAuthStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!roomId) return;
    
    const fetchMessages = async () => {
      try {
        const res = await api.get(`/messages/room/${roomId}`);
        setMessages(res.data);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };
    
    fetchMessages();
  }, [roomId]);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket || !roomId) return;

    socket.emit('join_room', { roomId });

    const handleNewMessage = (msg: any) => {
      if (msg.roomId === roomId) {
        setMessages(prev => [...prev, msg]);
      }
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [roomId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomId) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('roomId', roomId);
      if (input) formData.append('comment', input);
      
      await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setInput('');
    } catch (error) {
      console.error('File upload failed', error);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const socket = socketService.getSocket();
    if (socket && roomId) {
      socket.emit('send_message', { roomId, content: input });
      setInput('');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      await api.delete(`/messages/${messageId}`);
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (error) {
      console.error('Failed to delete message', error);
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#313338] text-gray-100">
      {/* Header */}
      <div className="h-16 border-b border-[#1e1f22] flex items-center justify-between px-4 shadow-sm z-10 shrink-0">
        <div className="flex items-center">
          <Hash className="w-6 h-6 text-gray-400 mr-2" />
          <h2 className="text-base font-bold text-white">{roomId}</h2>
          <div className="mx-4 w-px h-6 bg-gray-600 hidden md:block"></div>
          <p className="text-sm text-gray-400 hidden md:block">Welcome to #{roomId}!</p>
        </div>
        
        <div className="flex items-center space-x-4 text-gray-300">
          <Hash className="w-5 h-5 cursor-pointer hover:text-gray-100 hidden sm:block" />
          <Bell className="w-5 h-5 cursor-pointer hover:text-gray-100 hidden sm:block" />
          <Pin className="w-5 h-5 cursor-pointer hover:text-gray-100 hidden sm:block" />
          <Users className="w-5 h-5 cursor-pointer hover:text-gray-100" />
          
          <div className="relative hidden md:block">
            <input 
              type="text" 
              placeholder="Search" 
              className="bg-[#1e1f22] text-sm rounded-md px-2 py-1 w-36 focus:w-48 transition-all outline-none placeholder-gray-500"
            />
            <Search className="w-4 h-4 absolute right-2 top-1.5 text-gray-400" />
          </div>
          
          <Inbox className="w-5 h-5 cursor-pointer hover:text-gray-100 hidden lg:block" />
          <HelpCircle className="w-5 h-5 cursor-pointer hover:text-gray-100 hidden lg:block" />
        </div>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {/* Welcome message */}
        <div className="mt-10 mb-6">
          <div className="w-16 h-16 bg-[#404249] rounded-full flex items-center justify-center mb-4">
            <Hash className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to #{roomId}!</h1>
          <p className="text-gray-400">This is the start of the #{roomId} channel.</p>
        </div>

        <div className="border-t border-gray-700/50 my-4 relative">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#313338] px-2 text-xs font-semibold text-gray-400">
            Today
          </span>
        </div>

        {messages.map((msg, i) => {
          const isConsecutive = i > 0 && messages[i-1].userId === msg.userId;
          
          return (
            <div key={i} className={`flex group hover:bg-[#2e3035] -mx-4 px-4 py-0.5 ${!isConsecutive ? 'mt-4' : ''}`}>
              {!isConsecutive ? (
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold mr-4 shrink-0 mt-0.5 cursor-pointer hover:opacity-80">
                  {msg.user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
              ) : (
                <div className="w-10 mr-4 shrink-0 text-xs text-gray-500 opacity-0 group-hover:opacity-100 text-right pt-1 select-none">
                  {formatTime(msg.createdAt)}
                </div>
              )}
              
              <div className="flex-1 min-w-0 relative">
                {!isConsecutive && (
                  <div className="flex items-baseline">
                    <span className="font-medium text-gray-100 mr-2 hover:underline cursor-pointer">
                      {msg.user?.username || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatTime(msg.createdAt)}
                    </span>
                  </div>
                )}
                <div className="text-gray-200 whitespace-pre-wrap break-words leading-relaxed pr-8">
                  {msg.content}
                </div>
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 pr-8">
                    {msg.attachments.map((att: any, idx: number) => (
                      <div key={idx} className="bg-[#2b2d31] p-2 rounded-md border border-gray-700 flex items-center">
                        <ImageIcon className="w-4 h-4 mr-2 text-gray-400" />
                        <a href={att.filePath || att.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-400 hover:underline">
                          {att.filename || att.name || 'Attachment'}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Message Actions */}
                <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity bg-[#313338] border border-gray-700 rounded-md shadow-sm hidden group-hover:flex items-center -mt-4 mr-2 z-10">
                  {(user?.id === msg.userId) && (
                    <button 
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#2b2d31] rounded-md transition-colors"
                      title="Delete message"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Area */}
      <div className="px-4 pb-6 pt-2 shrink-0">
        <form onSubmit={sendMessage} className="bg-[#383a40] rounded-lg flex items-center px-4 py-2.5">
          <button type="button" className="text-gray-400 hover:text-gray-200 p-1 mr-2 shrink-0">
            <PlusCircle className="w-6 h-6" />
          </button>
          
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            className="flex-1 bg-transparent text-gray-100 focus:outline-none placeholder-gray-500"
            placeholder={`Message #${roomId}`}
          />
          
          <div className="flex items-center space-x-3 ml-2 shrink-0">
            <button type="button" className="text-gray-400 hover:text-gray-200 hidden sm:block">
              <Gift className="w-6 h-6" />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              className="text-gray-400 hover:text-gray-200 hidden sm:block"
            >
              <ImageIcon className="w-6 h-6" />
            </button>
            <button type="button" className="text-gray-400 hover:text-gray-200 hidden sm:block">
              <Sticker className="w-6 h-6" />
            </button>
            <button type="button" className="text-gray-400 hover:text-gray-200">
              <Smile className="w-6 h-6" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
