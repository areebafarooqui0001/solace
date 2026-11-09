import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../theme';

export const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
export const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
export const select = () => Haptics.selectionAsync().catch(() => {});

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient colors={['#FEF4D3', '#FFF8E4', '#FEF0CB']} style={{ flex: 1 }}>
      <SafeAreaView style={[{ flex: 1 }, style]}>{children}</SafeAreaView>
    </LinearGradient>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Press({
  onPress,
  children,
  style,
  disabled,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => (s.value = withSpring(0.96, { damping: 15 }))}
      onPressOut={() => (s.value = withSpring(1, { damping: 12 }))}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={[a, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function Button({
  title,
  onPress,
  loading,
  variant = 'primary',
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'ghost' | 'soft';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = variant === 'primary' ? colors.primary : variant === 'soft' ? colors.primarySoft : 'transparent';
  const fg = variant === 'primary' ? '#fff' : colors.primary;
  return (
    <Press
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.btnText, { color: fg }]}>{title}</Text>}
    </Press>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#B5ABC0"
        autoCapitalize="none"
        {...rest}
        style={[styles.input, style]}
      />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      onPress={() => {
        select();
        onPress();
      }}
      style={[styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
    >
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Press>
  );
}

export const H1 = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <Text style={[styles.h1, style]}>{children}</Text>
);
export const Body = ({ children, style }: { children: React.ReactNode; style?: any }) => (
  <Text style={[styles.body, style]}>{children}</Text>
);

const styles = StyleSheet.create({
  btn: {
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  btnText: { fontFamily: fonts.bold, fontSize: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 18,
    shadowColor: '#3F7D5C',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  label: { fontFamily: fonts.semi, fontSize: 13, color: colors.inkSoft, marginBottom: 6, marginLeft: 4 },
  input: {
    height: 54,
    backgroundColor: '#fff',
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingHorizontal: 18,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  chipText: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink },
  h1: { fontFamily: fonts.heading, fontSize: 30, color: colors.ink, lineHeight: 38 },
  body: { fontFamily: fonts.body, fontSize: 16, color: colors.inkSoft, lineHeight: 24 },
});
