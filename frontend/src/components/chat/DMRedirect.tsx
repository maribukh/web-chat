import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';

export default function DMRedirect() {
  const { friendId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDMRoom = async () => {
      try {
        const res = await api.post(`/rooms/dm/${friendId}`);
        navigate(`/room/${res.data.id}`, { replace: true });
      } catch (error) {
        console.error('Failed to get DM room', error);
      }
    };

    if (friendId) {
      fetchDMRoom();
    }
  }, [friendId, navigate]);

  return (
    <div className="flex-1 flex items-center justify-center bg-[#313338] text-gray-400">
      <div className="animate-pulse">Loading conversation...</div>
    </div>
  );
}
