import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BackRow, XpBar } from '../../components/bits';
import { CrisisButton } from '../../components/Crisis';
import { useReward } from '../../components/Toast';
import { Button, Card, Press, Screen, select } from '../../components/ui';
import { RESOURCES } from '../../content';
import { api } from '../../api';
import { colors, fonts, radius } from '../../theme';

export default function ResourceDetail() {
  const router = useRouter();
  const reward = useReward();
  const { id } = useLocalSearchParams<{ id: string }>();
  const r = RESOURCES.find((x) => x.id === id) ?? RESOURCES[0];
  const [done, setDone] = useState<number[]>([]);

  const toggle = (i: number) => {
    select();
    if (done.includes(i)) return setDone((d) => d.filter((x) => x !== i));
    setDone((d) => [...d, i]);
    // XP is granted once per step per day on the server, so toggling can't farm it
    api
      .logActivity('resource_step', `${r.id}:${i}`)
      .then((res) => reward(res.award, `for trying "${r.steps[i].t}"`))
      .catch(() => {});
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
        <BackRow label="Resources" onPress={() => router.back()} />

        <LinearGradient colors={[r.color, `${r.color}AA`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.eyebrow}>{r.eyebrow}</Text>
          <Text style={styles.title}>{r.title}</Text>
          <Text style={styles.desc}>{r.desc}</Text>
          <View style={styles.progressRow}>
            <Text style={styles.eyebrow}>
              ✦ {done.length}/{r.steps.length} STEPS · +2 XP EACH
            </Text>
            <Text style={styles.eyebrow}>{Math.round((done.length / r.steps.length) * 100)}%</Text>
          </View>
          <XpBar value={done.length} max={r.steps.length} fill={colors.ink} track="rgba(255,255,255,0.6)" height={8} />
        </LinearGradient>

        <Card style={{ gap: 10 }}>
          <Text style={styles.label}>TAP EACH AS YOU TRY IT</Text>
          {r.steps.map((s, i) => {
            const on = done.includes(i);
            return (
              <Press key={s.t} onPress={() => toggle(i)} style={[styles.step, on && styles.stepOn]}>
                <View style={[styles.num, on && { backgroundColor: colors.primary }]}>
                  {on ? <Ionicons name="checkmark" size={16} color="#fff" /> : <Text style={styles.numText}>{i + 1}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepTitle}>{s.t}</Text>
                  <Text style={styles.stepBody}>{s.d}</Text>
                </View>
              </Press>
            );
          })}
        </Card>

        {r.talkPrompt && (
          <Card style={{ gap: 12 }}>
            <Text style={styles.stepBody}>Still struggling? Don't ride it solo. Sunny is a tap away, and real people are on the helpline any time.</Text>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Button
                title="Chat with Sunny"
                onPress={() => router.replace({ pathname: '/chat/[id]', params: { id: 'new', seed: r.talkPrompt } })}
                style={{ flex: 1 }}
              />
              <CrisisButton label="Get help" />
            </View>
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 22, paddingBottom: 40, gap: 14 },
  hero: { borderRadius: radius.lg, padding: 22, gap: 10 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.1, color: colors.ink, opacity: 0.7 },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink },
  desc: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink, opacity: 0.85 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  label: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.2, color: colors.inkSoft },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: colors.butterSoft, borderRadius: radius.md, padding: 14 },
  stepOn: { backgroundColor: colors.mintSoft },
  num: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  numText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  stepTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  stepBody: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft, marginTop: 2 },
});
