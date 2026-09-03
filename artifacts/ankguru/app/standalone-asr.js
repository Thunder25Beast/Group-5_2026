import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, ActivityIndicator,
  Platform, PermissionsAndroid, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initWhisper } from 'whisper.rn';
import LiveAudioStream from '@fugood/react-native-audio-pcm-stream';

const MATH_PROBLEM = '12 + 8 = ?';
const MODEL_ASSET = require('../assets/models/ggml-base.bin');

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

// ---- Fuzzy Matcher ----
function levenshteinDistance(s, t) {
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const arr = [];
  for (let i = 0; i <= t.length; i++) {
    arr[i] = [i];
    for (let j = 1; j <= s.length; j++) {
      arr[i][j] = i === 0 ? j : Math.min(
        arr[i - 1][j] + 1,
        arr[i][j - 1] + 1,
        arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
      );
    }
  }
  return arr[t.length][s.length];
}

function getBestMatch(inputStr) {
  const numberValue = parseInt(inputStr.trim(), 10);
  if (!isNaN(numberValue) && numberValue >= 1 && numberValue <= 100) {
    return MARATHI_NUMBERS[numberValue - 1]; 
  }
  
  const cleanInput = inputStr.replace(/[.,!?()\[\]{}"'*\-0-9A-Za-z]/g, '').trim();
  if (!cleanInput) return null;
  const noSpaces = cleanInput.replace(/\s+/g, '');
  
  const exactIdx = MARATHI_NUMBERS.indexOf(noSpaces);
  if (exactIdx !== -1) return MARATHI_NUMBERS[exactIdx];
  
  let bestMatch = null;
  let minDistance = Infinity;
  for (const num of MARATHI_NUMBERS) {
    const dist = levenshteinDistance(noSpaces, num);
    if (dist < minDistance) { minDistance = dist; bestMatch = num; }
  }
  
  const words = cleanInput.split(/\s+/);
  for (const word of words) {
    for (const num of MARATHI_NUMBERS) {
      const dist = levenshteinDistance(word, num);
      if (dist < minDistance) { minDistance = dist; bestMatch = num; }
    }
  }
  
  console.log('[ASR] Best fuzzy match:', bestMatch, 'distance:', minDistance);
  if (minDistance > 6) return null;
  return bestMatch;
}

// Convert base64 to Uint8Array
function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Convert int16 PCM to float32
function int16ToFloat32(int16Data) {
  const int16View = new Int16Array(int16Data.buffer, int16Data.byteOffset, int16Data.byteLength / 2);
  const float32 = new Float32Array(int16View.length);
  for (let i = 0; i < int16View.length; i++) {
    float32[i] = int16View[i] / 32768.0;
  }
  return float32;
}

async function requestMicPermission() {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'AnkGuru needs microphone access for offline voice recognition.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

export default function StandaloneASR() {
  const [isReady, setIsReady] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [rawTranscription, setRawTranscription] = useState('');
  
  const whisperCtx = useRef(null);
  const pcmDataRef = useRef([]);
  
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    async function loadModel() {
      try {
        console.log('[ASR] Loading Base offline model...');
        whisperCtx.current = await initWhisper({ filePath: MODEL_ASSET });
        console.log('[ASR] Whisper Base loaded successfully');
        setIsReady(true);
      } catch (e) {
        console.error('[ASR] Model load error:', e);
      }
    }
    loadModel();
    return () => {
      if (whisperCtx.current) {
        whisperCtx.current.release();
      }
    };
  }, []);

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

  const handlePressIn = useCallback(async () => {
    if (!isReady || isListening || isTranscribing) return;
    Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true }).start();

    const hasPermission = await requestMicPermission();
    if (!hasPermission) return;

    setTranscription('');
    setRawTranscription('');
    pcmDataRef.current = [];
    setIsListening(true);

    try {
      LiveAudioStream.init({ sampleRate: 16000, channels: 1, bitsPerSample: 16, bufferSize: 2048 });
      LiveAudioStream.on('data', (data) => {
        const chunk = base64ToUint8Array(data);
        pcmDataRef.current.push(chunk);
      });
      LiveAudioStream.start();
      console.log('[ASR] Offline PCM recording started');
    } catch (e) {
      console.error('[ASR] Stream start error:', e);
      setIsListening(false);
    }
  }, [isReady, isListening, isTranscribing, scaleAnim]);

  const handlePressOut = useCallback(async () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    if (!isListening) return;

    try {
      LiveAudioStream.stop();
      setIsListening(false);
      setIsTranscribing(true);
      console.log('[ASR] PCM recording stopped, chunks:', pcmDataRef.current.length);

      const totalLength = pcmDataRef.current.reduce((acc, chunk) => acc + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of pcmDataRef.current) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      const float32 = int16ToFloat32(combined);
      // Whisper hallucinates on < 2 seconds of audio. Inject 1.5 seconds of pure silence.
      const SILENCE_SECONDS = 1.5;
      const silenceArray = new Float32Array(16000 * SILENCE_SECONDS);
      const paddedFloat32 = new Float32Array(float32.length + silenceArray.length);
      paddedFloat32.set(float32, 0);
      paddedFloat32.set(silenceArray, float32.length);
      
      console.log('[ASR] Transcribing offline with Base model...');
      
      // EXPLICITLY FORCE MARATHI LANGUAGE
      const { promise } = whisperCtx.current.transcribeData(paddedFloat32.buffer, {
        language: 'mr',
        maxLen: 1, // Keep output extremely short for numbers
        tokenTimestamps: false,
      });

      const res = await promise;
      const raw = res.result || '';
      console.log('[ASR] Whisper raw result:', raw);
      setRawTranscription(raw);
      
      const match = getBestMatch(raw);
      if (match) {
        setTranscription(match);
        console.log('[ASR] Match found:', match);
      } else {
        setTranscription(raw);
        console.log('[ASR] No dictionary match');
      }
    } catch (e) {
      console.error('[ASR] Transcribe error:', e);
    } finally {
      setIsTranscribing(false);
    }
  }, [isListening, scaleAnim]);

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });

  const statusText = !isReady
    ? 'Loading offline AI model...'
    : isTranscribing
      ? 'Transcribing locally...'
      : isListening
        ? 'Listening... Release to stop'
        : 'Hold to speak (100% Offline Whisper)';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle='light-content' backgroundColor='#0D0D1A' />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AnkGuru ASR</Text>
          <Text style={styles.headerSubtitle}>True Offline Marathi AI (Tiny)</Text>
        </View>

        <View style={styles.mathCard}>
          <Text style={styles.mathLabel}>Solve this:</Text>
          <Text style={styles.mathProblem}>{MATH_PROBLEM}</Text>
        </View>

        <View style={styles.statusRow}>
          {(isListening || isTranscribing || !isReady) && (
            <ActivityIndicator size='small' color='#4CAF50' style={{ marginRight: 8 }} />
          )}
          <Text style={[styles.statusText, isListening && styles.statusRecording]}>
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
              disabled={!isReady || isTranscribing}
              style={({ pressed }) => [
                styles.micButton,
                isListening && styles.micButtonRecording,
                (!isReady || isTranscribing) && styles.micButtonDisabled,
              ]}
            >
              <Text style={styles.micIcon}>{String.fromCodePoint(0x1F3A4)}</Text>
              <Text style={styles.micLabel}>
                {isListening ? 'Listening...' : isTranscribing ? 'Processing...' : 'Hold to Record'}
              </Text>
            </Pressable>
          </Animated.View>
        </View>

        <View style={styles.outputCard}>
          <Text style={styles.outputLabel}>Transcribed Number</Text>
          <View style={styles.outputBox}>
            {transcription ? (
              <>
                <Text style={styles.outputText}>{transcription}</Text>
                {rawTranscription && rawTranscription !== transcription && (
                   <Text style={styles.rawTextOutput}>AI heard: {rawTranscription}</Text>
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
  statusRecording: { color: '#4CAF50', fontWeight: '600' },
  micContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 32, width: 180, height: 180 },
  pulseRing: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#4CAF50' },
  micButton: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#7C5CFC', alignItems: 'center', justifyContent: 'center', elevation: 12, shadowColor: '#7C5CFC', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16 },
  micButtonRecording: { backgroundColor: '#4CAF50', shadowColor: '#4CAF50' },
  micButtonDisabled: { backgroundColor: '#333344', shadowOpacity: 0 },
  micIcon: { fontSize: 52, marginBottom: 4 },
  micLabel: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.5 },
  outputCard: { width: '100%', flex: 1, marginBottom: 24 },
  outputLabel: { fontSize: 12, color: '#7C5CFC', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 },
  outputBox: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#2A2A44' },
  outputText: { fontSize: 32, color: '#FFFFFF', fontWeight: 'bold' },
  rawTextOutput: { fontSize: 12, color: '#8888AA', marginTop: 8, fontStyle: 'italic' },
  outputPlaceholder: { fontSize: 16, color: '#555577', fontStyle: 'italic' },
});
