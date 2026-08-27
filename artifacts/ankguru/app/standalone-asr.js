import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { initWhisper } from 'whisper.rn';

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
const MATH_PROBLEM = '12 + 8 = ?';

// Model asset — will be resolved to a local file path at runtime.
// The user must place `ggml-tiny.bin` in `assets/models/` before building.
const MODEL_ASSET = require('../assets/models/ggml-tiny.bin');

// Expo-AV recording preset: 16 kHz, mono, 16-bit PCM WAV
// (matches whisper.cpp input requirements exactly)
const RECORDING_OPTIONS = {
  isMeteringEnabled: false,
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.MAX,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Request RECORD_AUDIO permission on Android */
async function requestMicPermission() {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'AnkGuru needs microphone access for voice recognition.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true; // iOS handled via Info.plist
}

/**
 * Resolve a `require()`-ed asset to an absolute file:// URI.
 * On Android, expo-av & whisper.rn need a real filesystem path.
 * Metro bundles assets differently per platform.
 */
async function resolveModelPath(asset) {
  // In dev mode, `asset` from require() returns a number (Metro asset ID).
  // In production, it is the resolved URI.
  // We use expo-asset to resolve the actual path.
  const { Asset } = await import('expo-asset');
  const [resolved] = await Asset.loadAsync(asset);
  return resolved.localUri || resolved.uri;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────
export default function StandaloneASR() {
  // ── State ──
  const [modelStatus, setModelStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // ── Refs ──
  const whisperCtx = useRef(null);
  const recordingRef = useRef(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // ── Load Whisper model on mount ──
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setModelStatus('loading');

        // 1. Request mic permission early
        const hasMic = await requestMicPermission();
        if (!hasMic) {
          setModelStatus('error');
          setErrorMsg('Microphone permission denied.');
          return;
        }

        // 2. Set audio mode for recording
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        // 3. Resolve model path from bundled asset
        const modelPath = await resolveModelPath(MODEL_ASSET);
        console.log('[ASR] Model path:', modelPath);

        if (cancelled) return;

        // 4. Initialize whisper.rn context
        const ctx = await initWhisper({ filePath: modelPath });
        if (cancelled) {
          ctx.release();
          return;
        }

        whisperCtx.current = ctx;
        setModelStatus('ready');
        console.log('[ASR] Whisper model loaded successfully');
      } catch (err) {
        console.error('[ASR] Model load error:', err);
        if (!cancelled) {
          setModelStatus('error');
          setErrorMsg(err.message || 'Failed to load Whisper model.');
        }
      }
    })();

    return () => {
      cancelled = true;
      whisperCtx.current?.release();
    };
  }, []);

  // ── Pulse animation for recording state ──
  useEffect(() => {
    if (isRecording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [isRecording, pulseAnim]);

  // ── Start recording ──
  const handlePressIn = useCallback(async () => {
    if (modelStatus !== 'ready' || isTranscribing) return;

    try {
      // Animate button press
      Animated.spring(scaleAnim, {
        toValue: 0.88,
        useNativeDriver: true,
      }).start();

      // Start recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.startAsync();

      recordingRef.current = recording;
      setIsRecording(true);
      setTranscription(''); // Clear previous result
      console.log('[ASR] Recording started');
    } catch (err) {
      console.error('[ASR] Recording error:', err);
      Alert.alert('Recording Error', err.message);
    }
  }, [modelStatus, isTranscribing, scaleAnim]);

  // ── Stop recording & transcribe ──
  const handlePressOut = useCallback(async () => {
    // Animate button release
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    if (!recordingRef.current) return;

    try {
      setIsRecording(false);
      setIsTranscribing(true);

      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      console.log('[ASR] Recording stopped, file:', uri);

      if (!uri) {
        setErrorMsg('No audio file recorded.');
        setIsTranscribing(false);
        return;
      }

      // Transcribe with Whisper
      const { promise } = whisperCtx.current.transcribe(uri, {
        language: 'mr', // Marathi
        maxLen: 1,
        tokenTimestamps: false,
      });

      const { result } = await promise;
      console.log('[ASR] Transcription result:', result);
      setTranscription(result || '(no speech detected)');
    } catch (err) {
      console.error('[ASR] Transcription error:', err);
      setErrorMsg(err.message || 'Transcription failed.');
    } finally {
      setIsTranscribing(false);
    }
  }, [scaleAnim]);

  // ── Derived UI state ──
  const buttonDisabled = modelStatus !== 'ready' || isTranscribing;
  const buttonScale = scaleAnim;
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.35],
  });

  const statusText =
    modelStatus === 'loading'
      ? 'Loading Whisper model…'
      : modelStatus === 'error'
        ? `Error: ${errorMsg}`
        : isRecording
          ? '🔴  Recording… Release to transcribe'
          : isTranscribing
            ? 'Transcribing…'
            : 'Hold the button & speak in Marathi';

  // ── Render ──
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D1A" />
      <View style={styles.container}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>AnkGuru ASR</Text>
          <Text style={styles.headerSubtitle}>On-Device Voice Recognition</Text>
        </View>

        {/* ── Math Problem Card ── */}
        <View style={styles.mathCard}>
          <Text style={styles.mathLabel}>Solve this:</Text>
          <Text style={styles.mathProblem}>{MATH_PROBLEM}</Text>
        </View>

        {/* ── Status ── */}
        <View style={styles.statusRow}>
          {(modelStatus === 'loading' || isTranscribing) && (
            <ActivityIndicator
              size="small"
              color="#7C5CFC"
              style={{ marginRight: 8 }}
            />
          )}
          <Text
            style={[
              styles.statusText,
              modelStatus === 'error' && styles.statusError,
              isRecording && styles.statusRecording,
            ]}
          >
            {statusText}
          </Text>
        </View>

        {/* ── Microphone Button ── */}
        <View style={styles.micContainer}>
          {/* Pulse ring */}
          {isRecording && (
            <Animated.View
              style={[
                styles.pulseRing,
                { opacity: pulseOpacity, transform: [{ scale: 1.35 }] },
              ]}
            />
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
              <Text style={styles.micIcon}>🎙️</Text>
              <Text style={styles.micLabel}>
                {isRecording ? 'Recording…' : 'Hold to Record'}
              </Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* ── Transcription Output ── */}
        <View style={styles.outputCard}>
          <Text style={styles.outputLabel}>Transcribed Text (Marathi)</Text>
          <View style={styles.outputBox}>
            {transcription ? (
              <Text style={styles.outputText}>{transcription}</Text>
            ) : (
              <Text style={styles.outputPlaceholder}>
                Your spoken words will appear here…
              </Text>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D0D1A',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8888AA',
    marginTop: 4,
    letterSpacing: 0.5,
  },

  // Math Card
  mathCard: {
    width: '100%',
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A44',
    marginBottom: 20,
  },
  mathLabel: {
    fontSize: 14,
    color: '#7C5CFC',
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  mathProblem: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },

  // Status
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    minHeight: 24,
  },
  statusText: {
    fontSize: 14,
    color: '#8888AA',
  },
  statusError: {
    color: '#FF4466',
  },
  statusRecording: {
    color: '#FF5555',
    fontWeight: '600',
  },

  // Mic Button
  micContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    width: 180,
    height: 180,
  },
  pulseRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#FF5555',
  },
  micButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#7C5CFC',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  micButtonRecording: {
    backgroundColor: '#FF3355',
    shadowColor: '#FF3355',
  },
  micButtonDisabled: {
    backgroundColor: '#333355',
    shadowOpacity: 0,
    elevation: 0,
  },
  micIcon: {
    fontSize: 52,
    marginBottom: 4,
  },
  micLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // Output
  outputCard: {
    width: '100%',
    flex: 1,
    marginBottom: 24,
  },
  outputLabel: {
    fontSize: 12,
    color: '#7C5CFC',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  outputBox: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A44',
  },
  outputText: {
    fontSize: 22,
    color: '#FFFFFF',
    lineHeight: 34,
  },
  outputPlaceholder: {
    fontSize: 16,
    color: '#555577',
    fontStyle: 'italic',
  },
});
