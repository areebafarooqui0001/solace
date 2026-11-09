import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Mascot } from '../../components/Mascot';
import { Button, Screen, success } from '../../components/ui';
import { api } from '../../api';
import { colors, fonts, radius } from '../../theme';

type Config = {
  title: string;
  intro: string;
  steps?: string[];
  prompt?: string;
  cta: string;
};

const REFLECTIONS = [
  'What is one thing that took more energy than you expected today?',
  'What did you need today that you did not get? How could you give it to yourself?',
  'When did you feel most like yourself recently?',
  'What would you tell a close friend who felt the way you do right now?',
];

const CONFIG: Record<string, Config> = {
  reflection: {
    title: 'A moment to reflect',
    intro: REFLECTIONS[new Date().getDate() % REFLECTIONS.length],
    prompt: 'Write whatever comes up. It stays private.',
    cta: 'Done reflecting',
  },
  gratitude: {
    title: 'Three good things',
    intro: 'They can be tiny. Warm tea counts.',
    prompt: '1.\n2.\n3.',
    cta: 'Save and finish',
  },
  grounding: {
    title: 'Ground yourself',
    intro: 'Slowly, with your eyes, then your senses:',
    steps: ['5 things you can see', '4 things you can touch', '3 things you can hear', '2 things you can smell', '1 thing you can taste'],
    cta: 'I feel more present',
  },
  selfcare: {
    title: 'Wind down, softly',
    intro: 'Pick one small thing for tonight:',
    steps: ['Put your phone on charge, away from the bed', 'Drink a glass of water', 'Do 3 slow stretches', 'Write tomorrow\'s one priority, then let it go'],
    cta: 'Goodnight, me',
  },
  walk: {
    title: 'A short walk',
    intro: 'Five minutes, no destination.',
    steps: ['Leave your phone in your pocket', 'Notice your footsteps', 'Look at something far away'],
    cta: 'Done',
  },
  water: {
    title: 'Water break',
    intro: 'Your body might be asking for this.',
    steps: ['Fill a full glass', 'Drink slowly', 'Take one deep breath after'],
    cta: 'Done',
  },
  stretch: {
    title: 'Gentle stretch',
    intro: 'Let your body release what your mind is holding.',
    steps: ['Roll your shoulders back 5 times', 'Slowly tilt your head side to side', 'Reach your arms overhead and breathe', 'Fold forward and hang loose'],
    cta: 'Done',
  },
};

export default function Activity() {
  const router = useRouter();
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const [affirmation, setAffirmation] = useState('');
  const [text, setText] = useState('');
  const [checked, setChecked] = useState<number[]>([]);

  useEffect(() => {
    if (kind === 'affirmation') api.daily().then((d) => setAffirmation(d.affirmation)).catch(() => {});
  }, [kind]);

  const finish = async () => {
    success();
    api.logActivity(String(kind)).catch(() => {});
    router.back();
  };

  if (kind === 'affirmation') {
    return (
      <Screen>
        <View style={styles.center}>
          <Mascot mood="joyful" size={150} />
          <Text style={styles.label}>TODAY'S AFFIRMATION</Text>
          <Text style={styles.affirm}>{affirmation || '...'}</Text>
          <Text style={styles.sub}>Read it slowly. Say it to yourself once, out loud if you can.</Text>
          <View style={{ width: '100%', marginTop: 24 }}>
            <Button title="I'll carry this with me" onPress={finish} />
          </View>
        </View>
      </Screen>
    );
  }

  const c = CONFIG[String(kind)] ?? CONFIG.reflection;
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{c.title}</Text>
        <Text style={styles.intro}>{c.intro}</Text>

        {c.steps?.map((s, i) => {
          const on = checked.includes(i);
          return (
            <Text
              key={s}
              onPress={() => setChecked((cur) => (on ? cur.filter((x) => x !== i) : [...cur, i]))}
              style={[styles.step, on && styles.stepOn]}
            >
              {on ? '✓  ' : '○  '}
              {s}
            </Text>
          );
        })}

        {c.prompt && (
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={c.prompt}
            placeholderTextColor="#B5ABC0"
            style={styles.input}
            multiline
          />
        )}

        <Button title={c.cta} onPress={finish} style={{ marginTop: 10 }} />
        <Button title="Not now" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 26, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  title: { fontFamily: fonts.heading, fontSize: 30, color: colors.ink },
  intro: { fontFamily: fonts.body, fontSize: 18, lineHeight: 27, color: colors.inkSoft },
  label: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, color: colors.primary, marginTop: 16 },
  affirm: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 38, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft, textAlign: 'center' },
  step: { backgroundColor: '#fff', borderRadius: radius.md, padding: 18, fontFamily: fonts.semi, fontSize: 16, color: colors.ink, overflow: 'hidden' },
  stepOn: { backgroundColor: colors.sageSoft, color: '#3E7F5E' },
  input: { minHeight: 160, backgroundColor: '#fff', borderRadius: 22, padding: 18, fontFamily: fonts.body, fontSize: 16, color: colors.ink, textAlignVertical: 'top', borderWidth: 1.5, borderColor: colors.line },
});
