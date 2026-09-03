import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, ActivityIndicator,
  Platform, PermissionsAndroid, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initWhisper } from 'whisper.rn';
import LiveAudioStream from '@fugood/react-native-audio-pcm-stream';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';

const MATH_PROBLEM = '12 + 8 = ?';

// THE FASTEST MODEL
const MODEL_ASSET = require('../assets/models/ggml-small.bin');

// ---- Phonetic Aliases (English Hallucinations -> Marathi) ----
const PHONETIC_ALIASES = {
  'bees': 'वीस',
  'beez': 'वीस',
  'viii': 'वीस',
  'bye': 'पाच',
  'punch': 'पाच',
  'dawn': 'दोन',
  'don': 'दोन',
  'done': 'दोन',
  'saha': 'सहा',
  'sat': 'सात',
  'aat': 'आठ',
  'art': 'आठ',
  'now': 'नऊ',
  'no': 'नऊ',
  'daha': 'दहा',
  'these': 'तीस',
  'piece': 'तीस',
  'chalis': 'चाळीस',
  'pannas': 'पन्नास',
  'shambar': 'शंभर',
  'chamber': 'शंभर',
  'nikki': 'एक',
  'kis baistai': 'एकवीस',
  'and take charity': 'चाळीस'
};

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
  const cleanInput = inputStr.replace(/[.,!?()[]{}"'*]/g, '').trim().toLowerCase();
  if (!cleanInput) return null;
  
  // 1. Check exact phonetic aliases first
  if (PHONETIC_ALIASES[cleanInput]) {
    return PHONETIC_ALIASES[cleanInput];
  }

  let bestMatch = null;
  let minDistance = Infinity;

  // 2. Fallback to fuzzy Levenshtein matching on the Marathi dictionary
  for (const num of MARATHI_NUMBERS) {
    const dist = levenshteinDistance(cleanInput, num);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = num;
    }
  }
  
  // Cutoff threshold (if distance > 4, it's probably not a number at all)
  if (minDistance > 4) {
      return null;
  }
  return bestMatch;
}

// ---- Audio Helpers ----

function base64ToUint8Array(base64) {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function int16ToFloat32(int16Data) {
  const int16View = new Int16Array(
    int16Data.buffer, int16Data.byteOffset, int16Data.byteLength / 2
  );
  const float32 = new Float32Array(int16View.length);
  for (let i = 0; i < int16View.length; i++) {
    float32[i] = int16View[i] / 32768.0;
  }
  return float32;
}

async function saveWavFile(float32Array, sampleRate) {
  const numSamples = float32Array.length;
  const wavBuffer = Buffer.alloc(44 + numSamples * 2);

  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(36 + numSamples * 2, 4);
  wavBuffer.write('WAVE', 8);
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16);
  wavBuffer.writeUInt16LE(1, 20);
  wavBuffer.writeUInt16LE(1, 22);
  wavBuffer.writeUInt32LE(sampleRate, 24);
  wavBuffer.writeUInt32LE(sampleRate * 2, 28);
  wavBuffer.writeUInt16LE(2, 32);
  wavBuffer.writeUInt16LE(16, 34);
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    wavBuffer.writeInt16LE(Math.round(val), 44 + i * 2);
  }

  const base64Wav = wavBuffer.toString('base64');
  const filePath = FileSystem.cacheDirectory + 'recording_' + Date.now() + '.wav';
  await FileSystem.writeAsStringAsync(filePath, base64Wav, {
    encoding: 'base64',
  });
  return filePath;
}

async function requestMicPermission() {
  if (Platform.OS === 'android') {
    try {
      const already = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (already) return true;
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      return true;
    }
  }
  return true;
}

export default function StandaloneASR() {
  const [modelStatus, setModelStatus] = useState('loading');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [rawTranscription, setRawTranscription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const whisperCtx = useRef(null);
  const audioChunks = useRef([]);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // ---- Load Whisper model on mount ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Asset } = require('expo-asset');
        const [asset] = await Asset.loadAsync(MODEL_ASSET);
        const modelPath = asset.localUri || asset.uri;
        console.log('[ASR] Model path:', modelPath);

        const ctx = await initWhisper({ filePath: modelPath });
        if (!cancelled) {
          whisperCtx.current = ctx;
          setModelStatus('ready');
          console.log('[ASR] Whisper model loaded successfully');
        }
      } catch (err) {
        console.error('[ASR] Model load error:', err);
        if (!cancelled) {
          setModelStatus('error');
          setErrorMsg(err.message || 'Failed to load model.');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ---- Pulse animation while recording ----
  useEffect(() => {
    if (isRecording) {
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
  }, [isRecording, pulseAnim]);

  // ---- PRESS IN: Start recording raw PCM ----
  const handlePressIn = useCallback(async () => {
    if (modelStatus !== 'ready' || isTranscribing) return;
    Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true }).start();

    try {
      const hasPerm = await requestMicPermission();
      if (!hasPerm) {
        Alert.alert('Permission Denied', 'Microphone access is required.');
        return;
      }

      audioChunks.current = [];

      LiveAudioStream.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 1,
        // REDUCED BUFFER SIZE: Captures chunks immediately (4096 = ~0.25 seconds) to prevent chunks: 0 error
        bufferSize: 4096,
      });

      LiveAudioStream.on('data', (base64Data) => {
        audioChunks.current.push(base64Data);
      });

      LiveAudioStream.start();
      setIsRecording(true);
      setTranscription('');
      setRawTranscription('');
      setErrorMsg('');
      console.log('[ASR] PCM recording started');
    } catch (err) {
      console.error('[ASR] Recording error:', err);
      Alert.alert('Recording Error', String(err));
    }
  }, [modelStatus, isTranscribing, scaleAnim]);

  // ---- PRESS OUT: Stop recording, save WAV, transcribe via FILE PATH ----
  const handlePressOut = useCallback(async () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    if (!isRecording) return;

    try {
      setIsRecording(false);
      setIsTranscribing(true);

      LiveAudioStream.stop();
      console.log('[ASR] PCM recording stopped, chunks:', audioChunks.current.length);

      if (audioChunks.current.length === 0) {
        setErrorMsg('No audio data captured. Try holding the button longer.');
        setIsTranscribing(false);
        return;
      }

      const decoded = audioChunks.current.map(base64ToUint8Array);
      let totalLen = 0;
      for (const chunk of decoded) totalLen += chunk.length;
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of decoded) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      let float32 = int16ToFloat32(merged);
      const rms = Math.sqrt(float32.reduce((s, x) => s + x * x, 0) / float32.length);
      
      if (rms < 0.005) {
        setErrorMsg('No speech detected. Please speak louder.');
        setIsTranscribing(false);
        return;
      }

      // -- AUDIO PADDING --
      // Even with English forced, Whisper likes having at least a little context. 
      // We inject 1.0 second of pure silence at the end to stabilize it.
      const SAMPLE_RATE = 16000;
      const SILENCE_SECONDS = 1.0;
      const silenceArray = new Float32Array(SAMPLE_RATE * SILENCE_SECONDS);
      
      const paddedFloat32 = new Float32Array(float32.length + silenceArray.length);
      paddedFloat32.set(float32, 0);
      paddedFloat32.set(silenceArray, float32.length);
      // -------------------------

      const wavPath = await saveWavFile(paddedFloat32, 16000);
      console.log('[ASR] Transcribing via file (Small 4T)...');
      
      const { promise } = whisperCtx.current.transcribe(wavPath, {
        // Marathi mode with aggressive number prompting
        language: 'mr',
        nThreads: 4,
      });

      const result = await promise;
      const rawText = result.result || '';
      console.log('[ASR] Raw result:', rawText);
      
      setRawTranscription(rawText);

      // Apply fuzzy matching & English aliases
      const finalMatch = getBestMatch(rawText);
      if (finalMatch) {
        setTranscription(finalMatch);
        console.log('[ASR] Fuzzy matched to:', finalMatch);
      } else {
        setTranscription('(Unrecognized: ' + rawText.trim() + ')');
        console.log('[ASR] Could not match to 1-100 dictionary');
      }

      try { await FileSystem.deleteAsync(wavPath, { idempotent: true }); } catch (_) {}

    } catch (err) {
      console.error('[ASR] Transcription error:', err);
      setErrorMsg(err.message || 'Transcription failed.');
    } finally {
      audioChunks.current = [];
      setIsTranscribing(false);
    }
  }, [isRecording, scaleAnim]);

  const buttonDisabled = modelStatus !== 'ready' || isTranscribing;
  const buttonScale = scaleAnim;
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });

  const statusText =
    modelStatus === 'loading'
      ? 'Loading Whisper model (Small + 4 Threads)...'
      : modelStatus === 'error'
        ? 'Error: ' + errorMsg
        : isRecording
          ? 'Recording... Release to transcribe'
          : isTranscribing
            ? 'Transcribing...'
            : 'Hold the button & speak in Marathi';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle='light-content' backgroundColor='#0D0D1A' />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AnkGuru ASR</Text>
          <Text style={styles.headerSubtitle}>Optimized Small Model</Text>
        </View>

        <View style={styles.mathCard}>
          <Text style={styles.mathLabel}>Solve this:</Text>
          <Text style={styles.mathProblem}>{MATH_PROBLEM}</Text>
        </View>

        <View style={styles.statusRow}>
          {(modelStatus === 'loading' || isTranscribing) && (
            <ActivityIndicator size='small' color='#7C5CFC' style={{ marginRight: 8 }} />
          )}
          <Text style={[
            styles.statusText,
            modelStatus === 'error' && styles.statusError,
            isRecording && styles.statusRecording,
          ]}>
            {statusText}
          </Text>
        </View>

        <View style={styles.micContainer}>
          {isRecording && (
            <Animated.View style={[styles.pulseRing, { opacity: pulseOpacity, transform: [{ scale: 1.35 }] }]} />
          )}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={buttonDisabled}
              style={({ pressed }) => [
                styles.micButton,
                isRecording && styles.micButtonRecording,
                buttonDisabled && !isRecording && styles.micButtonDisabled,
              ]}
            >
              <Text style={styles.micIcon}>{String.fromCodePoint(0x1F3A4)}</Text>
              <Text style={styles.micLabel}>
                {isRecording ? 'Recording...' : 'Hold to Record'}
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
                {rawTranscription && transcription !== '(Unrecognized: ' + rawTranscription.trim() + ')' && (
                   <Text style={styles.rawTextOutput}>Raw AI: {rawTranscription.trim()}</Text>
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
  statusRecording: { color: '#FF5555', fontWeight: '600' },
  micContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 32, width: 180, height: 180 },
  pulseRing: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#FF5555' },
  micButton: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#7C5CFC', alignItems: 'center', justifyContent: 'center', elevation: 12, shadowColor: '#7C5CFC', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16 },
  micButtonRecording: { backgroundColor: '#FF3355', shadowColor: '#FF3355' },
  micButtonDisabled: { backgroundColor: '#333355', shadowOpacity: 0, elevation: 0 },
  micIcon: { fontSize: 52, marginBottom: 4 },
  micLabel: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.5 },
  outputCard: { width: '100%', flex: 1, marginBottom: 24 },
  outputLabel: { fontSize: 12, color: '#7C5CFC', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10 },
  outputBox: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#2A2A44' },
  outputText: { fontSize: 32, color: '#FFFFFF', fontWeight: 'bold' },
  rawTextOutput: { fontSize: 12, color: '#8888AA', marginTop: 8, fontStyle: 'italic' },
  outputPlaceholder: { fontSize: 16, color: '#555577', fontStyle: 'italic' },
});



