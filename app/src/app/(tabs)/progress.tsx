import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card, Screen } from '../../components/ui';
import { api, MoodEntry, parseServerDate, Progress } from '../../api';
import { CHECKIN_MOODS, colors, fonts, radius } from '../../theme';

const DAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const BAR = [colors.peach, colors.peach, colors.sky, colors.sage, colors.primaryLight];

export default function ProgressScreen() {
  const [p, setP] = useState<Progress | null>(null);
  const [moods, setMoods] = useState<MoodEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      api.progress().then(setP).catch(() => {});
      api.moods(7).then((r) => setMoods(r.moods)).catch(() => {});
    }, [])
  );

  // average score per calendar day, last 7 days
  const week = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const entries = moods.filter((m) => parseServerDate(m.created_at).toDateString() === d.toDateString());
    const avg = entries.length ? entries.reduce((s, m) => s + m.score, 0) / entries.length : 0;
    return { day: DAY[d.getDay()], avg, today: i === 6 };
  });

  const stat = (n: number | undefined, label: string, icon: React.ComponentProps<typeof Ionicons>['name']) => (
    <Card style={styles.stat}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.statN}>{n ?? 0}</Text>
      <Text style={styles.statL}>{label}</Text>
    </Card>
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Your journey</Text>

        <Animated.View entering={FadeInDown} style={styles.hero}>
          <Ionicons name="flame" size={34} color="#fff" />
          <Text style={styles.heroN}>{p?.streak ?? 0}</Text>
          <Text style={styles.heroL}>{p?.streak === 1 ? 'day streak' : 'day streak'}</Text>
          <Text style={styles.heroSub}>{(p?.streak ?? 0) === 0 ? 'Check in today to start one.' : 'Gentle consistency beats perfection.'}</Text>
        </Animated.View>

        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>This week's mood</Text>
            {p?.weekAvg ? <Text style={styles.avg}>avg {p.weekAvg} {CHECKIN_MOODS[Math.round(p.weekAvg) - 1]?.emoji}</Text> : null}
          </View>
          <View style={styles.chart}>
            {week.map((w, i) => (
              <View key={i} style={styles.col}>
                <View style={styles.track}>
                  <View
                    style={{
                      height: `${(w.avg / 5) * 100}%`,
                      minHeight: w.avg ? 10 : 0,
                      borderRadius: 10,
                      backgroundColor: w.avg ? BAR[Math.max(0, Math.round(w.avg) - 1)] : 'transparent',
                    }}
                  />
                </View>
                <Text style={[styles.day, w.today && { color: colors.primary, fontFamily: fonts.bold }]}>{w.day}</Text>
              </View>
            ))}
          </View>
          {!moods.length && <Text style={styles.empty}>Your check-ins will appear here.</Text>}
        </Card>

        <View style={styles.stats}>
          {stat(p?.stats.checkins, 'Check-ins', 'happy-outline')}
          {stat(p?.stats.breathing, 'Breathing', 'cloudy-outline')}
          {stat(p?.stats.conversations, 'Chats', 'chatbubble-outline')}
          {stat(p?.stats.challenges, 'Small wins', 'checkmark-circle-outline')}
        </View>

        <Text style={styles.section}>Milestones</Text>
        <View style={styles.badges}>
          {(p?.badges ?? []).map((b) => (
            <View key={b.id} style={[styles.badge, !b.earned && { opacity: 0.45 }]}>
              <Ionicons name={b.earned ? 'ribbon' : 'ribbon-outline'} size={26} color={b.earned ? '#E0A23B' : colors.inkSoft} />
              <Text style={styles.badgeText}>{b.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 22, paddingBottom: 40, gap: 16 },
  title: { fontFamily: fonts.heading, fontSize: 30, color: colors.ink },
  hero: { backgroundColor: '#F2955A', borderRadius: radius.lg, padding: 24, alignItems: 'center', gap: 2 },
  heroN: { fontFamily: fonts.heading, fontSize: 56, color: '#fff', lineHeight: 64 },
  heroL: { fontFamily: fonts.bold, fontSize: 16, color: '#FFF1E6' },
  heroSub: { fontFamily: fonts.body, fontSize: 14, color: '#FFF1E6', marginTop: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  avg: { fontFamily: fonts.semi, color: colors.inkSoft },
  chart: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, height: 130 },
  col: { flex: 1, alignItems: 'center', gap: 6 },
  track: { flex: 1, width: 22, justifyContent: 'flex-end', backgroundColor: colors.bg, borderRadius: 10 },
  day: { fontFamily: fonts.semi, fontSize: 12, color: colors.inkSoft },
  empty: { fontFamily: fonts.body, color: colors.inkSoft, textAlign: 'center', marginTop: 10, fontSize: 14 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', padding: 14, gap: 2 },
  statN: { fontFamily: fonts.heading, fontSize: 26, color: colors.ink },
  statL: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft },
  section: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, marginTop: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badge: { width: '31%', backgroundColor: '#fff', borderRadius: radius.md, padding: 12, alignItems: 'center', gap: 6 },
  badgeText: { fontFamily: fonts.semi, fontSize: 12, color: colors.ink, textAlign: 'center' },
});
