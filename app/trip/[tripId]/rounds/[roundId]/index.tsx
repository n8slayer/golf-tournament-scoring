import { View, Text, Pressable } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { useTrips } from '../../../../../context/TripsContext';
import { s } from '../../../../../lib/styles';

export default function RoundHome() {
  const { tripId, roundId } = useLocalSearchParams<{ tripId: string; roundId: string }>();
  const { getTrip } = useTrips();
  const trip = getTrip(tripId);
  const round = trip?.rounds.find((r) => r.id === roundId);
  if (!trip || !round) return null;

  const base = `/trip/${tripId}/rounds/${roundId}`;
  const links = [
    { href: `${base}/score`, label: 'Enter Scores' },
    { href: `${base}/leaderboard`, label: 'Leaderboard' },
    ...(round.skinsEnabled ? [{ href: `${base}/skins`, label: 'Skins' }] : []),
    ...(round.matchEnabled ? [{ href: `${base}/match`, label: 'Match Play' }] : []),
  ];

  return (
    <View style={[s.screen, s.content]}>
      {links.map((item) => (
        <Link key={item.href} href={item.href} asChild>
          <Pressable style={s.card}>
            <Text style={s.title}>{item.label}</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}
