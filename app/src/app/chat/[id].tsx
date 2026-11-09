import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Mascot } from '../../components/Mascot';
import { Press, select, success } from '../../components/ui';
import { ACTIVITY_ROUTE } from '../../activities';
import { api, ChatMessage, Suggestion } from '../../api';
import { Mood, colors, fonts, radius } from '../../theme';

const STARTERS = ['I had a rough day', "I'm feeling anxious", "I can't sleep", 'I just want to talk'];

function SuggestionCard({ s }: { s: Suggestion }) {
  const router = useRouter();
  const a = ACTIVITY_ROUTE[s.kind];
  if (!a) return null;
  return (
    <Animated.View entering={FadeInDown.delay(250)} style={styles.suggest}>
      <Text style={styles.suggestWhy}>{s.why}</Text>
      <Press onPress={() => router.push(a.href as never)} style={styles.suggestBtn}>
        <Ionicons name={a.icon} size={18} color="#fff" />
        <Text style={styles.suggestBtnText}>{a.label}</Text>
      </Press>
    </Animated.View>
  );
}

export default function Chat() {
  const router = useRouter();
  const { id, seed } = useLocalSearchParams<{ id: string; seed?: string }>();
  const [convId, setConvId] = useState<number | null>(id && id !== 'new' ? Number(id) : null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [loading, setLoading] = useState(!!convId);
  const [error, setError] = useState('');
  const list = useRef<FlatList<ChatMessage>>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (!convId) return;
    api
      .messages(convId)
      .then((r) => setMessages(r.messages))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // only on first open of an existing conversation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || thinking) return;
      setError('');
      setText('');
      select();
      const optimistic: ChatMessage = { id: `u${Date.now()}`, role: 'user', content: trimmed };
      setMessages((m) => [...m, optimistic]);
      setThinking(true);
      try {
        let cid = convId;
        if (!cid) {
          cid = (await api.createConversation()).conversation.id;
          setConvId(cid);
        }
        const { message } = await api.sendMessage(cid, trimmed);
        setMessages((m) => [...m, message]);
        success();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Message failed to send');
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setText(trimmed);
      } finally {
        setThinking(false);
      }
    },
    [convId, thinking]
  );

  useEffect(() => {
    if (seed && !seeded.current && !convId) {
      seeded.current = true;
      send(seed);
    }
  }, [seed, convId, send]);

  useEffect(() => {
    const t = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [messages.length, thinking]);

  const lastMood = [...messages].reverse().find((m) => m.role === 'assistant')?.mood as Mood | undefined;

  return (
    <LinearGradient colors={['#FEF4D3', '#FFF8E4', '#FEF0CB']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <Press onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.ink} />
          </Press>
          <Mascot mood={lastMood ?? 'calm'} size={46} talking={thinking} />
          <View style={{ flex: 1 }}>
            <Text style={styles.hName}>Sunny</Text>
            <Text style={styles.hSub}>{thinking ? 'thinking...' : 'here with you'}</Text>
          </View>
        </View>

        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <FlatList
              ref={list}
              data={messages}
              keyExtractor={(m) => String(m.id)}
              contentContainerStyle={{ padding: 18, gap: 10, flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.center}>
                  <Mascot mood="joyful" size={130} />
                  <Text style={styles.emptyTitle}>What's on your mind?</Text>
                  <Text style={styles.emptySub}>Start anywhere. Sunny is listening.</Text>
                  <View style={styles.starters}>
                    {STARTERS.map((s) => (
                      <Press key={s} onPress={() => send(s)} style={styles.starter}>
                        <Text style={styles.starterText}>{s}</Text>
                      </Press>
                    ))}
                  </View>
                </View>
              }
              renderItem={({ item }) => (
                <Animated.View entering={FadeInDown.duration(300)} style={{ alignItems: item.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <View style={[styles.bubble, item.role === 'user' ? styles.user : styles.bot]}>
                    <Text style={[styles.msg, item.role === 'user' && { color: '#fff' }]}>{item.content}</Text>
                  </View>
                  {item.role === 'assistant' && item.suggestion ? <SuggestionCard s={item.suggestion} /> : null}
                </Animated.View>
              )}
              ListFooterComponent={
                thinking ? (
                  <View style={[styles.bubble, styles.bot, { alignSelf: 'flex-start', marginTop: 10 }]}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : undefined
              }
            />
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Write how you feel..."
              placeholderTextColor="#B5ABC0"
              style={styles.input}
              multiline
              maxLength={2000}
            />
            <Press onPress={() => send(text)} disabled={!text.trim() || thinking} style={[styles.send, (!text.trim() || thinking) && { opacity: 0.4 }]}>
              <Ionicons name="arrow-up" size={22} color="#fff" />
            </Press>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hName: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink },
  hSub: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink },
  emptySub: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft },
  starters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 },
  starter: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line },
  starterText: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink },
  bubble: { maxWidth: '84%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 22 },
  user: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  bot: { backgroundColor: '#fff', borderBottomLeftRadius: 6 },
  msg: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: colors.ink },
  suggest: { marginTop: 8, maxWidth: '84%', backgroundColor: colors.sageSoft, borderRadius: radius.md, padding: 14, gap: 10 },
  suggestWhy: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  suggestBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#5FA884', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill },
  suggestBtnText: { fontFamily: fonts.bold, color: '#fff', fontSize: 14 },
  error: { fontFamily: fonts.semi, color: colors.danger, textAlign: 'center', paddingHorizontal: 20, paddingBottom: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, paddingTop: 6 },
  input: { flex: 1, minHeight: 50, maxHeight: 120, backgroundColor: '#fff', borderRadius: 26, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  send: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
