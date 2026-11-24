import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableLink } from './NavCard';
import { isTeamEvent } from '../lib/games';
import { s, colors, icon } from '../lib/styles';
import { Trip } from '../types/models';

// Organizer's next steps after the quick "New event" dialog. Hidden once everything is done.
export function SetupChecklist({ trip }: { trip: Trip }) {
  const base = `/trip/${trip.id}`;
  const ryder = isTeamEvent(trip);
  const steps = [
    {
      done: trip.courses.length > 0,
      title: 'Add a course',
      hint: 'Search for your course, or enter the scorecard',
      href: `${base}/course`,
    },
    { done: trip.players.length >= 2, title: 'Add players', hint: 'Names, handicaps and emails for invites', href: `${base}/players` },
    ...(ryder
      ? [
          {
            done: trip.players.length > 0 && trip.players.every((p) => p.teamId),
            title: 'Draft teams',
            hint: 'Put every player on a team',
            href: `${base}/draft`,
          },
        ]
      : []),
    {
      done: trip.rounds.length > 0,
      title: 'Set up the first round',
      hint: 'Course, players, skins and match bets',
      href: `${base}/rounds/new`,
    },
  ];
  if (steps.every((x) => x.done)) return null;
  const next = steps.findIndex((x) => !x.done);
  return (
    <View style={[s.card, { gap: 4 }]}>
      <Text style={s.label}>
        Set up your event · {steps.filter((x) => x.done).length}/{steps.length}
      </Text>
      {steps.map((x, i) => (
        <PressableLink key={x.title} href={x.href} style={st.row} label={`${x.title}${x.done ? ', done' : ''}`}>
          <Ionicons
            name={x.done ? 'checkmark-circle' : 'ellipse-outline'}
            size={icon.md}
            color={x.done ? colors.good : i === next ? colors.accent : colors.muted}
          />
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { fontSize: 16 }, x.done && { color: colors.muted, textDecorationLine: 'line-through' }]}>
              {x.title}
            </Text>
            {!x.done && <Text style={[s.subtitle, { fontSize: 13 }]}>{x.hint}</Text>}
          </View>
          <Ionicons name="chevron-forward" size={icon.sm} color={colors.muted} />
        </PressableLink>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 6 },
});
