import { useState, useEffect, useRef, useCallback } from 'react';
import { BotStatus, ConsoleMessage } from '@shared/schema';

interface WebSocketMessage {
  type: string;
  data?: any;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [botStatus, setBotStatus] = useState<BotStatus>({
    connected: false,
    activity: 'Idle',
    position: { x: 0, y: 0, z: 0 },
    time: 'day',
    players: [],
    area: Array(9).fill(false),
  });
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>([]);
  
  const socketRef = useRef<WebSocket | null>(null);

  const connectWebSocket = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      
      // Request initial status
      socket.send(JSON.stringify({ type: 'getStatus' }));
    };
    
    socket.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      
      // Reconnect after a delay
      setTimeout(() => {
        if (document.visibilityState !== 'hidden') {
          connectWebSocket();
        }
      }, 3000);
    };
    
    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      socket.close();
    };
    
    socket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        
        switch (message.type) {
          case 'status':
            setBotStatus(message.data);
            break;
            
          case 'console':
            setConsoleMessages(prev => [...prev, message.data]);
            break;
            
          case 'consoleClear':
            setConsoleMessages([]);
            break;
            
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socketRef.current = socket;
    
    // Clean up function
    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    
    // Handle visibility change to reconnect when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && 
          (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN)) {
        connectWebSocket();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connectWebSocket]);

  return {
    isConnected,
    botStatus,
    consoleMessages,
    // Function to send messages to the server
    sendMessage: useCallback((type: string, data?: any) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type, data }));
      }
    }, []),
  };
}
