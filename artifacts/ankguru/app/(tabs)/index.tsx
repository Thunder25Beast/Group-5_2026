import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAppStore, InteractionMode } from '@/hooks/store';

type Screen = 'home' | 'practice';

const MODES = [
  { key: 'mcq' as InteractionMode, title: 'Listen & Choose', marathi: 'ऐका आणि निवडा', color: '#F6A64A', icon: 'grid' as const },
  { key: 'scribble' as InteractionMode, title: 'Listen & Draw', marathi: 'ऐका आणि काढा', color: '#48A995', icon: 'edit-2' as const },
  { key: 'voice' as InteractionMode, title: 'Look & Speak', marathi: 'पहा आणि बोला', color: '#7184E6', icon: 'mic' as const },
];

const QUESTIONS = [
  { id: '1', display: '१२ + ८ = ?', spoken: 'बारा अधिक आठ', options: ['२०', '१८', '२२', '१५'], correct: '२०' },
  { id: '2', display: '१५ − ६ = ?', spoken: 'पंधरा वजा सहा', options: ['९', '८', '१०', '७'], correct: '९' },
  { id: '3', display: '३६', spoken: 'छत्तीस', options: ['३६', '२६', '४६', '६३'], correct: '३६' },
  { id: '4', display: '७ + ९ = ?', spoken: 'सात अधिक नऊ', options: ['१६', '१५', '१७', '१४'], correct: '१६' },
  { id: '5', display: '१८ − ९ = ?', spoken: 'अठरा वजा नऊ', options: ['९', '८', '७', '१०'], correct: '९' },
];

function BrandMark() {
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandIcon}><Feather name="sun" size={22} color="#FFFFFF" /></View>
      <Text style={styles.brandText}>अंकगुरु</Text>
    </View>
  );
}

function ScreenShell({
  children,
  onBack,
  showBack = false,
}: {
  children: React.ReactNode;
  onBack?: () => void;
  showBack?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style="dark" />
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 16) }]}>
        {showBack ? (
          <Pressable onPress={onBack} style={styles.iconButton}>
            <Feather name="arrow-left" size={24} color={colors.primary} />
          </Pressable>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
        <BrandMark />
        <View style={styles.soundDot}><Feather name="volume-2" size={18} color={colors.primary} /></View>
      </View>
      {children}
    </View>
  );
}

export default function AnkGuruApp() {
  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<InteractionMode>('mcq');
  const [questionIndex, setQuestionIndex] = useState(0);

  const chooseMode = (chosen: InteractionMode) => {
    setMode(chosen);
    setQuestionIndex(0);
    setScreen('practice');
  };

  const handleNext = () => {
    setQuestionIndex((prev) => (prev + 1) % QUESTIONS.length);
  };

  const handleBack = () => {
    setScreen('home');
  };

  if (screen === 'home') return <HomeScreen onChoose={chooseMode} />;
  return (
    <PracticeScreen
      mode={mode}
      question={QUESTIONS[questionIndex]}
      questionIndex={questionIndex}
      onBack={handleBack}
      onNext={handleNext}
    />
  );
}

function HomeScreen({ onChoose }: { onChoose: (mode: InteractionMode) => void }) {
  const insets = useSafeAreaInsets();
  const { config } = useAppStore();
  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeBlock}>
          <Text style={styles.kicker}>नमस्कार, {config.studentName || 'मित्रा'}!</Text>
          <Text style={styles.heroTitle}>आज काय शिकायचे?</Text>
          <Text style={styles.heroSubtitle}>एक सराव निवडा</Text>
        </View>
        <View style={styles.modeList}>
          {MODES.map((item) => (
            <Pressable key={item.key} testID={`mode-${item.key}`} onPress={() => onChoose(item.key)} style={({ pressed }) => [styles.modeCard, { borderLeftColor: item.color }, pressed && styles.cardPressed]}>
              <View style={[styles.modeIcon, { backgroundColor: item.color }]}><Feather name={item.icon} size={30} color="#FFFFFF" /></View>
              <View style={styles.modeCopy}><Text style={styles.modeTitle}>{item.title}</Text><Text style={styles.modeMarathi}>{item.marathi}</Text></View>
              <Feather name="arrow-up-right" size={24} color={item.color} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

function PracticeScreen({
  mode,
  question,
  questionIndex,
  onBack,
  onNext,
}: {
  mode: InteractionMode;
  question: typeof QUESTIONS[0];
  questionIndex: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addLog } = useAppStore();

  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'retry' | null>(null);

  const pulse = useRef(new Animated.Value(1)).current;

  // Reset state when question or mode changes
  useEffect(() => {
    setFeedback(null);
    setPlaying(false);
    setRecording(false);
    setProcessing(false);
  }, [question, mode]);

  useEffect(() => {
    if (!recording) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.08, duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 550, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { setRecording(true); setFeedback(null); },
    onPanResponderRelease: () => {
      if (!recording) return;
      setRecording(false);
      handleCheckAnswer(true);
    },
    onPanResponderTerminate: () => {
      setRecording(false);
    },
  }), [recording]);

  const handlePlay = () => {
    setPlaying(true);
    setTimeout(() => setPlaying(false), 2000);
  };

  const handleCheckAnswer = (isCorrect: boolean) => {
    setProcessing(true);
    setTimeout(() => {
      setFeedback(isCorrect ? 'correct' : 'retry');
      setProcessing(false);
      addLog({
        questionDisplay: question.display,
        mode,
        isCorrect,
      });
      if (isCorrect) {
        setTimeout(() => {
          onNext();
        }, 1500);
      }
    }, 1000);
  };

  const modeData = MODES.find((m) => m.key === mode);

  return (
    <ScreenShell showBack onBack={onBack}>
      <ScrollView contentContainerStyle={[styles.practiceContent, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.practiceMeta}>
          <Text style={styles.practiceMode}>{modeData?.marathi}</Text>
          <Text style={styles.questionCount}>प्रश्न {questionIndex + 1}</Text>
        </View>

        {mode !== 'voice' && (
          <Pressable onPress={handlePlay} style={({ pressed }) => [styles.playButton, playing && styles.playingButton, pressed && styles.pressed]}>
            <Feather name={playing ? 'volume-2' : 'play'} size={22} color={playing ? '#FFFFFF' : colors.primary} />
            <Text style={[styles.playText, playing && styles.playTextActive]}>{playing ? 'ऐकू येत आहे...' : 'प्रश्न ऐका'}</Text>
          </Pressable>
        )}

        <View style={[styles.questionCard, mode === 'voice' && { marginTop: 20 }]}>
          {mode === 'voice' ? (
            <>
              <Text style={styles.questionLabel}>उत्तर बोला</Text>
              <Text style={styles.questionText}>{question.display}</Text>
            </>
          ) : (
            <>
              <Text style={styles.questionLabel}>ऐका आणि उत्तर द्या</Text>
              <Feather name="volume-2" size={48} color="#A1ADB4" style={{ marginVertical: 10 }} />
            </>
          )}
        </View>

        {mode === 'mcq' && (
          <View style={styles.mcqGrid}>
            {question.options.map((opt, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.mcqOption, pressed && styles.pressed]}
                onPress={() => handleCheckAnswer(opt === question.correct)}
              >
                <Text style={styles.mcqOptionText}>{opt}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {mode === 'scribble' && (
          <View style={styles.scribbleArea}>
            <View style={styles.canvasPlaceholder}>
              <Feather name="edit-3" size={40} color="#DDE7EE" />
              <Text style={styles.canvasText}>येथे काढा</Text>
            </View>
            <Pressable onPress={() => handleCheckAnswer(true)} style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}>
              <Text style={styles.submitText}>तपासा</Text>
            </Pressable>
          </View>
        )}

        {mode === 'voice' && (
          <View style={styles.recordArea}>
            <Text style={styles.recordLabel}>{processing ? 'तपासत आहे...' : recording ? 'बोला... ऐकत आहे!' : 'उत्तर बोलण्यासाठी दाबा'}</Text>
            <Animated.View style={{ transform: [{ scale: pulse }] }} {...responder.panHandlers}>
              <View style={[styles.recordButton, recording && styles.recordingButton, processing && styles.processingButton]}>
                {processing ? <ActivityIndicator size="large" color="#FFFFFF" /> : <Feather name={recording ? 'radio' : 'mic'} size={42} color="#FFFFFF" />}
              </View>
            </Animated.View>
            {!processing && <Text style={styles.holdHint}>दाबून ठेवा • सोडल्यावर उत्तर तपासले जाईल</Text>}
          </View>
        )}

        {feedback && (
          <View style={[styles.feedback, feedback === 'correct' ? styles.correctFeedback : styles.retryFeedback]}>
            <Feather name={feedback === 'correct' ? 'check-circle' : 'refresh-cw'} size={30} color="#FFFFFF" />
            <View>
              <Text style={styles.feedbackTitle}>{feedback === 'correct' ? 'बरोबर!' : 'पुन्हा प्रयत्न करा'}</Text>
              <Text style={styles.feedbackSub}>{feedback === 'correct' ? 'पुढचा प्रश्न येत आहे...' : 'तुम्ही हे करू शकता!'}</Text>
            </View>
          </View>
        )}

      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { minHeight: 82, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  brandIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#F6A64A', alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 22, color: '#17324D', fontWeight: '800' },
  soundDot: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E7F5FF', alignItems: 'center', justifyContent: 'center' },
  iconPlaceholder: { width: 42 },
  iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7F5FF' },
  scrollContent: { paddingHorizontal: 22, paddingTop: 30, flexGrow: 1 },
  welcomeBlock: { alignItems: 'center', marginBottom: 20 },
  kicker: { fontSize: 18, color: '#E58A2B', fontWeight: '700', marginBottom: 10 },
  heroTitle: { fontSize: 30, lineHeight: 38, color: '#17324D', fontWeight: '800', textAlign: 'center' },
  heroSubtitle: { fontSize: 17, color: '#5C6B76', marginTop: 6 },
  modeList: { gap: 16, marginTop: 10 },
  modeCard: { backgroundColor: '#FFFFFF', minHeight: 105, borderRadius: 22, borderLeftWidth: 7, padding: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#17324D', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  modeIcon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  modeCopy: { flex: 1, marginLeft: 15 },
  modeTitle: { color: '#17324D', fontSize: 19, fontWeight: '800' },
  modeMarathi: { color: '#6D7C87', fontSize: 16, marginTop: 5 },
  practiceContent: { paddingHorizontal: 22, paddingTop: 20, flexGrow: 1 },
  practiceMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  practiceMode: { color: '#E58A2B', fontSize: 16, fontWeight: '800' },
  questionCount: { color: '#7A8994', fontSize: 14, fontWeight: '700' },
  questionCard: { backgroundColor: '#FFFFFF', minHeight: 160, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#17324D', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3, marginBottom: 20 },
  questionLabel: { color: '#7A8994', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  questionText: { color: '#17324D', fontSize: 46, fontWeight: '800', letterSpacing: 1 },
  playButton: { alignSelf: 'center', marginBottom: 20, paddingHorizontal: 22, minHeight: 50, borderRadius: 18, borderWidth: 2, borderColor: '#2477D4', flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  playingButton: { backgroundColor: '#2477D4' },
  playText: { color: '#2477D4', fontSize: 17, fontWeight: '800' },
  playTextActive: { color: '#FFFFFF' },
  mcqGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 15 },
  mcqOption: { width: '47%', backgroundColor: '#FFFFFF', height: 100, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#17324D', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  mcqOptionText: { fontSize: 32, fontWeight: '800', color: '#17324D' },
  scribbleArea: { marginTop: 10 },
  canvasPlaceholder: { width: '100%', height: 200, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 2, borderColor: '#DDE7EE', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  canvasText: { color: '#A1ADB4', fontSize: 18, fontWeight: '700', marginTop: 10 },
  submitButton: { width: '100%', height: 55, backgroundColor: '#48A995', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  recordArea: { alignItems: 'center', marginTop: 22 },
  recordLabel: { color: '#17324D', fontSize: 18, fontWeight: '800', marginBottom: 13 },
  recordButton: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#E95757', alignItems: 'center', justifyContent: 'center', shadowColor: '#E95757', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 6 },
  recordingButton: { backgroundColor: '#C73C4E' },
  processingButton: { backgroundColor: '#7184E6' },
  holdHint: { color: '#8A969E', fontSize: 12, marginTop: 13 },
  feedback: { marginTop: 22, minHeight: 78, borderRadius: 21, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 13 },
  correctFeedback: { backgroundColor: '#48A995' },
  retryFeedback: { backgroundColor: '#E95757' },
  feedbackTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '800' },
  feedbackSub: { color: '#FFFFFF', opacity: 0.9, fontSize: 14, marginTop: 2 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
