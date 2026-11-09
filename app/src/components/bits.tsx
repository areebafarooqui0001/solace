import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Press } from './ui';
import { fonts } from '../theme';

export function BackRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} style={styles.back}>
      <Ionicons name="arrow-back" size={18} color="#5B7266" />
      <Text style={styles.backText}>{label}</Text>
    </Press>
  );
}

/** Animated progress bar used for XP, steps and scores. */
export function XpBar({
  value,
  max,
  fill = '#fff',
  track = 'rgba(255,255,255,0.5)',
  height = 10,
}: {
  value: number;
  max: number;
  fill?: string;
  track?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  const style = useAnimatedStyle(() => ({ width: withTiming(`${pct * 100}%`, { duration: 700 }) }));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: fill, minWidth: pct > 0 ? height : 0 }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingRight: 12 },
  backText: { fontFamily: fonts.semi, fontSize: 15, color: '#5B7266' },
});
