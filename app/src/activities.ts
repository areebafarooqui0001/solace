import type React from 'react';
import type { Ionicons } from '@expo/vector-icons';

export const ACTIVITY_ROUTE: Record<string, { href: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  breathing: { href: '/breathe', label: 'Start breathing', icon: 'cloudy-outline' },
  affirmation: { href: '/activity/affirmation', label: 'See an affirmation', icon: 'sparkles-outline' },
  reflection: { href: '/activity/reflection', label: 'Try a reflection', icon: 'book-outline' },
  gratitude: { href: '/activity/gratitude', label: 'Name 3 good things', icon: 'heart-outline' },
  grounding: { href: '/activity/grounding', label: 'Ground yourself', icon: 'footsteps-outline' },
  walk: { href: '/activity/walk', label: 'Take a short walk', icon: 'walk-outline' },
  water: { href: '/activity/water', label: 'Have some water', icon: 'water-outline' },
  stretch: { href: '/activity/stretch', label: 'Gentle stretch', icon: 'body-outline' },
};
