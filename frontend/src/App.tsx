import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { socketService } from './services/socket';
import { MessageSquare } from 'lucide-react';

import Login from './pages/Login';
import Register from './pages/Register';
import ChatLayout from './components/layout/ChatLayout';
import RoomView from './components/chat/RoomView';
import DMRedirect from './components/chat/DMRedirect';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <MessageSquare size={40} />
      </div>
      <h2 className="empty-state-title">No chat selected</h2>
      <p className="empty-state-sub">
        Pick a room or start a direct message from the sidebar to begin chatting.
      </p>
    </div>
  );
}

function App() {
  const { token, user } = useAuthStore();

  useEffect(() => {
    if (token && user) {
      socketService.connect(token);
    } else {
      socketService.disconnect();
    }
    return () => {
      // Don't disconnect on every re-render — only on unmount
    };
  }, [token, user]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!token ? <Login /> : <Navigate to="/" replace />} />
          <Route path="/register" element={!token ? <Register /> : <Navigate to="/" replace />} />
          <Route path="/" element={token ? <ChatLayout /> : <Navigate to="/login" replace />}>
            <Route index element={<EmptyState />} />
            <Route path="room/:roomId" element={<RoomView />} />
            <Route path="dm/:friendId" element={<DMRedirect />} />
          </Route>
          <Route path="*" element={<Navigate to={token ? '/' : '/login'} replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
