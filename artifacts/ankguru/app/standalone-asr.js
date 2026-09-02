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
const MODEL_ASSET = require('../assets/models/ggml-small.bin');

// ---- Helpers ----

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

/**
 * Save float32 PCM audio as a proper WAV file on-device.
 * Returns the file:// URI to the saved WAV.
 */
async function saveWavFile(float32Array, sampleRate) {
  const numSamples = float32Array.length;
  const wavBuffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  wavBuffer.write('RIFF', 0);
  wavBuffer.writeUInt32LE(36 + numSamples * 2, 4);
  wavBuffer.write('WAVE', 8);

  // fmt sub-chunk
  wavBuffer.write('fmt ', 12);
  wavBuffer.writeUInt32LE(16, 16);        // Sub-chunk1 size
  wavBuffer.writeUInt16LE(1, 20);         // PCM format
  wavBuffer.writeUInt16LE(1, 22);         // Mono channel
  wavBuffer.writeUInt32LE(sampleRate, 24); // Sample rate
  wavBuffer.writeUInt32LE(sampleRate * 2, 28); // Byte rate
  wavBuffer.writeUInt16LE(2, 32);         // Block align
  wavBuffer.writeUInt16LE(16, 34);        // Bits per sample

  // data sub-chunk
  wavBuffer.write('data', 36);
  wavBuffer.writeUInt32LE(numSamples * 2, 40);

  // Convert float32 -> int16 and write
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
      console.warn('[ASR] Permission check failed, assuming granted');
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
        audioSource: 1,   // MIC (raw microphone, no processing)
        bufferSize: 16384,
      });

      LiveAudioStream.on('data', (base64Data) => {
        audioChunks.current.push(base64Data);
      });

      LiveAudioStream.start();
      setIsRecording(true);
      setTranscription('');
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
        setErrorMsg('No audio data captured.');
        setIsTranscribing(false);
        return;
      }

      // Decode all base64 chunks to Uint8Arrays
      const decoded = audioChunks.current.map(base64ToUint8Array);

      // Merge into single buffer
      let totalLen = 0;
      for (const chunk of decoded) totalLen += chunk.length;
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of decoded) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert int16 PCM -> float32 PCM
      const float32 = int16ToFloat32(merged);
      const durationSec = (float32.length / 16000).toFixed(1);
      console.log('[ASR] Audio:', float32.length, 'samples,', durationSec, 'sec');

      // Audio level check
      const rms = Math.sqrt(float32.reduce((s, x) => s + x * x, 0) / float32.length);
      console.log('[ASR] RMS:', rms.toFixed(6));

      if (rms < 0.005) {
        console.warn('[ASR] Audio is essentially SILENCE (RMS < 0.005). Mic may not be working.');
        setErrorMsg('No speech detected. Please speak louder or check microphone.');
        setIsTranscribing(false);
        return;
      }

      // Save the audio as a proper WAV file on-device
      const wavPath = await saveWavFile(float32, 16000);
      console.log('[ASR] WAV saved:', wavPath);

      // CRITICAL FIX: Use transcribe(filePath) instead of transcribeData(buffer)
      // transcribe() lets the native C++ code read the file directly from disk,
      // completely bypassing the React Native JS<->Native bridge which corrupts
      // raw ArrayBuffer data.
      console.log('[ASR] Transcribing via file...');
      const { promise } = whisperCtx.current.transcribe(wavPath, {
        language: 'mr',
      });

      const result = await promise;
      console.log('[ASR] Transcription result:', JSON.stringify(result));
      setTranscription(result.result || '(no speech detected)');

      // Clean up the temp WAV file
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
      ? 'Loading Whisper model...'
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
          <Text style={styles.headerSubtitle}>On-Device Voice Recognition</Text>
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
          <Text style={styles.outputLabel}>Transcribed Text (Marathi)</Text>
          <View style={styles.outputBox}>
            {transcription ? (
              <Text style={styles.outputText}>{transcription}</Text>
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
  mathLabel: { fontSize: 14, color: '#7C5CFC', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1.5 },
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
  outputText: { fontSize: 22, color: '#FFFFFF', lineHeight: 34 },
  outputPlaceholder: { fontSize: 16, color: '#555577', fontStyle: 'italic' },
});


