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

// Convert base64 string to Uint8Array
import { Buffer } from 'buffer';

function base64ToUint8Array(base64) {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

// Convert int16 PCM samples to float32 PCM (what whisper expects)
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
    try {
      const already = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (already) return true;
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      console.warn('[ASR] Permission check failed, assuming granted');
      return true;
    }
  }
  return true;
}

async function resolveModelPath(asset) {
  const { Asset } = await import('expo-asset');
  const [resolved] = await Asset.loadAsync(asset);
  return resolved.localUri || resolved.uri;
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

  // Load whisper model on mount
  useEffect(() => {
    let isMounted = true;
    async function loadModel() {
      try {
        const modelPath = await resolveModelPath(MODEL_ASSET);
        console.log('[ASR] Model path:', modelPath);
        const ctx = await initWhisper({ filePath: modelPath });
        if (isMounted) {
          whisperCtx.current = ctx;
          setModelStatus('ready');
          console.log('[ASR] Whisper model loaded successfully');
        }
      } catch (err) {
        console.error('[ASR] Model load error:', err);
        if (isMounted) {
          setModelStatus('error');
          setErrorMsg(err.message);
        }
      }
    }
    loadModel();
    return () => {
      isMounted = false;
      if (whisperCtx.current) whisperCtx.current.release();
    };
  }, []);

  // Pulse animation when recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
    }
  }, [isRecording, pulseAnim]);

  // ---- PRESS IN: Start raw PCM recording ----
  const handlePressIn = useCallback(async () => {
    Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true }).start();
    if (modelStatus !== 'ready' || !whisperCtx.current || isTranscribing) return;

    try {
      const hasMic = await requestMicPermission();
      if (!hasMic) {
        Alert.alert('Permission Denied', 'Microphone access is required.');
        return;
      }

      // Clear previous chunks
      audioChunks.current = [];

      // Init the native PCM audio stream: 16kHz mono 16-bit
      LiveAudioStream.init({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 1,
        bufferSize: 16384,
      });

      // Listen for raw PCM chunks (base64 encoded)
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

  // ---- PRESS OUT: Stop recording, convert PCM, transcribe ----
  const handlePressOut = useCallback(async () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    if (!isRecording) return;

    try {
      setIsRecording(false);
      setIsTranscribing(true);

      // Stop the native audio stream
      LiveAudioStream.stop();
      console.log('[ASR] PCM recording stopped, chunks:', audioChunks.current.length);

      if (audioChunks.current.length === 0) {
        setErrorMsg('No audio data captured.');
        setIsTranscribing(false);
        return;
      }

      // Decode all base64 chunks to Uint8Arrays
      const decoded = audioChunks.current.map(base64ToUint8Array);

      // Calculate total length
      let totalLen = 0;
      for (const chunk of decoded) totalLen += chunk.length;

      // Merge into single Uint8Array (raw int16 PCM)
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of decoded) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert int16 PCM to float32 PCM (whisper expects float32)
      const float32 = int16ToFloat32(merged);
      console.log('[ASR] Audio data ready:', float32.length, 'float32 samples (',
        (float32.length / 16000).toFixed(1), 'seconds)');

      const rms = Math.sqrt(
        float32.reduce((sum, x) => sum + x * x, 0) / float32.length
      );

      console.log('[ASR] Audio RMS:', rms.toFixed(6));
      console.log('[ASR] Audio peak:', Math.max(...float32.map(Math.abs)).toFixed(6));
      console.log('[ASR] First 20 samples:', Array.from(float32.slice(0, 20)));


      // Transcribe the raw float32 PCM data
      console.log('[ASR] Using model asset ID:', MODEL_ASSET);
      const { promise } = whisperCtx.current.transcribeData(float32.buffer, {
        language: 'mr',
        initialPrompt: 'नमस्कार',
        suppressNonSpeechTokens: true,
      });

      const result = await promise;
      console.log('[ASR] Transcription result:', result);
      setTranscription(result.result || '(no speech detected)');
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