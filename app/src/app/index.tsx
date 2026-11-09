import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Mascot } from '../components/Mascot';
import { useAuth } from '../auth';
import { colors, fonts } from '../theme';

export default function Splash() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(async () => {
      if (user) return router.replace('/(tabs)/home');
      const seen = await SecureStore.getItemAsync('solace_onboarded').catch(() => null);
      router.replace(seen ? '/login' : '/onboarding');
    }, 2400);
    return () => clearTimeout(t);
  }, [loading, user, router]);

  return (
    <LinearGradient colors={['#FFF3C9', '#FFF8E4', '#DDF0E4']} style={styles.root}>
      <Animated.View entering={FadeIn.duration(900)}>
        <Mascot mood="calm" size={190} />
      </Animated.View>
      <Animated.Text entering={FadeInDown.delay(500).duration(800)} style={styles.logo}>
        Solace
      </Animated.Text>
      <Animated.Text entering={FadeInDown.delay(900).duration(800)} style={styles.tag}>
        A gentle place to land.
      </Animated.Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  logo: { fontFamily: fonts.heading, fontSize: 44, color: colors.ink, marginTop: 8 },
  tag: { fontFamily: fonts.body, fontSize: 17, color: colors.inkSoft },
});
