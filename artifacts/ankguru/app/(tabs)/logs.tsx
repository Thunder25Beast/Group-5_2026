import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

/**
 * Session logs have been removed in the stateless redesign.
 * Individual session results are now shown in the Session Summary
 * screen immediately after each practice session completes.
 */
export default function LogsTab() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 30 }]}>
      <Feather name="inbox" size={48} color="#A1ADB4" />
      <Text style={styles.title}>No Session Logs</Text>
      <Text style={styles.body}>
        This app is stateless. Your results are shown at the end of each
        session on the <Text style={styles.accent}>Summary</Text> screen.
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
