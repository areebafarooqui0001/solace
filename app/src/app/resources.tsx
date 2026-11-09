import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BackRow } from '../components/bits';
import { CrisisButton } from '../components/Crisis';
import { Card, Press, Screen } from '../components/ui';
import { PRACTICES, RESOURCES } from '../content';
import { colors, fonts, radius } from '../theme';

export default function Resources() {
  const router = useRouter();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
        <BackRow label="Home" onPress={() => router.back()} />
        <Text style={styles.eyebrow}>Guides & tools</Text>
        <Text style={styles.title}>Resources</Text>

        {RESOURCES.map((r, i) => (
          <Animated.View key={r.id} entering={FadeInDown.delay(i * 60)}>
            <Press onPress={() => router.push(`/resource/${r.id}`)}>
              <LinearGradient colors={[r.color, `${r.color}AA`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
                <View style={styles.icon}>
                  <Ionicons name={r.icon} size={22} color={colors.ink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{r.title}</Text>
                  <Text style={styles.cardSub}>{r.sub}</Text>
                </View>
              </LinearGradient>
            </Press>
          </Animated.View>
        ))}

        <Text style={styles.section}>Quick practices</Text>
        <View style={styles.grid}>
          {PRACTICES.map((p) => (
            <Press key={p.label} onPress={() => router.push(p.href as never)} style={styles.practice}>
              <Ionicons name={p.icon} size={22} color={colors.primary} />
              <Text style={styles.practiceTitle}>{p.label}</Text>
              <Text style={styles.practiceSub}>{p.sub}</Text>
            </Press>
          ))}
        </View>

        <Press onPress={() => router.push('/therapists')}>
          <Card style={styles.row}>
            <Ionicons name="people-outline" size={24} color={colors.ink} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Therapists near you</Text>
              <Text style={[styles.cardSub, { color: colors.inkSoft }]}>Share your location for local, affordable directories.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
          </Card>
        </Press>

        <Card style={{ gap: 10 }}>
          <Text style={styles.cardTitle}>In a crisis?</Text>
          <Text style={[styles.cardSub, { color: colors.inkSoft }]}>
            Free helplines are available around the clock. You don't have to figure this out alone.
          </Text>
          <CrisisButton variant="wide" label="See helplines" />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 22, paddingBottom: 40, gap: 12 },
  eyebrow: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft, marginTop: 8 },
  title: { fontFamily: fonts.heading, fontSize: 36, color: colors.ink, marginTop: -8, marginBottom: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.lg, padding: 18, minHeight: 88 },
  icon: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink },
  cardSub: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink, opacity: 0.85, marginTop: 2 },
  section: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  practice: { width: '48%', backgroundColor: '#fff', borderRadius: radius.md, padding: 16, gap: 4 },
  practiceTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, marginTop: 6 },
  practiceSub: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
