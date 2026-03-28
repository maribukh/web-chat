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

const queryClient = new QueryClient();

function App() {
  const { token, user } = useAuthStore();

  useEffect(() => {
    if (token && user) {
      socketService.connect(token);
    } else {
      socketService.disconnect();
    }
    return () => {
      socketService.disconnect();
    };
  }, [token, user]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!token ? <Login /> : <Navigate to="/" />} />
          <Route path="/register" element={!token ? <Register /> : <Navigate to="/" />} />
          <Route path="/" element={token ? <ChatLayout /> : <Navigate to="/login" />}>
            <Route index element={<div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-[#313338]"><div className="w-24 h-24 bg-[#2b2d31] rounded-full flex items-center justify-center mb-6"><MessageSquare className="w-12 h-12 text-gray-500" /></div><h2 className="text-xl font-bold text-gray-200 mb-2">No Room Selected</h2><p>Select a room or contact from the sidebar to start chatting</p></div>} />
            <Route path="room/:roomId" element={<RoomView />} />
            <Route path="dm/:friendId" element={<DMRedirect />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
