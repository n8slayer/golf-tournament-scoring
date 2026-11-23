import { useLocalSearchParams } from 'expo-router';
import { ScoreEntry } from '../../../../../components/ScoreEntry';

export default function Score() {
  const { tripId, roundId } = useLocalSearchParams<{ tripId: string; roundId: string }>();
  return <ScoreEntry tripId={tripId} roundId={roundId} />;
}
