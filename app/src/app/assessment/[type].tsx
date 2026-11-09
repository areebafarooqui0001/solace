import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackRow, XpBar } from '../../components/bits';
import { CrisisButton } from '../../components/Crisis';
import { useReward } from '../../components/Toast';
import { Button, Card, Press, Screen, select } from '../../components/ui';
import { ASSESSMENTS, AssessmentType, bandFor } from '../../content';
import { api, Award } from '../../api';
import { colors, fonts, radius } from '../../theme';

export default function Assessment() {
  const router = useRouter();
  const reward = useReward();
  const params = useLocalSearchParams<{ type: string }>();
  const type = (params.type && params.type in ASSESSMENTS ? params.type : 'mood') as AssessmentType;
  const cfg = ASSESSMENTS[type];

  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; award: Award } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (all: number[]) => {
    setBusy(true);
    setError('');
    try {
      const score = all.reduce((s, n) => s + n, 0);
      const r = await api.submitAssessment({ type, answers: all, label: bandFor(type, score).title });
      setResult({ score: r.score, award: r.award });
      reward(r.award, 'for checking in');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went off-balance');
    } finally {
      setBusy(false);
    }
  };

  const choose = (v: number) => {
    if (busy) return;
    select();
    const next = [...answers.slice(0, i), v];
    setAnswers(next);
    if (i < cfg.questions.length - 1) setTimeout(() => setI((n) => n + 1), 200);
    else submit(next);
  };

  // ---------- Result ----------
  if (result) {
    const band = bandFor(type, result.score);
    const group = cfg.moves[band.index <= 1 ? 0 : 1];
    return (
      <Screen>
        <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown}>
            <LinearGradient colors={[cfg.color, cfg.soft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <Text style={styles.eyebrow}>YOUR SNAPSHOT · {cfg.title.toUpperCase()}</Text>
              <Text style={styles.resultTitle}>{band.title}</Text>
              <XpBar value={result.score} max={12} fill={colors.ink} track="rgba(255,255,255,0.6)" height={8} />
              <Text style={styles.score}>{result.score} / 12</Text>
              <Text style={styles.disclaimer}>
                {band.needsCare
                  ? "This isn't a diagnosis, just a snapshot. These feelings are worth sharing with someone you trust or a professional, and Help is always one tap away."
                  : "This isn't a diagnosis, just a snapshot. If things ever feel heavy, talking to someone can help."}
              </Text>
            </LinearGradient>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100)}>
            <Card style={{ gap: 12 }}>
              <Text style={styles.cardLabel}>YOUR WELLNESS MOVES</Text>
              <Text style={styles.cardTitle}>{group.heading}</Text>
              {group.items.map((m, n) => (
                <View key={m.t} style={styles.move}>
                  <View style={styles.num}>
                    <Text style={styles.numText}>{n + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.moveTitle}>{m.t}</Text>
                    <Text style={styles.moveBody}>{m.d}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(180)}>
            <Card>
              <Text style={styles.cardTitle}>
                {result.award.gained > 0 ? `+${result.award.gained} Self-Love XP` : 'Already counted today'}
              </Text>
              <Text style={styles.moveBody}>
                {result.award.gained > 0 ? 'You showed up for yourself today.' : 'Come back tomorrow for more XP.'}
              </Text>
            </Card>
          </Animated.View>

          {band.needsCare && <CrisisButton variant="wide" label="Talk to someone now" />}
          <Button
            title="Talk to Sunny about it"
            variant={band.needsCare ? 'soft' : 'primary'}
            onPress={() =>
              router.replace({
                pathname: '/chat/[id]',
                params: { id: 'new', seed: `I just did the ${cfg.title} check-in and my snapshot said "${band.title}".` },
              })
            }
          />
          <Button title="Done" variant="ghost" onPress={() => router.back()} />
        </ScrollView>
      </Screen>
    );
  }

  // ---------- Questions ----------
  const total = cfg.questions.length;
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
        <BackRow label="Back" onPress={() => (i > 0 && !busy ? setI(i - 1) : router.back())} />

        <LinearGradient colors={[cfg.color, cfg.soft]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.qCard}>
          <View style={styles.qTop}>
            <Text style={styles.eyebrow}>
              ✦ QUESTION {i + 1} OF {total} · +2 XP EACH
            </Text>
            <Text style={styles.eyebrow}>{Math.round((i / total) * 100)}%</Text>
          </View>
          <XpBar value={i} max={total} fill={colors.ink} track="rgba(255,255,255,0.6)" height={6} />
          <Text style={styles.intro}>{cfg.intro}</Text>
          <Text style={styles.question}>{cfg.questions[i]}</Text>
        </LinearGradient>

        {cfg.options.map((o, v) => (
          <Animated.View key={`${i}-${o}`} entering={FadeInDown.delay(v * 50)}>
            <Press onPress={() => choose(v)} style={[styles.option, answers[i] === v && styles.optionOn]}>
              <Text style={styles.optionText}>{o}</Text>
            </Press>
          </Animated.View>
        ))}

        {busy && <Text style={styles.status}>Reading your snapshot...</Text>}
        {!!error && (
          <View style={{ gap: 8 }}>
            <Text style={styles.error}>{error}</Text>
            <Button title="Try again" onPress={() => submit(answers)} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 22, paddingBottom: 40, gap: 12 },
  qCard: { borderRadius: radius.lg, padding: 20, gap: 12 },
  qTop: { flexDirection: 'row', justifyContent: 'space-between' },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.1, color: colors.ink, opacity: 0.7 },
  intro: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, marginTop: 6 },
  question: { fontFamily: fonts.body, fontSize: 19, lineHeight: 27, color: colors.ink },
  option: { backgroundColor: '#fff', borderRadius: radius.pill, height: 58, justifyContent: 'center', paddingHorizontal: 22, borderWidth: 2, borderColor: 'transparent' },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { fontFamily: fonts.semi, fontSize: 17, color: colors.ink },
  status: { fontFamily: fonts.body, color: colors.inkSoft, textAlign: 'center', marginTop: 8 },
  error: { fontFamily: fonts.semi, color: colors.danger, textAlign: 'center' },
  hero: { borderRadius: radius.lg, padding: 22, gap: 12 },
  resultTitle: { fontFamily: fonts.heading, fontSize: 34, lineHeight: 40, color: colors.ink },
  score: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink, opacity: 0.75 },
  disclaimer: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink, opacity: 0.85 },
  cardLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, color: colors.inkSoft },
  cardTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  move: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  num: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  numText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  moveTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  moveBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft, marginTop: 2 },
});
