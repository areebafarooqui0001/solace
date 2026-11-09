import React from 'react';
import { Platform, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth';
import { colors, fonts } from '../../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; iconOn: IconName }[] = [
  { name: 'home', title: 'Home', icon: 'leaf-outline', iconOn: 'leaf' },
  { name: 'chat', title: 'Sunny', icon: 'chatbubble-ellipses-outline', iconOn: 'chatbubble-ellipses' },
  { name: 'progress', title: 'Progress', icon: 'stats-chart-outline', iconOn: 'stats-chart' },
  { name: 'profile', title: 'You', icon: 'person-outline', iconOn: 'person' },
];

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();
  if (loading) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenListeners={{ tabPress: () => Haptics.selectionAsync().catch(() => {}) }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#AEA3BB',
        tabBarLabelStyle: { fontFamily: fonts.semi, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 0,
          height: 58 + Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8),
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          elevation: 12,
          shadowColor: '#3F7D5C',
          shadowOpacity: 0.12,
          shadowRadius: 14,
        },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? t.iconOn : t.icon} size={24} color={color as string} />,
          }}
        />
      ))}
    </Tabs>
  );
}
