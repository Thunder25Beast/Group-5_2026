import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

/**
 * The Configuration screen has been merged into the Practice tab's
 * first screen (ConfigScreen). This tab is kept for structural
 * compatibility with the tab navigator but redirects the user with
 * an info message.
 */
export default function ConfigTab() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 30 }]}>
      <Feather name="info" size={44} color="#A1ADB4" />
      <Text style={styles.title}>Configuration</Text>
      <Text style={styles.body}>
        Practice settings are now configured directly in the{' '}
        <Text style={styles.accent}>Practice</Text> tab before each session.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 24, fontWeight: '800', color: '#17324D', marginTop: 14, marginBottom: 10 },
  body: { fontSize: 16, color: '#5C6B76', textAlign: 'center', lineHeight: 24 },
  accent: { color: '#F6A64A', fontWeight: '800' },
});
