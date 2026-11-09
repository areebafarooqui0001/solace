import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Award } from '../api';
import { colors, fonts, radius } from '../theme';

type ToastCtx = { toast: (title: string, body?: string) => void };
const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<{ title: string; body?: string } | null>(null);
  const y = useSharedValue(-160);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback(
    (title: string, body?: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMsg({ title, body });
      y.value = withSpring(0, { damping: 15 });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      timer.current = setTimeout(() => {
        y.value = withTiming(-160, { duration: 260 });
      }, 3000);
    },
    [y]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <Animated.View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }, style]}>
        <View style={styles.icon}>
          <Ionicons name="heart" size={16} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{msg?.title}</Text>
          {!!msg?.body && <Text style={styles.body}>{msg.body}</Text>}
        </View>
      </Animated.View>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast outside ToastProvider');
  return v;
}

/** Turns a server XP award into a toast, with a level-up celebration when it applies. */
export function useReward() {
  const { toast } = useToast();
  return useCallback(
    (a: Award | null | undefined, reason: string) => {
      if (!a) return;
      if (a.leveledUp) toast(`You bloomed into ${a.levelName}! 🌱`, `+${a.gained} Self-Love XP · Level ${a.level}`);
      else if (a.gained > 0) toast(`+${a.gained} Self-Love XP`, reason);
    },
    [toast]
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#17382B',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 100,
  },
  icon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, marginTop: 1 },
});
