import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Chip } from './ui';
import { TimeSheet, fmtTime } from './TimeSheet';
import { FEELINGS, GOALS } from '../content';
import { colors, fonts } from '../theme';

export type Reminder = { remind: boolean; time: { hour: number; minute: number } };

/** Small progress dots so every step feels short and finishable. */
export function StepDots({ total, index }: { total: number; index: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.dot, i === index && styles.dotOn, i < index && styles.dotDone]} />
      ))}
    </View>
  );
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{sub}</Text>
    </>
  );
}

export function GoalsPick({ value, onChange, title }: { value: string[]; onChange: (v: string[]) => void; title?: string }) {
  return (
    <>
      <Header title={title ?? 'What would you like help with?'} sub="Pick any. You can change this later." />
      <View style={styles.chips}>
        {GOALS.map((g) => (
          <Chip key={g} label={g} selected={value.includes(g)} onPress={() => onChange(value.includes(g) ? value.filter((x) => x !== g) : [...value, g])} />
        ))}
      </View>
    </>
  );
}

export function FeelingPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <Header title="How have you been feeling lately?" sub="No wrong answer. It just helps Sunny start gently." />
      <View style={styles.chips}>
        {FEELINGS.map((f) => (
          <Chip key={f} label={f} selected={value === f} onPress={() => onChange(value === f ? '' : f)} />
        ))}
      </View>
    </>
  );
}

const PRESETS = [
  { l: 'Morning', h: 8 },
  { l: 'Afternoon', h: 14 },
  { l: 'Evening', h: 20 },
];

export function ReminderPick({ value, onChange }: { value: Reminder; onChange: (v: Reminder) => void }) {
  const [picking, setPicking] = useState(false);
  const { remind, time } = value;
  const custom = remind && (!PRESETS.some((p) => p.h === time.hour) || time.minute !== 0);
  return (
    <>
      <Header title="When should Sunny check in?" sub="One gentle nudge a day. You choose the time." />
      <View style={styles.chips}>
        {PRESETS.map((o) => (
          <Chip
            key={o.l}
            label={`${o.l} · ${fmtTime(o.h, 0)}`}
            selected={remind && time.hour === o.h && time.minute === 0}
            onPress={() => onChange({ remind: true, time: { hour: o.h, minute: 0 } })}
          />
        ))}
        <Chip label={custom ? `Custom · ${fmtTime(time.hour, time.minute)}` : 'Custom time'} selected={custom} onPress={() => setPicking(true)} />
        <Chip label="No reminders" selected={!remind} onPress={() => onChange({ remind: false, time })} />
      </View>
      <TimeSheet
        visible={picking}
        title="Check-in time"
        hour={time.hour}
        minute={time.minute}
        onClose={() => setPicking(false)}
        onSave={(hour, minute) => {
          onChange({ remind: true, time: { hour, minute } });
          setPicking(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E7DCC3' },
  dotDone: { backgroundColor: colors.primaryLight },
  dotOn: { width: 22, backgroundColor: colors.primary },
  title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink, textAlign: 'center' },
  sub: { fontFamily: fonts.body, fontSize: 16, color: colors.inkSoft, textAlign: 'center', marginBottom: 24, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
});
