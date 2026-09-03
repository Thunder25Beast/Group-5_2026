import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

const MATH_PROBLEM = '12 + 8 = ?';

// ---- Marathi Dictionary (1-100) ----
const MARATHI_NUMBERS = [
    "एक", "दोन", "तीन", "चार", "पाच", "सहा", "सात", "आठ", "नऊ", "दहा",
    "अकरा", "बारा", "तेरा", "चौदा", "पंधरा", "सोळा", "सतरा", "अठरा", "एकोणीस", "वीस",
    "एकवीस", "बावीस", "तेवीस", "चोवीस", "पंचवीस", "सव्वीस", "सत्तावीस", "अठ्ठावीस", "एकोणतीस", "तीस",
    "एकतीस", "बत्तीस", "तेहतीस", "चौतीस", "पस्तीस", "छत्तीस", "सदतीस", "अडतीस", "एकोणचाळीस", "चाळीस",
    "एकेचाळीस", "बेचाळीस", "त्रेचाळीस", "चव्वेचाळीस", "पंचेचाळीस", "शेहेचाळीस", "सत्तेचाळीस", "अठ्ठेचाळीस", "एकोणपन्नास", "पन्नास",
    "एकावन्न", "बावन", "त्रेपन्न", "चोपन्न", "पंचावन्न", "छप्पन्न", "सत्तावन्न", "अठ्ठावन्न", "एकोणसाठ", "साठ",
    "एकसष्ट", "बासष्ट", "त्रेसष्ट", "चौसष्ट", "पासष्ट", "सहासष्ट", "सदुसष्ट", "अडुसष्ट", "एकोणसत्तर", "सत्तर",
    "एकाहत्तर", "बहात्तर", "त्र्याहत्तर", "चौऱ्याहत्तर", "पंच्याहत्तर", "शहात्तर", "सत्याहत्तर", "अठ्ठ्याहत्तर", "एकोणऐंशी", "ऐंशी",
    "एकाऐंशी", "ब्याऐंशी", "त्र्याऐंशी", "चौऱ्याऐंशी", "पंच्याऐंशी", "शहाऐंशी", "सत्याऐंशी", "अठ्ठ्याऐंशी", "एकोणनव्वद", "नव्वद",
    "एक्याण्णव", "ब्याण्णव", "त्र्याण्णव", "चौऱ्याण्णव", "पंचाण्णव", "शहाण्णव", "सत्याण्णव", "अठ्ठ्याण्णव", "नव्व्याण्णव", "शंभर"
];

// ---- Levenshtein Distance (Fuzzy Matcher) ----
function levenshteinDistance(s, t) {
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const arr = [];
  for (let i = 0; i <= t.length; i++) {
    arr[i] = [i];
    for (let j = 1; j <= s.length; j++) {
      arr[i][j] =
        i === 0
          ? j
          : Math.min(
              arr[i - 1][j] + 1,
              arr[i][j - 1] + 1,
              arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
            );
    }
  }
  return arr[t.length][s.length];
}

function getBestMatch(inputStr) {
  // If Google returns a pure number like "91", "56", etc., map it to the Marathi word!
  const numberValue = parseInt(inputStr.trim(), 10);
  if (!isNaN(numberValue) && numberValue >= 1 && numberValue <= 100) {
    return MARATHI_NUMBERS[numberValue - 1]; // e.g. 91 -> index 90
  }

  // Otherwise do the standard phonetic fuzzy matching
  const cleanInput = inputStr.replace(/[.,!?()\[\]{}"'*\-0-9A-Za-z]/g, '').trim();
  if (!cleanInput) return null;

  // Strip spaces
  const noSpaces = cleanInput.replace(/\s+/g, '');

  // Exact match?
  const exactIdx = MARATHI_NUMBERS.indexOf(noSpaces);
  if (exactIdx !== -1) return MARATHI_NUMBERS[exactIdx];

  let bestMatch = null;
  let minDistance = Infinity;

  for (const num of MARATHI_NUMBERS) {
    const dist = levenshteinDistance(noSpaces, num);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = num;
    }
  }

  // Also try individual words
  const words = cleanInput.split(/\s+/);
  for (const word of words) {
    for (const num of MARATHI_NUMBERS) {
      const dist = levenshteinDistance(word, num);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = num;
      }
    }
  }

  console.log('[ASR] Best fuzzy match:', bestMatch, 'distance:', minDistance);
  if (minDistance > 6) return null;
  return bestMatch;
}

export default function StandaloneASR() {
  const [isListening, setIsListening] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [rawTranscription, setRawTranscription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const pulseAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // ---- Expo Speech Recognition Events ----
  useSpeechRecognitionEvent('start', () => {
    console.log('[ASR] Google Speech started');
    setIsListening(true);
  });

  useSpeechRecognitionEvent('end', () => {
    console.log('[ASR] Google Speech ended');
    setIsListening(false);
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript || '';
    console.log('[ASR] Google result:', transcript);
    setRawTranscription(transcript);

    const match = getBestMatch(transcript);
    if (match) {
      setTranscription(match);
      console.log('[ASR] Matched:', match);
    } else {
      setTranscription(transcript);
      console.log('[ASR] No dictionary match, showing raw');
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.error('[ASR] Google error:', event.error, event.message);
    setErrorMsg(event.message || event.error || 'Speech error');
    setIsListening(false);
  });

  // ---- Pulse animation ----
  useEffect(() => {
    if (isListening) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [isListening, pulseAnim]);

  // ---- PRESS IN: Start listening ----
  const handlePressIn = useCallback(async () => {
    if (isListening) return;
    Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true }).start();

    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        setErrorMsg('Microphone permission denied');
        return;
      }

      setTranscription('');
      setRawTranscription('');
      setErrorMsg('');

      // Start Google's speech recognizer in MARATHI
      ExpoSpeechRecognitionModule.start({
        lang: 'mr-IN',
      });

      console.log('[ASR] Started listening (mr-IN)');
    } catch (err) {
      console.error('[ASR] Start error:', err);
      setErrorMsg(String(err));
    }
  }, [isListening, scaleAnim]);

  // ---- PRESS OUT: Stop listening ----
  const handlePressOut = useCallback(async () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    if (!isListening) return;

    try {
      ExpoSpeechRecognitionModule.stop();
      console.log('[ASR] Stopped listening');
    } catch (err) {
      console.error('[ASR] Stop error:', err);
    }
  }, [isListening, scaleAnim]);

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });

  const statusText =
    isListening
      ? 'Listening... Release to stop'
      : errorMsg
        ? 'Error: ' + errorMsg
        : 'Hold the button & speak in Marathi';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle='light-content' backgroundColor='#0D0D1A' />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AnkGuru ASR</Text>
          <Text style={styles.headerSubtitle}>Google Speech Recognition (Online)</Text>
        </View>

        <View style={styles.mathCard}>
          <Text style={styles.mathLabel}>Solve this:</Text>
          <Text style={styles.mathProblem}>{MATH_PROBLEM}</Text>
        </View>

        <View style={styles.statusRow}>
          {isListening && (
            <ActivityIndicator size='small' color='#4CAF50' style={{ marginRight: 8 }} />
          )}
          <Text style={[
            styles.statusText,
            errorMsg && styles.statusError,
            isListening && styles.statusRecording,
          ]}>
            {statusText}
          </Text>
        </View>

        <View style={styles.micContainer}>
          {isListening && (
            <Animated.View style={[styles.pulseRing, { opacity: pulseOpacity, transform: [{ scale: 1.35 }] }]} />
          )}
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={({ pressed }) => [
                styles.micButton,
                isListening && styles.micButtonRecording,
              ]}
            >
              <Text style={styles.micIcon}>{String.fromCodePoint(0x1F3A4)}</Text>
              <Text style={styles.micLabel}>
                {isListening ? 'Listening...' : 'Hold to Record'}
              </Text>
            </Pressable>
          </Animated.View>
        </View>

        <View style={styles.outputCard}>
          <Text style={styles.outputLabel}>Transcribed Number (1-100)</Text>
          <View style={styles.outputBox}>
            {transcription ? (
              <>
                <Text style={styles.outputText}>{transcription}</Text>
                {rawTranscription && rawTranscription !== transcription && (
                   <Text style={styles.rawTextOutput}>Google heard: {rawTranscription}</Text>
                )}
              </>
            ) : (
              <Text style={styles.outputPlaceholder}>Your spoken words will appear here...</Text>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0D0D1A' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 16, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 24 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1 },
  headerSubtitle: { fontSize: 13, color: '#8888AA', marginTop: 4, letterSpacing: 0.5 },
  mathCard: { width: '100%', backgroundColor: '#1A1A2E', borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#2A2A44', marginBottom: 20 },
  mathLabel: { fontSize: 14, color: '#7C5CFC', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  mathProblem: { fontSize: 48, fontWeight: '800', color: '#FFFFFF', letterSpacing: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 28, minHeight: 24 },
  statusText: { fontSize: 14, color: '#8888AA' },
  statusError: { color: '#FF4466' },
  statusRecording: { color: '#4CAF50', fontWeight: '600' },
  micContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 32, width: 180, height: 180 },
  pulseRing: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#4CAF50' },
  micButton: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#7C5CFC', alignItems: 'center', justifyContent: 'center', elevation: 12, shadowColor: '#7C5CFC', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16 },
  micButtonRecording: { backgroundColor: '#4CAF50', shadowColor: '#4CAF50' },
  micIcon: { fontSize: 52, marginBottom: 4 },
  micLabel: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.5 },
  outputCard: { width: '100%', flex: 1, marginBottom: 24 },
  outputLabel: { fontSize: 12, color: '#7C5CFC', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 },
  outputBox: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#2A2A44' },
  outputText: { fontSize: 32, color: '#FFFFFF', fontWeight: 'bold' },
  rawTextOutput: { fontSize: 12, color: '#8888AA', marginTop: 8, fontStyle: 'italic' },
  outputPlaceholder: { fontSize: 16, color: '#555577', fontStyle: 'italic' },
});
