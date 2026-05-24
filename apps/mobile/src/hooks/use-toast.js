import { useState, useRef } from 'react';
import { Animated } from 'react-native';

export function useToast() {
  const [toastMsg, setToastMsg] = useState(null);
  const toastAnim = useRef(new Animated.Value(-80)).current;
  const toastTimer = useRef(null);

  const showToast = (message) => {
    setToastMsg(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.spring(toastAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: -80, duration: 250, useNativeDriver: true }).start(() => setToastMsg(null));
    }, 2500);
  };

  return { toastMsg, toastAnim, showToast };
}
