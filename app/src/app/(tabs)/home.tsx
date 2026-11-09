import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Mascot } from '../../components/Mascot';
import { XpBar } from '../../components/bits';
import { CrisisButton } from '../../components/Crisis';
import { Card, Press, Screen, success } from '../../components/ui';
import { useReward } from '../../components/Toast';
import { useAuth } from '../../auth';
import { ACTIVITY_ROUTE } from '../../activities';
import { api, Challenge, DailyNote, MoodEntry, parseServerDate, Progress } from '../../api';
import { CHECKIN_MOODS, Mood, colors, fonts, moodFromScore, radius } from '../../theme';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const TILES: { label: string; sub: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string; href: string }[] = [
  { label: 'Sunny', sub: 'Talk it out', icon: 'sparkles', color: colors.violet, href: '/chat/new' },
  { label: 'Check-in', sub: '2 min screen', icon: 'clipboard-outline', color: colors.mint, href: '/checkins' },
  { label: 'Breathe', sub: '60s reset', icon: 'cloudy-outline', color: colors.butter, href: '/breathe' },
  { label: 'Resources', sub: 'Guides & tools', icon: 'book-outline', color: colors.coral, href: '/resources' },
];

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [affirmation, setAffirmation] = useState('');
  const [today, setToday] = useState<MoodEntry | null>(null);
  const [p, setP] = useState<Progress | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const reward = useReward();
  const [note, setNote] = useState<DailyNote | null>(null);
  const [noteLoading, setNoteLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, m, prog] = await Promise.all([api.daily(), api.moods(2), api.progress()]);
      setOffline(false);
      setAffirmation(d.affirmation);
      setP(prog);
      const todayStr = new Date().toDateString();
      setToday([...m.moods].reverse().find((x) => parseServerDate(x.created_at).toDateString() === todayStr) ?? null);
    } catch {
      setOffline(true);
    }
    api.challenge().then(setChallenge).catch(() => {});
    // Sunny's personal note is written by the AI, so it loads on its own without holding up the rest of Home.
    api
      .dailyNote()
      .then((n) => {
        setNote(n);
        if (n.affirmation) setAffirmation(n.affirmation);
      })
      .catch(() => {})
      .finally(() => setNoteLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const completeChallenge = async () => {
    if (!challenge || challenge.done) return;
    setChallenge({ ...challenge, done: true });
    success();
    try {
      const r = await api.completeChallenge();
      reward(r.award, 'for a small win');
      api.progress().then(setP).catch(() => {});
    } catch {
      setChallenge(challenge);
    }
  };

  const mood: Mood = today ? moodFromScore(today.score) : 'calm';
  const first = user?.name.split(' ')[0] ?? 'friend';
  const xpIn = p?.xpInLevel ?? 0;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.wrap}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>{greeting()},</Text>
            <Text style={styles.name}>{first}</Text>
          </View>
          <CrisisButton />
          <Press onPress={() => router.push('/(tabs)/profile')} style={styles.gear}>
            <Ionicons name="settings-outline" size={20} color={colors.ink} />
          </Press>
        </View>

        {offline && (
          <Card style={styles.offline}>
            <Ionicons name="cloud-offline-outline" size={20} color={colors.inkSoft} />
            <Text style={styles.offlineText}>Can't reach Solace right now. Pull down to try again.</Text>
          </Card>
        )}

        <Press onPress={() => router.push('/(tabs)/chat')} style={styles.hero}>
          <Mascot mood={mood} size={110} />
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              {today ? 'Want to tell me more about today?' : `Hi ${first}! How is your heart today?`}
            </Text>
          </View>
        </Press>

        <Animated.View entering={FadeInDown.delay(60)}>
          {today ? (
            <Press onPress={() => router.push('/checkin')}>
              <Card style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLabel}>DAILY CHECK-IN</Text>
                  <Text style={styles.cardTitle}>You showed up today 💚</Text>
                  <Text style={styles.cardSub}>
                    Feeling {CHECKIN_MOODS.find((m) => m.score === today.score)?.label.toLowerCase()}. Tap to check in again.
                  </Text>
                </View>
                <View style={styles.heart}>
                  <Ionicons name="heart" size={22} color={colors.coral} />
                </View>
              </Card>
            </Press>
          ) : (
            <Card>
              <Text style={styles.cardLabel}>DAILY CHECK-IN</Text>
              <Text style={styles.cardTitle}>How are you feeling right now?</Text>
              <View style={styles.moodRow}>
                {CHECKIN_MOODS.map((m) => (
                  <Press key={m.score} onPress={() => router.push({ pathname: '/checkin', params: { score: String(m.score) } })} style={styles.moodBtn}>
                    <Text style={{ fontSize: 30 }}>{m.emoji}</Text>
                    <Text style={styles.moodLabel}>{m.label}</Text>
                  </Press>
                ))}
              </View>
            </Card>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120)}>
          <Card style={{ gap: 10 }}>
            <Text style={styles.cardLabel}>SUNNY'S NOTE FOR YOU</Text>
            {note ? (
              <>
                <Text style={styles.noteText}>{note.note}</Text>
                <Press onPress={() => router.push('/activity/affirmation')}>
                  <LinearGradient colors={['#FF9E85', '#FFB9A0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.affirm}>
                    <Text style={styles.affLabel}>✺ TODAY'S AFFIRMATION</Text>
                    <Text style={styles.affText}>"{affirmation || note.affirmation}"</Text>
                  </LinearGradient>
                </Press>
                {note.suggestion && ACTIVITY_ROUTE[note.suggestion.kind] && (
                  <Press onPress={() => router.push(ACTIVITY_ROUTE[note.suggestion!.kind].href as never)} style={styles.noteBtn}>
                    <Ionicons name={ACTIVITY_ROUTE[note.suggestion.kind].icon} size={18} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.noteBtnTitle}>{ACTIVITY_ROUTE[note.suggestion.kind].label}</Text>
                      {!!note.suggestion.why && <Text style={styles.noteBtnWhy}>{note.suggestion.why}</Text>}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.inkSoft} />
                  </Press>
                )}
              </>
            ) : (
              <Text style={[styles.noteText, { opacity: 0.55 }]}>
                {noteLoading ? 'Sunny is thinking of you...' : `Hi ${first}. Pull down to refresh and I'll write you a note.`}
              </Text>
            )}
          </Card>
        </Animated.View>

        {challenge && (
          <Animated.View entering={FadeInDown.delay(180)}>
            <Press onPress={completeChallenge} disabled={challenge.done}>
              <Card style={[styles.row, challenge.done && { backgroundColor: colors.mintSoft }]}>
                <View style={[styles.check, challenge.done && styles.checkOn]}>
                  {challenge.done && <Ionicons name="checkmark" size={20} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLabel}>TODAY'S SMALL CHALLENGE</Text>
                  <Text style={[styles.challengeTitle, challenge.done && { opacity: 0.6 }]}>{challenge.title}</Text>
                  <Text style={styles.cardSub}>{challenge.done ? 'Done. That counts. 💚' : `${challenge.detail}  ·  +${challenge.xp ?? 15} XP`}</Text>
                </View>
              </Card>
            </Press>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(240)}>
          <LinearGradient colors={[colors.mint, '#BDE3CC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.level}>
            <View style={styles.levelTop}>
              <View>
                <Text style={styles.eyebrow}>SELF-LOVE LEVEL</Text>
                <Text style={styles.lv}>Lv. {p?.level ?? 1} · {p?.levelName ?? 'Seed'}</Text>
              </View>
              <View style={styles.streak}>
                <Ionicons name="flame" size={16} color="#F2955A" />
                <Text style={styles.streakText}>{p?.streak ?? 0} day streak</Text>
              </View>
            </View>
            <XpBar value={xpIn} max={100} fill={colors.primary} track="rgba(255,255,255,0.65)" />
            <View style={styles.xpRow}>
              <Text style={styles.xpText}>✦ {xpIn} / 100 XP</Text>
              <Text style={styles.xpText}>{100 - xpIn} to next level</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <Text style={styles.section}>Quick start</Text>
        <View style={styles.grid}>
          {TILES.map((t, i) => (
            <Animated.View key={t.label} entering={FadeInDown.delay(260 + i * 60)} style={{ width: '48%' }}>
              <Press onPress={() => router.push(t.href as never)}>
                <LinearGradient colors={[t.color, `${t.color}CC`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
                  <View style={styles.tileIcon}>
                    <Ionicons name={t.icon} size={20} color={colors.ink} />
                  </View>
                  <View>
                    <Text style={styles.tileLabel}>{t.label}</Text>
                    <Text style={styles.tileSub}>{t.sub}</Text>
                  </View>
                </LinearGradient>
              </Press>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 22, paddingBottom: 40, gap: 16 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hello: { fontFamily: fonts.body, fontSize: 16, color: colors.inkSoft },
  name: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink },
  gear: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.lg, padding: 14 },
  bannerIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  bannerSub: { fontFamily: fonts.body, fontSize: 13, color: colors.ink, opacity: 0.8 },
  bannerBtn: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  bannerBtnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  hero: { alignItems: 'center', gap: 2 },
  bubble: { backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.lg },
  bubbleText: { fontFamily: fonts.semi, color: colors.ink, fontSize: 15 },
  level: { borderRadius: radius.lg, padding: 18, gap: 10 },
  levelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.3, color: colors.ink, opacity: 0.7 },
  lv: { fontFamily: fonts.heading, fontSize: 26, color: colors.ink, lineHeight: 32 },
  lvName: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink, opacity: 0.75 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  streakText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between' },
  xpText: { fontFamily: fonts.semi, fontSize: 13, color: colors.ink, opacity: 0.8 },
  affirm: { borderRadius: radius.md, padding: 18, gap: 6 },
  affLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.3, color: colors.ink, opacity: 0.7 },
  affText: { fontFamily: fonts.heading, fontSize: 21, lineHeight: 28, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.3, color: colors.inkSoft },
  cardTitle: { fontFamily: fonts.heading, fontSize: 21, color: colors.ink, marginTop: 4 },
  cardSub: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, marginTop: 4 },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  offlineText: { flex: 1, fontFamily: fonts.semi, fontSize: 13, color: colors.inkSoft },
  check: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  challengeTitle: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink, marginTop: 3 },
  noteText: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.ink },
  noteBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bg, borderRadius: radius.md, padding: 12, marginTop: 4 },
  noteBtnTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  noteBtnWhy: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft, marginTop: 1 },
  heart: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center' },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  moodBtn: { alignItems: 'center', gap: 4, paddingVertical: 6, flex: 1 },
  moodLabel: { fontFamily: fonts.semi, fontSize: 12, color: colors.inkSoft },
  section: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  tile: { borderRadius: radius.lg, padding: 16, minHeight: 124, justifyContent: 'space-between' },
  tileIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink },
  tileSub: { fontFamily: fonts.body, fontSize: 13, color: colors.ink, opacity: 0.75, marginTop: 1 },
});
