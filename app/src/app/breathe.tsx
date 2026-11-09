import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BackRow } from '../components/bits';
import { useReward } from '../components/Toast';
import { Button, Screen } from '../components/ui';
import { api } from '../api';
import { colors, fonts } from '../theme';

// 4 in, 4 hold, 6 out, repeated 4 times (about 56 seconds). The longer exhale is what calms the body.
const MIN = 0.58;
const CYCLES = 4;
const PHASES = [
  { label: 'Breathe in', secs: 4, to: 1 },
  { label: 'Hold', secs: 4, to: 1 },
  { label: 'Breathe out', secs: 6, to: MIN },
] as const;

type Status = 'idle' | 'running' | 'paused' | 'done';

export default function Breathe() {
  const router = useRouter();
  const reward = useReward();
  const scale = useSharedValue(MIN);
  const [status, setStatus] = useState<Status>('idle');
  const [phase, setPhase] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [left, setLeft] = useState<number>(PHASES[0].secs);
  const pos = useRef({ phase: 0, cycle: 1, left: PHASES[0].secs as number });

  const animateTo = useCallback(
    (p: number, secs: number) => {
      cancelAnimation(scale);
      scale.value = withTiming(PHASES[p].to, { duration: secs * 1000, easing: Easing.inOut(Easing.sin) });
    },
    [scale]
  );

  const sync = () => {
    setPhase(pos.current.phase);
    setCycle(pos.current.cycle);
    setLeft(pos.current.left);
  };

  const start = () => {
    pos.current = { phase: 0, cycle: 1, left: PHASES[0].secs };
    sync();
    animateTo(0, PHASES[0].secs);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setStatus('running');
  };

  const pause = () => {
    cancelAnimation(scale);
    setStatus('paused');
  };

  const resume = () => {
    animateTo(pos.current.phase, pos.current.left);
    setStatus('running');
  };

  // One tick per second drives the countdown, the phase changes and the cycle count.
  useEffect(() => {
    if (status !== 'running') return;
    const id = setInterval(() => {
      const p = pos.current;
      p.left -= 1;
      if (p.left <= 0) {
        if (p.phase < PHASES.length - 1) {
          p.phase += 1;
        } else if (p.cycle < CYCLES) {
          p.phase = 0;
          p.cycle += 1;
        } else {
          cancelAnimation(scale);
          setStatus('done');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          api
            .logActivity('breathing', `${CYCLES} cycles`)
            .then((r) => reward(r.award, 'for a breathing reset'))
            .catch(() => {});
          return;
        }
        p.left = PHASES[p.phase].secs;
        animateTo(p.phase, p.left);
        Haptics.impactAsync(p.phase === 1 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      sync();
    }, 1000);
    return () => clearInterval(id);
  }, [status, animateTo, scale, reward]);

  useEffect(() => () => cancelAnimation(scale), [scale]);

  const orb = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const halo = useAnimatedStyle(() => ({
    transform: [{ scale: 0.9 + scale.value * 0.28 }],
    opacity: 0.18 + scale.value * 0.3,
  }));

  const label =
    status === 'idle' ? 'Ready?' : status === 'done' ? 'Well done' : status === 'paused' ? 'Paused' : PHASES[phase].label;
  const sub =
    status === 'idle'
      ? `Cycle 1/${CYCLES}`
      : status === 'done'
      ? `${CYCLES} cycles complete`
      : status === 'paused'
      ? `${PHASES[phase].label} · ${left}s`
      : `${left}s`;

  return (
    <Screen>
      <View style={styles.wrap}>
        <BackRow label="Back" onPress={() => router.back()} />
        <Text style={styles.title}>Calm breathing</Text>
        <Text style={styles.sub}>4 in · 4 hold · 6 out · {CYCLES} cycles</Text>

        <View style={styles.stage}>
          <Animated.View style={[styles.halo, halo]} />
          <Animated.View style={[styles.orb, orb]} />
          <View style={styles.center} pointerEvents="none">
            <Text style={styles.label}>{label}</Text>
            <Text style={[styles.count, status === 'running' && { fontSize: 44, fontFamily: fonts.heading }]}>{sub}</Text>
          </View>
        </View>

        <View style={styles.dots}>
          {Array.from({ length: CYCLES }).map((_, i) => (
            <View key={i} style={[styles.dot, (status === 'done' || i < cycle - 1 || (i === cycle - 1 && status !== 'idle')) && styles.dotOn]} />
          ))}
        </View>

        <Text style={styles.hint}>
          {status === 'done' ? 'Notice how your shoulders feel.' : 'Follow the circle. Let your belly soften.'}
        </Text>

        {status === 'idle' && <Button title="Start" onPress={start} />}
        {status === 'running' && <Button title="Pause" onPress={pause} />}
        {status === 'paused' && (
          <View style={{ gap: 8 }}>
            <Button title="Resume" onPress={resume} />
            <Button title="End session" variant="ghost" onPress={() => router.back()} />
          </View>
        )}
        {status === 'done' && (
          <View style={{ gap: 8 }}>
            <Button title="I feel calmer" onPress={() => router.back()} />
            <Button title="Go again" variant="soft" onPress={start} />
          </View>
        )}
      </View>
    </Screen>
  );
}

const SIZE = 250;

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 22, gap: 6, justifyContent: 'space-between' },
  title: { fontFamily: fonts.heading, fontSize: 34, color: colors.ink, marginTop: 4 },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft },
  stage: { alignSelf: 'center', width: SIZE + 60, height: SIZE + 60, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: SIZE + 40, height: SIZE + 40, borderRadius: (SIZE + 40) / 2, backgroundColor: colors.mint },
  orb: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.mint,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  center: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink },
  count: { fontFamily: fonts.semi, fontSize: 17, color: colors.ink, opacity: 0.75 },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.primary },
  hint: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft, textAlign: 'center', marginBottom: 8 },
});
