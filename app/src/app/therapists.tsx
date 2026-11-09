import React, { useState } from 'react';
import { KeyboardAvoidingView, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { BackRow } from '../components/bits';
import { CrisisButton } from '../components/Crisis';
import { Card, Field, Press, Screen } from '../components/ui';
import { colors, fonts, radius } from '../theme';

const DIRECTORIES = [
  { name: 'Practo', blurb: 'Book counsellors and psychologists across India, with reviews and fees.', url: 'https://www.practo.com/' },
  { name: 'Psychology Today', blurb: 'Largest directory, with filters for insurance, identity and specialty.', url: 'https://www.psychologytoday.com/us/therapists' },
  { name: 'Open Path Collective', blurb: 'Sliding-scale sessions for people without insurance (US).', url: 'https://openpathcollective.org/' },
];

export default function Therapists() {
  const router = useRouter();
  const [place, setPlace] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const useMyLocation = async () => {
    setNote('');
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return setNote('Location is off. You can type your city instead.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [g] = await Location.reverseGeocodeAsync(pos.coords).catch(() => []);
      const label = [g?.district || g?.city, g?.region].filter(Boolean).join(', ');
      setPlace(label || `${pos.coords.latitude.toFixed(3)},${pos.coords.longitude.toFixed(3)}`);
    } catch {
      setNote("Couldn't get your location. You can type your city instead.");
    } finally {
      setBusy(false);
    }
  };

  const openMap = () => {
    const q = encodeURIComponent(`therapist counsellor ${place.trim()}`.trim());
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <BackRow label="Resources" onPress={() => router.back()} />
          <Text style={styles.eyebrow}>Care & support</Text>
          <Text style={styles.title}>Therapists near you</Text>
          <Text style={styles.sub}>Share your location and we'll open local, affordable and trusted directories for where you are.</Text>

          <Card style={{ gap: 4 }}>
            <Field label="City, PIN code, or neighbourhood" value={place} onChangeText={setPlace} placeholder="e.g. Lucknow or 226001" autoCapitalize="words" />
            <Press onPress={useMyLocation} disabled={busy}>
              <LinearGradient colors={[colors.butter, colors.coral]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loc}>
                <Ionicons name="location-outline" size={18} color={colors.ink} />
                <Text style={styles.locText}>{busy ? 'Finding you...' : 'Use my current location'}</Text>
              </LinearGradient>
            </Press>
            {!!note && <Text style={styles.note}>{note}</Text>}
          </Card>

          <Press onPress={openMap}>
            <Card style={styles.row}>
              <Ionicons name="map-outline" size={24} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.dirName}>Search on the map</Text>
                <Text style={styles.dirBlurb}>{place.trim() ? `Therapists around ${place.trim()}` : 'Therapists near you'}</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.inkSoft} />
            </Card>
          </Press>

          <Text style={styles.section}>Directories</Text>
          {DIRECTORIES.map((d) => (
            <Press key={d.name} onPress={() => Linking.openURL(d.url).catch(() => {})}>
              <Card style={styles.row}>
                <View style={styles.icon}>
                  <Ionicons name="people-outline" size={22} color={colors.inkSoft} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dirName}>{d.name}</Text>
                  <Text style={styles.dirBlurb}>{d.blurb}</Text>
                </View>
                <Ionicons name="open-outline" size={18} color={colors.inkSoft} />
              </Card>
            </Press>
          ))}

          <Card style={{ gap: 10 }}>
            <Text style={styles.dirName}>Need someone right now?</Text>
            <CrisisButton variant="wide" label="See helplines" />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 22, paddingBottom: 40, gap: 12 },
  eyebrow: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft, marginTop: 8 },
  title: { fontFamily: fonts.heading, fontSize: 36, color: colors.ink, marginTop: -8 },
  sub: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  loc: { height: 54, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  locText: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  note: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft, textAlign: 'center', marginTop: 8 },
  section: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  dirName: { fontFamily: fonts.heading, fontSize: 19, color: colors.ink },
  dirBlurb: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.inkSoft, marginTop: 2 },
});
