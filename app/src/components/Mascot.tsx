import React, { useEffect, useState } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { Mood } from '../theme';

type Props = { mood?: Mood; size?: number; talking?: boolean };

const INK = '#33283F';

/** Sunny: a soft, floating companion whose face follows the user's mood. */
export function Mascot({ mood = 'calm', size = 160, talking = false }: Props) {
  const float = useSharedValue(0);
  const pulse = useSharedValue(1);
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 1900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1900, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
  }, [float]);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(talking ? 1.06 : 1.03, { duration: talking ? 420 : 2200, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: talking ? 420 : 2200, easing: Easing.inOut(Easing.quad) })
      ),
      -1
    );
  }, [talking, pulse]);

  useEffect(() => {
    let off: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setBlink(true);
      off = setTimeout(() => setBlink(false), 140);
    }, 3600);
    return () => {
      clearInterval(id);
      clearTimeout(off);
    };
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }, { scale: pulse.value }],
  }));

  const happy = mood === 'joyful';
  const sleepy = mood === 'tired';
  const closed = blink || sleepy;

  const eye = (cx: number) => {
    if (happy) return <Path d={`M${cx - 9} 104 Q${cx} 91 ${cx + 9} 104`} stroke={INK} strokeWidth={4.5} strokeLinecap="round" fill="none" />;
    if (closed) return <Path d={`M${cx - 9} 100 Q${cx} ${sleepy ? 108 : 104} ${cx + 9} 100`} stroke={INK} strokeWidth={4.5} strokeLinecap="round" fill="none" />;
    return (
      <>
        <Ellipse cx={cx} cy={100} rx={7} ry={mood === 'anxious' || mood === 'overwhelmed' ? 9.5 : 8.5} fill={INK} />
        <Circle cx={cx + 2.2} cy={97} r={2.4} fill="#fff" />
      </>
    );
  };

  const mouth = () => {
    const common = { stroke: INK, strokeWidth: 4.5, strokeLinecap: 'round' as const, fill: 'none' };
    switch (mood) {
      case 'joyful':
        return <Path d="M82 120 Q100 146 118 120 Z" fill={INK} stroke={INK} strokeWidth={3} strokeLinejoin="round" />;
      case 'calm':
        return <Path d="M86 124 Q100 135 114 124" {...common} />;
      case 'sad':
        return <Path d="M87 133 Q100 120 113 133" {...common} />;
      case 'anxious':
      case 'overwhelmed':
        return <Path d="M85 128 Q92.5 121 100 128 T115 128" {...common} />;
      case 'angry':
        return <Path d="M88 131 Q100 122 112 131" {...common} />;
      case 'tired':
        return <Path d="M92 128 Q100 131 108 128" {...common} />;
      default:
        return <Path d="M90 127 L110 127" {...common} />;
    }
  };

  const brows =
    mood === 'angry' ? (
      <>
        <Path d="M66 86 L88 92" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        <Path d="M134 86 L112 92" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      </>
    ) : mood === 'anxious' || mood === 'overwhelmed' || mood === 'sad' ? (
      <>
        <Path d="M68 90 L88 84" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
        <Path d="M132 90 L112 84" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
      </>
    ) : null;

  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#FBC9B0" stopOpacity={0.55} />
            <Stop offset="100%" stopColor="#FBC9B0" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="body" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#FFE3D2" />
            <Stop offset="55%" stopColor="#F9C4B0" />
            <Stop offset="100%" stopColor="#CDB9F2" />
          </LinearGradient>
        </Defs>
        <Circle cx={100} cy={108} r={96} fill="url(#glow)" />
        {/* little sprout */}
        <Path d="M100 44 Q98 28 104 20" stroke="#7DBB9C" strokeWidth={4} strokeLinecap="round" fill="none" />
        <Path d="M104 22 Q122 14 126 30 Q110 36 104 22 Z" fill="#A9D8BE" />
        <Ellipse cx={100} cy={108} rx={72} ry={66} fill="url(#body)" />
        <Ellipse cx={72} cy={82} rx={20} ry={11} fill="#fff" opacity={0.35} />
        <Circle cx={62} cy={118} r={9} fill="#F59E9E" opacity={0.45} />
        <Circle cx={138} cy={118} r={9} fill="#F59E9E" opacity={0.45} />
        {brows}
        {eye(78)}
        {eye(122)}
        {mouth()}
      </Svg>
    </Animated.View>
  );
}
