import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAppStore } from '@/hooks/store';
import { Feather } from '@expo/vector-icons';

export default function LogsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { logs, clearLogs } = useAppStore();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 30), paddingBottom: insets.bottom + 100 },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Session Logs</Text>
          {logs.length > 0 && (
            <Pressable onPress={clearLogs} style={styles.clearBtn}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          )}
        </View>

        {logs.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color="#A1ADB4" />
            <Text style={styles.emptyText}>No logs yet. Start practicing!</Text>
          </View>
        ) : (
          logs.slice().reverse().map((log) => (
            <View key={log.id} style={styles.logCard}>
              <View style={styles.logHeader}>
                <Text style={styles.modeText}>{log.mode.toUpperCase()}</Text>
                <Text style={styles.timeText}>{new Date(log.timestamp).toLocaleTimeString()}</Text>
              </View>
              <Text style={styles.questionText}>{log.questionDisplay}</Text>
              <View style={styles.resultRow}>
                <Feather
                  name={log.isCorrect ? 'check-circle' : 'x-circle'}
                  size={20}
                  color={log.isCorrect ? '#48A995' : '#E95757'}
                />
                <Text style={[styles.resultText, { color: log.isCorrect ? '#48A995' : '#E95757' }]}>
                  {log.isCorrect ? 'Correct' : 'Incorrect'}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 22 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#17324D' },
  clearBtn: { backgroundColor: '#FFF0B8', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  clearText: { color: '#6B571B', fontWeight: '700' },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#A1ADB4', fontSize: 16, marginTop: 12, fontWeight: '600' },
  logCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 12, elevation: 2, shadowColor: '#17324D', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  modeText: { color: '#2477D4', fontWeight: '800', fontSize: 12, backgroundColor: '#E7F5FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' },
  timeText: { color: '#A1ADB4', fontSize: 12, fontWeight: '600' },
  questionText: { fontSize: 22, fontWeight: '800', color: '#17324D', marginVertical: 8 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultText: { fontWeight: '700', fontSize: 15 },
});
