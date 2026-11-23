import { ReactNode } from 'react';
import { View, Text, ImageBackground, Linking, StyleSheet } from 'react-native';
import { useCoursePhoto } from '../lib/coursePhoto';
import { colors } from '../lib/styles';

// Photo header: the course's own photo (Wikimedia Commons) when one exists, else the default.
export function CourseHero({ courseName, height = 220, children }: { courseName?: string; height?: number; children: ReactNode }) {
  const photo = useCoursePhoto(courseName);
  return (
    <View style={{ gap: 4 }}>
      <ImageBackground
        source={photo.source}
        resizeMode="cover"
        style={[st.frame, { minHeight: height }]}
        imageStyle={{ borderRadius: 16 }}
        accessibilityIgnoresInvertColors
      >
        {/* Darkens the photo so the white and gold text keeps its contrast. */}
        <View style={st.shade} />
        <View style={st.body}>{children}</View>
      </ImageBackground>
      {photo.credit && (
        <Text
          style={st.credit}
          numberOfLines={1}
          onPress={photo.href ? () => Linking.openURL(photo.href!) : undefined}
          accessibilityRole={photo.href ? 'link' : undefined}
        >
          {photo.credit}
        </Text>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  frame: { borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: colors.primary },
  shade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,22,38,0.5)' },
  body: { padding: 16, gap: 6 },
  credit: { color: colors.muted, fontSize: 11, textAlign: 'right' },
});
