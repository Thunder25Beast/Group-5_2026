import React from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAppStore } from '@/hooks/store';

export default function ConfigScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { config, updateConfig } = useAppStore();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 30), paddingBottom: insets.bottom + 100 },
        ]}
      >
        <Text style={styles.title}>Configuration</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Student Name</Text>
          <TextInput
            style={styles.input}
            value={config.studentName}
            onChangeText={(text) => updateConfig({ studentName: text })}
            placeholder="Enter student name"
            placeholderTextColor="#8A969E"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Difficulty</Text>
          <View style={styles.buttonRow}>
            {(['easy', 'medium', 'hard'] as const).map((diff) => (
              <Text
                key={diff}
                onPress={() => updateConfig({ difficulty: diff })}
                style={[
                  styles.diffButton,
                  config.difficulty === diff && styles.diffButtonActive,
                ]}
              >
                {diff.charAt(0).toUpperCase() + diff.slice(1)}
              </Text>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 22 },
  title: { fontSize: 28, fontWeight: '800', color: '#17324D', marginBottom: 20 },
  card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, marginBottom: 16, elevation: 2, shadowColor: '#17324D', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  label: { fontSize: 16, fontWeight: '700', color: '#5C6B76', marginBottom: 10 },
  input: { backgroundColor: '#F4F7FA', borderRadius: 12, padding: 15, fontSize: 16, color: '#17324D', fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: 10 },
  diffButton: { flex: 1, textAlign: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#F4F7FA', color: '#5C6B76', fontWeight: '700', overflow: 'hidden' },
  diffButtonActive: { backgroundColor: '#2477D4', color: '#FFFFFF' },
});
