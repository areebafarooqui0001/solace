import React, { useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Mascot } from '../components/Mascot';
import { Button, Screen } from '../components/ui';
import { useAuth } from '../auth';
import { Mood, colors, fonts } from '../theme';

const SLIDES: { mood: Mood; title: string; body: string }[] = [
  {
    mood: 'joyful',
    title: 'Meet Sunny',
    body: 'Your calm companion. Talk about your day, your worries, your wins. Sunny listens first and never judges.',
  },
  {
    mood: 'calm',
    title: 'Notice how you feel',
    body: 'Quick daily check-ins turn scattered feelings into patterns you can actually understand.',
  },
  {
    mood: 'neutral',
    title: 'Small habits, real change',
    body: 'Breathing, reflections and gentle reminders. A few minutes a day, shaped around you.',
  },
  {
    mood: 'tired',
    title: 'Sunny remembers, you decide',
    body: 'Sunny can remember what matters to you so it feels personal. You can see it, edit it or switch it off anytime.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList>(null);
  const last = index === SLIDES.length - 1;

  const finish = async () => {
    await SecureStore.setItemAsync('solace_onboarded', '1').catch(() => {});
    router.replace(user ? '/(tabs)/home' : '/signup');
  };

  const next = () => {
    if (last) return finish();
    list.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  return (
    <Screen>
      <View style={styles.skipRow}>
        {!last && (
          <Text onPress={finish} style={styles.skip}>
            Skip
          </Text>
        )}
      </View>
      <FlatList
        ref={list}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.title}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Mascot mood={item.mood} size={210} />
            <Animated.Text key={item.title} entering={FadeInDown.duration(500)} style={styles.title}>
              {item.title}
            </Animated.Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />
      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
        <Button title={last ? "Let's begin" : 'Continue'} onPress={next} />
        <Text style={styles.login} onPress={() => router.replace('/login')}>
          I already have an account
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skipRow: { height: 44, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 24 },
  skip: { fontFamily: fonts.semi, color: colors.inkSoft, fontSize: 15 },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 18 },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink, textAlign: 'center', marginTop: 16 },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 26, color: colors.inkSoft, textAlign: 'center' },
  footer: { paddingHorizontal: 28, paddingBottom: 20, gap: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.line },
  dotOn: { width: 26, backgroundColor: colors.primary },
  login: { textAlign: 'center', fontFamily: fonts.semi, color: colors.primary, fontSize: 15, paddingTop: 4 },
});
