import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Mascot } from '../components/Mascot';
import { Button, Chip, Press, Screen, select, success } from '../components/ui';
import { useReward } from '../components/Toast';
import { api } from '../api';
import { CHECKIN_MOODS, MOOD_TAGS, colors, fonts, moodFromScore } from '../theme';

const REPLY: Record<number, string> = {
  1: "I'm sorry it's been rough. You don't have to carry it alone.",
  2: 'Low days count too. Thanks for being honest.',
  3: 'Steady is okay. Sometimes okay is plenty.',
  4: "Good to hear. Let's notice what's helping.",
  5: 'That is wonderful. Let it sink in for a second.',
};

export default function CheckIn() {
  const router = useRouter();
  const reward = useReward();
  const params = useLocalSearchParams<{ score?: string }>();
  const [score, setScore] = useState<number>(params.score ? Number(params.score) : 0);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const toggle = (t: string) => setTags((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t]));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await api.addMood({ score, tags, note: note.trim() || undefined });
      reward(r.award, 'for checking in');
      success();
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const talk = () => {
    const label = CHECKIN_MOODS.find((m) => m.score === score)?.label.toLowerCase();
    const ctx = tags.length ? ` It's mostly about ${tags.join(', ').toLowerCase()}.` : '';
    router.replace({ pathname: '/chat/[id]', params: { id: 'new', seed: `I'm feeling ${label} today.${ctx}${note ? ' ' + note : ''}` } });
  };

  if (done) {
    return (
      <Screen>
        <View style={styles.doneWrap}>
          <Mascot mood={moodFromScore(score)} size={170} />
          <Text style={styles.title}>Logged. Thank you.</Text>
          <Text style={styles.sub}>{REPLY[score]}</Text>
          <View style={{ width: '100%', gap: 10, marginTop: 24 }}>
            <Button title="Talk to Sunny about it" onPress={talk} />
            <Button title="Maybe later" variant="ghost" onPress={() => router.back()} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>How are you, really?</Text>
        <Text style={styles.sub}>Pick what's closest. There's no wrong answer.</Text>

        <View style={styles.moods}>
          {CHECKIN_MOODS.map((m) => (
            <Press
              key={m.score}
              onPress={() => {
                select();
                setScore(m.score);
              }}
              style={[styles.mood, score === m.score && styles.moodOn]}
            >
              <Text style={{ fontSize: score === m.score ? 40 : 32 }}>{m.emoji}</Text>
              <Text style={[styles.moodLabel, score === m.score && { color: colors.primary }]}>{m.label}</Text>
            </Press>
          ))}
        </View>

        {score > 0 && (
          <>
            <Text style={styles.q}>What's it connected to?</Text>
            <View style={styles.tags}>
              {MOOD_TAGS.map((t) => (
                <Chip key={t} label={t} selected={tags.includes(t)} onPress={() => toggle(t)} />
              ))}
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Anything you want to add? (optional)"
              placeholderTextColor="#B5ABC0"
              style={styles.note}
              multiline
              maxLength={500}
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Button title="Save check-in" onPress={save} loading={busy} />
          </>
        )}
        <Button title="Close" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24, gap: 14 },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 8 },
  title: { fontFamily: fonts.heading, fontSize: 30, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: colors.inkSoft, textAlign: 'center' },
  moods: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 10 },
  mood: { alignItems: 'center', justifyContent: 'center', gap: 4, flex: 1, height: 96, borderRadius: 22 },
  moodOn: { backgroundColor: '#fff' },
  moodLabel: { fontFamily: fonts.semi, fontSize: 12, color: colors.inkSoft },
  q: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink, marginTop: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { minHeight: 90, backgroundColor: '#fff', borderRadius: 20, padding: 16, fontFamily: fonts.body, fontSize: 16, color: colors.ink, textAlignVertical: 'top', borderWidth: 1.5, borderColor: colors.line },
  error: { fontFamily: fonts.semi, color: colors.danger, textAlign: 'center' },
});
