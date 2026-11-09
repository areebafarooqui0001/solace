import { colors } from './theme';

// ---------------------------------------------------------------------------
// Self check-ins: gentle 4-question screenings inspired by common wellness
// questionnaires. They are snapshots, never diagnoses, and carry no item about
// self-harm. Each answer is scored 0-3.
// ---------------------------------------------------------------------------

export type AssessmentType = 'mood' | 'anxiety' | 'selflove';

type Move = { t: string; d: string };

export const ASSESSMENTS: Record<
  AssessmentType,
  {
    title: string;
    blurb: string;
    intro: string;
    questions: string[];
    options: string[];
    /** true when a higher score means doing better (self-love) */
    positive: boolean;
    color: string;
    soft: string;
    /** result titles, ordered from "doing well" to "needs the most care" */
    bands: [string, string, string, string];
    moves: [{ heading: string; items: Move[] }, { heading: string; items: Move[] }];
  }
> = {
  mood: {
    title: 'Mood vibes',
    blurb: 'A gentle 4-question mood check.',
    intro: 'Over the past 2 weeks...',
    questions: [
      'Little interest or pleasure in doing things',
      'Feeling down or hopeless',
      'Trouble sleeping, or sleeping too much',
      'Feeling tired or low on energy',
    ],
    options: ['Not at all', 'A little', 'Often', 'Nearly always'],
    positive: false,
    color: colors.mint,
    soft: colors.mintSoft,
    bands: ['Vibes are bright', 'A few clouds', 'Heavy-ish skies', 'It has been really heavy'],
    moves: [
      {
        heading: 'Keep the momentum gentle.',
        items: [
          { t: 'Bank a win', d: 'Name one small thing that went well today and savor it for 30 seconds.' },
          { t: 'Move a little', d: 'A 10-minute walk or stretch keeps the mood lifted.' },
          { t: 'Share the light', d: 'Send a kind text to someone you care about.' },
        ],
      },
      {
        heading: 'Be gentle with today.',
        items: [
          { t: 'Start tiny', d: 'Pick one 2-minute task and do only that. It counts.' },
          { t: 'Get some daylight', d: 'Step outside for five minutes, ideally within an hour of waking.' },
          { t: 'Tell one person', d: 'Message someone you trust. You do not have to explain everything.' },
        ],
      },
    ],
  },
  anxiety: {
    title: 'Anxiety check',
    blurb: 'A 4-question scan of worry and tension.',
    intro: 'Over the past 2 weeks...',
    questions: [
      'Feeling nervous, anxious or on edge',
      'Not being able to stop or control worrying',
      'Worrying too much about different things',
      'Trouble relaxing',
    ],
    options: ['Not at all', 'A little', 'Often', 'Nearly always'],
    positive: false,
    color: colors.coral,
    soft: colors.coralSoft,
    bands: ['Calm waters', 'A little buzzy', 'Quite wound up', 'Running on high alert'],
    moves: [
      {
        heading: 'Maintain the steady.',
        items: [
          { t: 'Notice 3 things', d: 'Pause and name 3 things you can see, hear and feel. Anchor the calm.' },
          { t: 'Protect your sleep', d: 'Keep the same wake time tomorrow. Sleep is anxiety\'s quietest medicine.' },
          { t: 'Caffeine check', d: 'Cap it before noon to keep this baseline.' },
        ],
      },
      {
        heading: 'Slow the body first.',
        items: [
          { t: 'Long exhales', d: 'Breathe in for 4, out for 6, for one minute. Try the Breathe reset.' },
          { t: 'Name the worry', d: 'Write it in one sentence, then one thing about it that you can control.' },
          { t: 'Lower the load', d: 'Pick one thing to postpone until tomorrow. Done is not required today.' },
        ],
      },
    ],
  },
  selflove: {
    title: 'Self-love meter',
    blurb: "How you're talking to yourself this week.",
    intro: 'This past week...',
    questions: [
      'I was kind to myself when I made a mistake',
      'I let myself rest without guilt',
      'I noticed things I did well',
      'I treated myself like I would a good friend',
    ],
    options: ['Not at all', 'A little', 'Often', 'Nearly always'],
    positive: true,
    color: colors.peri,
    soft: colors.periSoft,
    bands: ['Glowing with self-love', 'Growing kinder', 'Your inner critic is loud', 'Be extra gentle with yourself'],
    moves: [
      {
        heading: 'Keep nurturing it.',
        items: [
          { t: 'Say it out loud', d: 'Tell yourself one thing you did well today.' },
          { t: 'Protect your rest', d: 'Rest without earning it first.' },
          { t: 'Pass it on', d: 'Give someone a genuine compliment today.' },
        ],
      },
      {
        heading: 'Soften the inner voice.',
        items: [
          { t: 'Be your own friend', d: 'When you slip, ask what you would say to a friend. Say that to yourself.' },
          { t: 'Catch the harsh line', d: 'Notice one "I always fail" thought today and call it what it is: a thought.' },
          { t: 'Three tiny wins', d: 'Tonight, write down three small things you did. Showing up counts.' },
        ],
      },
    ],
  },
};

export const ASSESSMENT_ORDER: AssessmentType[] = ['mood', 'anxiety', 'selflove'];

/** Maps a 0-12 score to a band index: 0 = doing well ... 3 = needs the most care. */
export function bandFor(type: AssessmentType, score: number) {
  const need = ASSESSMENTS[type].positive ? 12 - score : score;
  const index = need <= 2 ? 0 : need <= 5 ? 1 : need <= 8 ? 2 : 3;
  return { index, title: ASSESSMENTS[type].bands[index], needsCare: index >= 2 };
}

// ---------------------------------------------------------------------------
// Resources: short guides where each step is tapped as you try it.
// ---------------------------------------------------------------------------

export type Resource = {
  id: string;
  title: string;
  sub: string;
  eyebrow: string;
  desc: string;
  icon: 'leaf-outline' | 'flash-outline' | 'moon-outline' | 'heart-outline' | 'bed-outline';
  color: string;
  steps: Move[];
  talkPrompt?: string;
};

export const RESOURCES: Resource[] = [
  {
    id: 'mindfulness',
    title: 'Mindfulness 101',
    sub: '5-min guided practices for being here now.',
    eyebrow: 'BEING HERE NOW',
    desc: 'You do not need to empty your mind. Just notice where it already is.',
    icon: 'leaf-outline',
    color: colors.mint,
    steps: [
      { t: 'Feel your feet', d: 'Press both feet into the floor. Notice weight, temperature and texture for 30 seconds.' },
      { t: 'Follow 5 breaths', d: 'Count each exhale from 1 to 5. If you lose count, gently start again.' },
      { t: 'Sip slowly', d: 'Drink water or tea slowly. Notice the warmth, the taste, the swallow.' },
      { t: 'Label what you notice', d: 'Silently say "thinking", "feeling" or "sensing". Naming creates a little distance.' },
    ],
  },
  {
    id: 'anxiety',
    title: 'Anxiety toolkit',
    sub: 'Grounding, 4-7-8 breathing, thought reframes.',
    eyebrow: "WHEN YOUR BRAIN WON'T CHILL",
    desc: 'Anxiety is your body in protect mode. Slow the body and the mind follows.',
    icon: 'flash-outline',
    color: colors.violet,
    talkPrompt: "I'm feeling anxious and spiralling a bit.",
    steps: [
      { t: '5-4-3-2-1', d: 'Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste. It pulls you out of the spiral.' },
      { t: '4-7-8 breath', d: 'Inhale 4, hold 7, exhale 8. Do it 4 times. Long exhales are a calm switch.' },
      { t: 'Name the thought', d: 'Say "I\'m having the thought that..." instead of "I am...". It creates space between you and the worry.' },
      { t: 'Loosen your body', d: 'Clench your fists and shoulders for 5 seconds, then let go. Repeat three times.' },
    ],
  },
  {
    id: 'blues',
    title: 'Beating the blues',
    sub: 'Tiny actions for low days that actually help.',
    eyebrow: 'FOR THE HEAVY DAYS',
    desc: "Low days aren't lazy days. Skip the motivation and start tiny.",
    icon: 'moon-outline',
    color: colors.peri,
    talkPrompt: "I'm having a low, heavy day.",
    steps: [
      { t: 'The 2-minute win', d: 'Pick one task so small it feels silly. Make the bed. Brush your teeth. That is the seed.' },
      { t: 'Sunlight, 5 min', d: 'Step outside within an hour of waking. It lifts mood more than you would expect.' },
      { t: 'Move one song', d: 'Dance, walk or stretch for the length of one song. It does not need to be a workout.' },
      { t: 'Reach out once', d: 'Send one "thinking of you" message. You do not need a reply.' },
    ],
  },
  {
    id: 'selfesteem',
    title: 'Self-esteem reset',
    sub: 'Rewire the inner critic with kinder scripts.',
    eyebrow: 'REWIRE THE INNER CRITIC',
    desc: "Your inner critic isn't telling the truth, just loudly. You can train a kinder voice.",
    icon: 'heart-outline',
    color: colors.coral,
    steps: [
      { t: 'Be your own friend', d: 'Messed up? Ask what you would say to your best friend right now. Say that to yourself.' },
      { t: 'Catch the harsh words', d: 'Watch for "I always fail", "they hate me", "this ruins everything". Naming them loosens their grip.' },
      { t: '3 tiny wins', d: 'Each night write 3 things you did. "Got up. Showered. Replied." It is proof you are showing up.' },
      { t: 'Borrow a kinder voice', d: 'Think of someone who believes in you. What would they say about today?' },
    ],
  },
  {
    id: 'sleep',
    title: 'Sleep wind-down',
    sub: 'Body scans and journaling prompts for rest.',
    eyebrow: 'EASE INTO REST',
    desc: 'Sleep is built in the hour before bed. Make that hour soft.',
    icon: 'bed-outline',
    color: colors.butter,
    steps: [
      { t: 'Dim and disconnect', d: 'Lower the lights and put your phone away from the bed 30 minutes before sleep.' },
      { t: 'Scan from toes to head', d: 'Slowly relax each body part, starting at your toes. Spend a few breaths on each.' },
      { t: 'Empty your head', d: "Write tomorrow's worries and to-dos on paper, then close the notebook. They are safe there." },
      { t: 'Same wake time', d: 'Pick a wake-up time you can keep every day. Consistency beats catching up.' },
    ],
  },
];

export const PRACTICES = [
  { label: 'Daily reflection', sub: 'One question', href: '/activity/reflection', icon: 'book-outline' },
  { label: 'Three good things', sub: 'Gratitude', href: '/activity/gratitude', icon: 'sunny-outline' },
  { label: 'Ground yourself', sub: '5 senses', href: '/activity/grounding', icon: 'footsteps-outline' },
  { label: "Today's affirmation", sub: 'A kind thought', href: '/activity/affirmation', icon: 'sparkles-outline' },
] as const;

export const GOALS = ['Feel calmer', 'Sleep better', 'Manage stress', 'Build habits', 'Understand my moods', 'Feel less alone'];
export const FEELINGS = ['Pretty good', 'Up and down', 'Stressed', 'Low', 'Not sure'];
