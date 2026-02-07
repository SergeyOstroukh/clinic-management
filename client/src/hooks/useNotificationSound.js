import { useCallback, useRef } from 'react';

/**
 * Хук для воспроизведения звуковых уведомлений через Web Audio API.
 * Не требует аудиофайлов — звуки генерируются программно.
 */
export const useNotificationSound = () => {
  const audioContextRef = useRef(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Восстанавливаем контекст, если он приостановлен (требование браузера)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  /**
   * Звоночек для врача — мелодичный двухтональный звон (ding-dong)
   */
  const playDoctorBell = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Первая нота (высокая) — ding
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(830, now); // Ля-бемоль 5
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);

      // Вторая нота (чуть ниже) — dong
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(660, now + 0.25); // Ми 5
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.setValueAtTime(0.35, now + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.25);
      osc2.stop(now + 1.0);

      // Третья нота (ещё выше) — финальный акцент
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(990, now + 0.5); // Си 5
      gain3.gain.setValueAtTime(0, now);
      gain3.gain.setValueAtTime(0.3, now + 0.5);
      gain3.gain.exponentialRampToValueAtTime(0.01, now + 1.3);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.5);
      osc3.stop(now + 1.3);

    } catch (e) {
      console.warn('Не удалось воспроизвести звук:', e);
    }
  }, [getAudioContext]);

  /**
   * Звук "касса" для администратора — ча-чинг (готово к оплате)
   */
  const playPaymentReady = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Первый тон — короткий щелчок
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(1200, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.08);

      // Второй тон — звенящий "чинг"
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1568, now + 0.1); // Соль 6
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.setValueAtTime(0.3, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.7);

      // Третий тон — высокий обертон
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(2093, now + 0.12); // До 7
      gain3.gain.setValueAtTime(0, now);
      gain3.gain.setValueAtTime(0.2, now + 0.12);
      gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.12);
      osc3.stop(now + 0.6);

    } catch (e) {
      console.warn('Не удалось воспроизвести звук:', e);
    }
  }, [getAudioContext]);

  return { playDoctorBell, playPaymentReady };
};

export default useNotificationSound;
