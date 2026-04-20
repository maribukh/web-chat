import { useParams } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { socketService } from '../../services/socket';
import {
  Hash, Users, Bell, Paperclip, Smile, Send, X,
  CornerUpLeft, Pencil, Trash2, Check, MessageSquare, MoreVertical, Menu
} from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import EmojiPicker from '../ui/EmojiPicker';
import RoomMemberPanel from './RoomMemberPanel';

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function getAvatarColor(username: string) {
  const colors = ['#6c63ff', '#e85d75', '#3ba55d', '#faa61a', '#5b9bd5', '#e67e22', '#9b59b6', '#1abc9c'];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function formatTime(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(d?: string) {
  if (!d) return 'Today';
  const date = new Date(d);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

function isImageFile(fileType: string) {
  return fileType.startsWith('image/');
}

export default function RoomView() {
  const { roomId } = useParams<{ roomId: string }>();

  // ЗАЩИТА: Проверяем, что roomId существует и не равен строке "undefined"
  const isValidRoom = Boolean(roomId && roomId !== 'undefined');

  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showMembers, setShowMembers] = useState(false);

  const queryClient = useQueryClient();
  const { setSidebarOpen } = useUIStore();
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const { user } = useAuthStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch room details
  const { data: room } = useQuery({
    queryKey: ['roomDetails', roomId],
    queryFn: async () => {
      const res = await api.get(`/rooms/${roomId}`);
      return res.data;
    },
    enabled: isValidRoom, // Запрашиваем только если ID валидный
  });

  // Load messages
  const fetchMessages = useCallback(async (cursor?: string) => {
    if (!isValidRoom) return;
    try {
      const url = cursor
        ? `/messages/room/${roomId}?cursor=${cursor}&limit=50`
        : `/messages/room/${roomId}?limit=50`;
      const res = await api.get(url);
      const data: any[] = res.data;
      if (!cursor) {
        setMessages(data);
        setHasMore(data.length === 50);
      } else {
        setMessages((prev) => [...data, ...prev]);
        setHasMore(data.length === 50);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, [roomId, isValidRoom]);

  useEffect(() => {
    if (!isValidRoom) return;
    setMessages([]);
    setHasMore(true);
    setReplyTo(null);
    setEditingId(null);
    fetchMessages();
  }, [roomId, isValidRoom, fetchMessages]);

  // Socket setup
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket || !isValidRoom) return;

    socket.emit('join_room', { roomId });

    const onNewMessage = (msg: any) => {
      if (msg.roomId === roomId) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    const onEditedMessage = (msg: any) => {
      if (msg.roomId === roomId) {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      }
    };

    const onDeletedMessage = ({ messageId }: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    };

    const onTyping = ({ userId, username }: { userId: string; username: string }) => {
      if (userId === user?.id) return;
      setTypingUsers((prev) => (prev.includes(username) ? prev : [...prev, username]));
    };

    const onStopTyping = ({ username }: { username: string }) => {
      setTypingUsers((prev) => prev.filter((u) => u !== username));
    };

    socket.on('new_message', onNewMessage);
    socket.on('message_edited', onEditedMessage);
    socket.on('message_deleted', onDeletedMessage);
    socket.on('user_typing', onTyping);
    socket.on('user_stop_typing', onStopTyping);

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('message_edited', onEditedMessage);
      socket.off('message_deleted', onDeletedMessage);
      socket.off('user_typing', onTyping);
      socket.off('user_stop_typing', onStopTyping);
    };
  }, [roomId, isValidRoom, user?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAtBottom]);

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setIsAtBottom(atBottom);

    // Infinite scroll upward
    if (el.scrollTop < 80 && hasMore && !loadingMore && messages.length > 0) {
      const oldScrollHeight = el.scrollHeight;
      setLoadingMore(true);
      fetchMessages(messages[0]?.id).finally(() => {
        setLoadingMore(false);
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - oldScrollHeight;
        });
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';

    const socket = socketService.getSocket();
    if (socket && isValidRoom) {
      socket.emit('typing', { roomId });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socket.emit('stop_typing', { roomId });
      }, 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    if (e.key === 'Escape') {
      setReplyTo(null);
      setShowEmoji(false);
    }
  };

  const sendMessage = () => {
    if (!input.trim() || !isValidRoom) return;
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('send_message', {
        roomId,
        content: input.trim(),
        parentId: replyTo?.id ?? null,
      });
      socket.emit('stop_typing', { roomId });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    }
    setInput('');
    setReplyTo(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isValidRoom) return;
    const MAX_SIZE = file.type.startsWith('image/') ? 3 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert(`File too large. Max ${file.type.startsWith('image/') ? '3MB for images' : '20MB'}.`);
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('roomId', roomId as string);
      if (input.trim()) formData.append('comment', input.trim());
      await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setInput('');
    } catch (err) {
      console.error('File upload failed', err);
      alert('File upload failed');
    }
    if (e.target) e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const fileItem = items.find((item) => item.kind === 'file');
    if (fileItem) {
      e.preventDefault();
      const file = fileItem.getAsFile();
      if (!file || !isValidRoom) return;
      const dt = new DataTransfer();
      dt.items.add(file);
      const fakeEvent = { target: { files: dt.files, value: '' }, preventDefault: () => { } } as any;
      handleFileUpload(fakeEvent);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Delete this message?')) return;
    try {
      await api.delete(`/messages/${messageId}`);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error('Failed to delete message', err);
    }
  };

  const startEdit = (msg: any) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
  };

  const confirmEdit = async () => {
    if (!editingId || !editContent.trim()) return;
    try {
      const res = await api.put(`/messages/${editingId}`, { content: editContent.trim() });
      setMessages((prev) => prev.map((m) => (m.id === editingId ? { ...m, ...res.data } : m)));
    } catch (err) {
      console.error('Failed to edit message', err);
    }
    setEditingId(null);
    setEditContent('');
  };

  const handleEmojiSelect = (emoji: string) => {
    setInput((prev) => prev + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  // Если URL кривой (например /room/undefined), показываем заглушку
  if (!isValidRoom) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        <div style={{ textAlign: 'center' }}>
          <Hash size={48} style={{ opacity: 0.2, marginBottom: 16, margin: '0 auto' }} />
          <h3>Select a room</h3>
          <p>Choose a channel or direct message from the sidebar to start chatting.</p>
        </div>
      </div>
    );
  }

  // Group messages by date for separators
  const groupedMessages: Array<{ type: 'date'; label: string } | { type: 'message'; msg: any; isConsecutive: boolean }> = [];
  let lastDate = '';
  let lastUserId = '';
  let lastTime = 0;

  messages.forEach((msg) => {
    const msgDate = formatDate(msg.createdAt);
    if (msgDate !== lastDate) {
      groupedMessages.push({ type: 'date', label: msgDate });
      lastDate = msgDate;
      lastUserId = '';
      lastTime = 0;
    }
    const msgTime = new Date(msg.createdAt).getTime();
    const isConsecutive = msg.userId === lastUserId && (msgTime - lastTime) < 5 * 60 * 1000;
    groupedMessages.push({ type: 'message', msg, isConsecutive });
    lastUserId = msg.userId;
    lastTime = msgTime;
  });

  const isDM = room?.visibility === 'private' && room?.members?.length === 2 && room?.name?.startsWith('dm-');
  let roomName = room?.name ?? roomId;
  if (isDM) {
    const friend = room.members.find((m: any) => m.userId !== user?.id)?.user;
    if (friend) roomName = friend.username;
  }

  return (
    <div style={{ display: 'flex', flex: 1, minWidth: 0, height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-left">
            <button className="chat-header-btn mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            {isDM ? (
              <MessageSquare size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            ) : (
              <Hash size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            )}
            <h2 className="chat-header-title">{roomName}</h2>
            {room?.description && (
              <>
                <div className="chat-header-divider" />
                <p className="chat-header-subtitle">{room.description}</p>
              </>
            )}
          </div>
          <div className="chat-header-actions">
            <button
              className={`chat-header-btn ${showMembers ? 'active' : ''}`}
              onClick={() => setShowMembers(!showMembers)}
              title="Toggle members"
            >
              <Users size={18} />
            </button>
            <button className="chat-header-btn" title="Notifications">
              <Bell size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          className="messages-area custom-scrollbar"
          ref={messagesContainerRef}
          onScroll={handleScroll}
        >
          {loadingMore && (
            <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Loading older messages...
            </div>
          )}

          {/* Welcome banner */}
          {!hasMore && messages.length > 0 && (
            <div className="messages-welcome">
              <div className="messages-welcome-icon">
                <Hash size={32} style={{ color: 'var(--text-muted)' }} />
              </div>
              <h1 className="messages-welcome-title">Welcome to #{roomName}!</h1>
              <p className="messages-welcome-sub">This is the very beginning of the #{roomName} channel.</p>
            </div>
          )}

          {messages.length === 0 && (
            <div className="empty-state" style={{ marginTop: '20vh' }}>
              <div className="empty-state-icon">
                <Hash size={36} />
              </div>
              <div className="empty-state-title">No messages yet</div>
              <p className="empty-state-sub">Be the first to say something in #{roomName}!</p>
            </div>
          )}

          {groupedMessages.map((item, idx) => {
            if (item.type === 'date') {
              return (
                <div key={`date-${idx}`} className="date-separator">
                  <div className="date-separator-line" />
                  <span className="date-separator-label">{item.label}</span>
                  <div className="date-separator-line" />
                </div>
              );
            }

            const { msg, isConsecutive } = item;
            const isOwn = msg.userId === user?.id;
            const username = msg.user?.username ?? 'Unknown';

            return (
              <div
                key={msg.id}
                className={`message-group ${!isConsecutive ? 'message-group-first' : ''}`}
              >
                {/* Avatar column */}
                <div className="message-avatar-col">
                  {!isConsecutive ? (
                    <div
                      className="avatar avatar-md"
                      style={{ background: getAvatarColor(username), cursor: 'pointer' }}
                      title={username}
                    >
                      {username.charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <span className="message-timestamp-hover">{formatTime(msg.createdAt)}</span>
                  )}
                </div>

                {/* Content */}
                <div className="message-body">
                  {!isConsecutive && (
                    <div className="message-header">
                      <span className="message-author">{username}</span>
                      <span className="message-time">{formatTime(msg.createdAt)}</span>
                      {msg.editedAt && <span className="message-edited">(edited)</span>}
                    </div>
                  )}

                  {/* Reply preview */}
                  {msg.parent && (
                    <div className="message-reply-preview">
                      <CornerUpLeft size={12} />
                      <span className="message-reply-author">{msg.parent.user?.username ?? 'Unknown'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {msg.parent.content?.slice(0, 80)}
                      </span>
                    </div>
                  )}

                  {/* Message content or edit field */}
                  {editingId === msg.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="input-text"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent)', borderRadius: 8, padding: '8px 10px', flex: 1 }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmEdit(); }
                          if (e.key === 'Escape') { setEditingId(null); }
                        }}
                        autoFocus
                        rows={2}
                      />
                      <button className="btn btn-primary" style={{ padding: '6px 10px' }} onClick={confirmEdit}>
                        <Check size={14} />
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px' }} onClick={() => setEditingId(null)}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="message-content">{msg.content}</div>
                  )}

                  {/* Attachments */}
                  {msg.attachments?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                      {msg.attachments.map((att: any) => {
                        const token = useAuthStore.getState().token;
                        const tokenQuery = token ? `?token=${token}` : '';
                        const src = att.filePath?.startsWith('http')
                          ? att.filePath
                          : `${API_URL}/api/upload/downloads/${att.id}${tokenQuery}`;
                        return isImageFile(att.fileType ?? '') ? (
                          <img
                            key={att.id}
                            src={src}
                            alt={att.filename}
                            className="attachment-image"
                            onClick={() => window.open(src, '_blank')}
                          />
                        ) : (
                          <div key={att.id} className="attachment-file">
                            <Paperclip size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            <a href={src} target="_blank" rel="noopener noreferrer" className="attachment-file-name">
                              {att.filename}
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Message actions */}
                <div className="message-actions">
                  <button
                    className="message-action-btn"
                    title="Reply"
                    onClick={() => { setReplyTo(msg); textareaRef.current?.focus(); }}
                  >
                    <CornerUpLeft size={15} />
                  </button>
                  {isOwn && (
                    <button
                      className="message-action-btn"
                      title="Edit"
                      onClick={() => startEdit(msg)}
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  {(isOwn || room?.members?.find((m: any) => m.userId === user?.id && (m.role === 'admin' || m.role === 'owner'))) && (
                    <button
                      className="message-action-btn danger"
                      title="Delete"
                      onClick={() => handleDeleteMessage(msg.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className="typing-indicator">
              <div className="typing-dots">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
              <span>
                {typingUsers.slice(0, 2).join(', ')}
                {typingUsers.length > 2 && ` +${typingUsers.length - 2}`}
                {typingUsers.length === 1 ? ' is typing...' : ' are typing...'}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="input-area">
          {showEmoji && (
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <div style={{ position: 'absolute', bottom: 0, right: 0, zIndex: 50 }}>
                <EmojiPicker onSelect={handleEmojiSelect} />
              </div>
            </div>
          )}

          <div className="input-bar">
            {replyTo && (
              <div className="input-reply-banner">
                <span>Replying to <strong>{replyTo.user?.username}</strong>: {replyTo.content?.slice(0, 60)}{replyTo.content?.length > 60 ? '…' : ''}</span>
                <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 2 }}>
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="input-row">
              <button
                type="button"
                className="input-attach-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
              >
                <Paperclip size={20} />
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                className="input-text"
                placeholder={`Message #${roomName}`}
                rows={1}
              />

              <button
                type="button"
                className="input-icon-btn"
                onClick={() => setShowEmoji(!showEmoji)}
                title="Emoji"
              >
                <Smile size={20} />
              </button>

              <button
                type="button"
                className="input-icon-btn"
                onClick={sendMessage}
                title="Send (Enter)"
                style={{ color: input.trim() ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                <Send size={18} />
              </button>
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="sr-only"
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Member panel */}
      {showMembers && roomId && !isDM && (
        <RoomMemberPanel roomId={roomId} />
      )}

      {/* Click outside emoji picker */}
      {showEmoji && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          onClick={() => setShowEmoji(false)}
        />
      )}
    </div>
  );
}