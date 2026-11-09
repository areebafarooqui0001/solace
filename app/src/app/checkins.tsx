import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackRow } from '../components/bits';
import { Press, Screen } from '../components/ui';
import { ASSESSMENTS, ASSESSMENT_ORDER } from '../content';
import { api, Progress } from '../api';
import { colors, fonts, radius } from '../theme';

export default function Checkins() {
  const router = useRouter();
  const [p, setP] = useState<Progress | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.progress().then(setP).catch(() => {});
    }, [])
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
        <BackRow label="Home" onPress={() => router.back()} />
        <Text style={styles.eyebrow}>Take a moment</Text>
        <Text style={styles.title}>Check-ins</Text>
        <Text style={styles.sub}>Friendly screenings, not diagnoses. Each one earns XP and feeds your streak.</Text>
        <View style={styles.chip}>
          <Ionicons name="flame" size={15} color="#F2955A" />
          <Text style={styles.chipText}>{p?.streak ?? 0}-day streak</Text>
        </View>

        {ASSESSMENT_ORDER.map((t, i) => {
          const a = ASSESSMENTS[t];
          return (
            <Animated.View key={t} entering={FadeInDown.delay(i * 80)}>
              <Press onPress={() => router.push(`/assessment/${t}`)}>
                <LinearGradient colors={[a.color, a.soft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
                  <Text style={styles.cardTitle}>{a.title}</Text>
                  <Text style={styles.cardBlurb}>{a.blurb}</Text>
                  <Text style={styles.xp}>✦ +2 XP PER QUESTION · +40 BONUS</Text>
                </LinearGradient>
              </Press>
            </Animated.View>
          );
        })}

        <Text style={styles.note}>
          These are quick snapshots inspired by common wellness questionnaires. They can't diagnose anything. If things feel heavy, talking to someone can help.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 22, paddingBottom: 40, gap: 14 },
  eyebrow: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft, marginTop: 8 },
  title: { fontFamily: fonts.heading, fontSize: 36, color: colors.ink, marginTop: -8 },
  sub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.butterSoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  chipText: { fontFamily: fonts.semi, fontSize: 13, color: colors.ink },
  card: { borderRadius: radius.lg, padding: 22, gap: 8, minHeight: 130, justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.heading, fontSize: 26, color: colors.ink },
  cardBlurb: { fontFamily: fonts.body, fontSize: 15, color: colors.ink, opacity: 0.8 },
  xp: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.ink, opacity: 0.65, marginTop: 4 },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.inkSoft, textAlign: 'center', marginTop: 6 },
});
