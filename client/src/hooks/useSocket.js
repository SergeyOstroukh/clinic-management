import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const getSocketUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    // Убираем /api из URL для socket подключения
    return process.env.REACT_APP_API_URL.replace('/api', '');
  }
  if (process.env.NODE_ENV === 'production') {
    return window.location.origin;
  }
  return 'http://localhost:3001';
};

// Singleton socket instance — один на всё приложение
let socketInstance = null;
let refCount = 0;

const getSocket = () => {
  if (!socketInstance) {
    socketInstance = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      console.log('🔌 Socket.IO: подключено к серверу');
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('🔌 Socket.IO: отключено от сервера:', reason);
    });

    socketInstance.on('connect_error', (error) => {
      console.log('🔌 Socket.IO: ошибка подключения:', error.message);
    });
  }
  return socketInstance;
};

/**
 * Хук для подписки на Socket.IO события
 * @param {string} eventName - имя события
 * @param {Function} callback - обработчик события
 */
export const useSocketEvent = (eventName, callback) => {
  const socketRef = useRef(null);
  const callbackRef = useRef(callback);

  // Обновляем ref при изменении callback
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    refCount++;

    const handler = (...args) => {
      callbackRef.current(...args);
    };

    socket.on(eventName, handler);

    return () => {
      socket.off(eventName, handler);
      refCount--;
      
      // Если больше никто не использует сокет, отключаем
      if (refCount <= 0 && socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        refCount = 0;
      }
    };
  }, [eventName]);

  return socketRef.current;
};

/**
 * Хук для получения Socket.IO инстанса
 */
export const useSocket = () => {
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    refCount++;

    return () => {
      refCount--;
      if (refCount <= 0 && socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        refCount = 0;
      }
    };
  }, []);

  return socketRef.current;
};

export default useSocket;
