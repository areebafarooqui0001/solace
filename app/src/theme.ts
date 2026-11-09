export const colors = {
  bg: '#FEF4D3',
  card: '#FFFFFF',
  ink: '#17382B',
  inkSoft: '#5B7266',
  line: '#F0E4B5',

  primary: '#3F7D5C',
  primarySoft: '#E1F1E7',
  primaryLight: '#B5D9C4',

  mint: '#9AD3B6',
  mintSoft: '#DDF0E4',
  coral: '#FF9E85',
  coralSoft: '#FFE4DA',
  butter: '#FFD66E',
  butterSoft: '#FFF0BE',
  violet: '#CBBBEA',
  violetSoft: '#EEE8FA',
  peri: '#CCD6FF',
  periSoft: '#E8EDFF',

  peach: '#FFC6A8',
  peachSoft: '#FFE9DD',
  sage: '#9AD3B6',
  sageSoft: '#DDF0E4',
  sky: '#BFE3F0',
  skySoft: '#E4F4FA',
  danger: '#D9534F',
};

export const fonts = {
  heading: 'Fraunces_600SemiBold',
  body: 'Nunito_400Regular',
  semi: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
};

export const radius = { sm: 12, md: 20, lg: 28, pill: 999 };

export type Mood =
  | 'joyful'
  | 'calm'
  | 'neutral'
  | 'anxious'
  | 'sad'
  | 'angry'
  | 'overwhelmed'
  | 'tired';

export const CHECKIN_MOODS: { score: number; label: string; emoji: string; mood: Mood }[] = [
  { score: 1, label: 'Rough', emoji: '😞', mood: 'sad' },
  { score: 2, label: 'Low', emoji: '😕', mood: 'tired' },
  { score: 3, label: 'Okay', emoji: '😐', mood: 'neutral' },
  { score: 4, label: 'Good', emoji: '🙂', mood: 'calm' },
  { score: 5, label: 'Great', emoji: '😄', mood: 'joyful' },
];

export const moodFromScore = (score: number): Mood =>
  CHECKIN_MOODS.find((m) => m.score === score)?.mood ?? 'neutral';

export const MOOD_TAGS = ['Work', 'Studies', 'Family', 'Friends', 'Sleep', 'Health', 'Money', 'Alone time'];
