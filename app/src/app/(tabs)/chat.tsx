import React, { useCallback, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Mascot } from '../../components/Mascot';
import { Button, Press, Screen } from '../../components/ui';
import { api, ConversationSummary, parseServerDate } from '../../api';
import { colors, fonts, radius } from '../../theme';

const when = (s: string) => {
  const d = parseServerDate(s);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 1) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days < 2) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

export default function ChatList() {
  const router = useRouter();
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await api.conversations()).conversations);
      setFailed(false);
    } catch {
      setFailed(true);
    }
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const remove = (c: ConversationSummary) =>
    Alert.alert('Delete conversation?', `"${c.title}" will be removed for good.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setItems((cur) => cur.filter((x) => x.id !== c.id));
          await api.deleteConversation(c.id).catch(load);
        },
      },
    ]);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Talk to Sunny</Text>
        <Text style={styles.sub}>Pick up where you left off, or start fresh.</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ padding: 20, paddingBottom: 120, gap: 10, flexGrow: 1 }}
        ListEmptyComponent={
          loaded ? (
            failed ? (
              <View style={styles.empty}>
                <Mascot mood="tired" size={130} />
                <Text style={styles.emptyTitle}>Can't reach Sunny right now</Text>
                <Text style={styles.emptySub}>Check your connection and try again. Your chats are safe.</Text>
                <Button title="Try again" variant="soft" onPress={load} style={{ marginTop: 10, alignSelf: 'stretch' }} />
              </View>
            ) : (
              <View style={styles.empty}>
                <Mascot mood="calm" size={140} />
                <Text style={styles.emptyTitle}>Nothing here yet</Text>
                <Text style={styles.emptySub}>Say hi to Sunny. Whatever is on your mind is welcome.</Text>
              </View>
            )
          ) : undefined
        }
        renderItem={({ item }) => (
          <Swipeable
            overshootRight={false}
            renderRightActions={() => (
              <Press onPress={() => remove(item)} style={styles.del}>
                <Ionicons name="trash-outline" size={22} color="#fff" />
              </Press>
            )}
          >
            <Press onPress={() => router.push(`/chat/${item.id}`)} style={styles.item}>
              <View style={styles.avatar}>
                <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.itemPreview} numberOfLines={1}>
                  {item.preview ?? 'No messages yet'}
                </Text>
              </View>
              <Text style={styles.time}>{when(item.updated_at)}</Text>
            </Press>
          </Swipeable>
        )}
      />

      <View style={styles.fab}>
        <Button title="New conversation" onPress={() => router.push('/chat/new')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 16 },
  title: { fontFamily: fonts.heading, fontSize: 30, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft, marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 14, borderRadius: radius.md },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  itemPreview: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  time: { fontFamily: fonts.body, fontSize: 12, color: '#A99FB6' },
  del: { backgroundColor: colors.danger, width: 72, marginLeft: 8, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 60, paddingHorizontal: 30 },
  emptyTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
  emptySub: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft, textAlign: 'center' },
  fab: { position: 'absolute', left: 24, right: 24, bottom: 16 },
});
