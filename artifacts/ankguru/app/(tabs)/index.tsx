import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useAppStore, InteractionMode, SessionConfig } from '@/hooks/store';

// ─── Data ────────────────────────────────────────────────────────────────────

type AppScreen = 'config' | 'practice' | 'summary';

const MODE_OPTIONS: { key: InteractionMode; label: string; marathi: string; color: string; icon: 'grid' | 'edit-2' | 'mic' }[] = [
  { key: 'mcq',      label: 'Listen & Choose (MCQ)',    marathi: 'ऐका आणि निवडा', color: '#F6A64A', icon: 'grid' },
  { key: 'scribble', label: 'Listen & Draw (Scribble)', marathi: 'ऐका आणि काढा', color: '#48A995', icon: 'edit-2' },
  { key: 'voice',    label: 'Look & Speak (Voice)',     marathi: 'पहा आणि बोला',  color: '#7184E6', icon: 'mic' },
];

const RANGE_PRESETS = ['0-10', '0-20', '0-50', '0-100'] as const;
const NUM_QUESTION_PRESETS = [3, 5, 10, 20] as const;

const QUESTION_POOL = [
  { id: '1', display: '१२ + ८ = ?', spoken: 'बारा अधिक आठ', options: ['२०', '१८', '२२', '१५'], correct: '२०' },
  { id: '2', display: '१५ − ६ = ?', spoken: 'पंधरा वजा सहा', options: ['९', '८', '१०', '७'],  correct: '९' },
  { id: '3', display: '३६',         spoken: 'छत्तीस',          options: ['३६', '२६', '४६', '६३'], correct: '३६' },
  { id: '4', display: '७ + ९ = ?',  spoken: 'सात अधिक नऊ',     options: ['१६', '१५', '१७', '१४'], correct: '१६' },
  { id: '5', display: '१८ − ९ = ?', spoken: 'अठरा वजा नऊ',     options: ['९', '८', '७', '१०'],   correct: '९' },
  { id: '6', display: '५ × ४ = ?',  spoken: 'पाच गुणिले चार',  options: ['२०', '१५', '२५', '१०'], correct: '२०' },
  { id: '7', display: '४८ ÷ ६ = ?', spoken: 'अठ्ठेचाळीस भागिले सहा', options: ['८', '७', '९', '६'], correct: '८' },
  { id: '8', display: '२५ + १३ = ?', spoken: 'पंचवीस अधिक तेरा', options: ['३८', '३७', '३९', '४०'], correct: '३८' },
  { id: '9', display: '१०० − ३७ = ?', spoken: 'शंभर वजा सदतीस', options: ['६३', '६२', '६४', '७३'], correct: '६३' },
  { id: '10', display: '९ × ९ = ?', spoken: 'नऊ गुणिले नऊ', options: ['८१', '७२', '९०', '६३'], correct: '८१' },
];

// ─── Shell ────────────────────────────────────────────────────────────────────

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

// ─── Root Controller ──────────────────────────────────────────────────────────

export default function AnkGuruApp() {
  const { setSessionConfig, clearSessionConfig } = useAppStore();
  const [screen, setScreen] = useState<AppScreen>('config');
  const [activeConfig, setActiveConfig] = useState<SessionConfig | null>(null);

  // Session-level score tracked here, passed to summary via state
  const [sessionScore, setSessionScore] = useState({ correct: 0, total: 0 });
  const [questionIndex, setQuestionIndex] = useState(0);

  const startSession = (cfg: SessionConfig) => {
    setSessionConfig(cfg);
    setActiveConfig(cfg);
    setSessionScore({ correct: 0, total: 0 });
    setQuestionIndex(0);
    setScreen('practice');
  };

  const handleQuestionDone = (wasCorrect: boolean, isLastQuestion: boolean) => {
    setSessionScore((prev) => ({
      correct: prev.correct + (wasCorrect ? 1 : 0),
      total: prev.total + 1,
    }));
    if (isLastQuestion) {
      setScreen('summary');
    } else {
      setQuestionIndex((prev) => prev + 1);
    }
  };

  const handleNewSession = () => {
    clearSessionConfig();
    setActiveConfig(null);
    setScreen('config');
  };

  if (screen === 'config') {
    return <ConfigScreen onStart={startSession} />;
  }

  if (screen === 'practice' && activeConfig) {
    const question = QUESTION_POOL[questionIndex % QUESTION_POOL.length];
    const isLastQuestion = questionIndex + 1 === activeConfig.numQuestions;
    return (
      <PracticeScreen
        mode={activeConfig.mode}
        question={question}
        questionNumber={questionIndex + 1}
        totalQuestions={activeConfig.numQuestions}
        isLastQuestion={isLastQuestion}
        onDone={(wasCorrect) => handleQuestionDone(wasCorrect, isLastQuestion)}
        onBack={handleNewSession}
      />
    );
  }

  return (
    <SummaryScreen
      score={sessionScore}
      onNewSession={handleNewSession}
    />
  );
}

// ─── Screen 1: Config ─────────────────────────────────────────────────────────

function ConfigScreen({ onStart }: { onStart: (cfg: SessionConfig) => void }) {
  const insets = useSafeAreaInsets();
  const [selectedMode, setSelectedMode] = useState<InteractionMode>('mcq');

  // Range state: preset string OR null when custom is active
  const [selectedRange, setSelectedRange] = useState<string>('0-100');
  const [customRangeMax, setCustomRangeMax] = useState('');
  const [rangeIsCustom, setRangeIsCustom] = useState(false);

  // Questions state: preset number OR 0 when custom is active
  const [selectedNum, setSelectedNum] = useState<number>(5);
  const [customNum, setCustomNum] = useState('');
  const [numIsCustom, setNumIsCustom] = useState(false);

  const handleStart = () => {
    const range = rangeIsCustom
      ? `0-${customRangeMax || '100'}`
      : selectedRange;
    const numQuestions = numIsCustom
      ? Math.max(1, Math.min(50, parseInt(customNum || '5', 10) || 5))
      : selectedNum;
    onStart({ mode: selectedMode, range, numQuestions });
  };

  return (
    <ScreenShell>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View style={styles.configHero}>
            <Text style={styles.configKicker}>तयार व्हा!</Text>
            <Text style={styles.configTitle}>सत्र सुरू करा</Text>
            <Text style={styles.configSub}>Choose your practice settings</Text>
          </View>

          {/* Mode Selection */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>📣  Practice Mode</Text>
            <View style={styles.modeList}>
              {MODE_OPTIONS.map((item) => {
                const isActive = selectedMode === item.key;
                return (
                  <Pressable
                    key={item.key}
                    testID={`mode-${item.key}`}
                    onPress={() => setSelectedMode(item.key)}
                    style={({ pressed }) => [
                      styles.modeRow,
                      isActive && { borderColor: item.color, borderWidth: 2.5 },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.modeIconSmall, { backgroundColor: isActive ? item.color : '#EEF2F6' }]}>
                      <Feather name={item.icon} size={22} color={isActive ? '#FFF' : '#8A969E'} />
                    </View>
                    <View style={styles.modeCopy}>
                      <Text style={[styles.modeRowTitle, isActive && { color: item.color }]}>{item.label}</Text>
                      <Text style={styles.modeRowMarathi}>{item.marathi}</Text>
                    </View>
                    {isActive && <Feather name="check-circle" size={22} color={item.color} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Number Range */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>🔢  Number Range</Text>
            <View style={styles.chipRow}>
              {RANGE_PRESETS.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => { setSelectedRange(r); setRangeIsCustom(false); }}
                  style={({ pressed }) => [
                    styles.smallChip,
                    !rangeIsCustom && selectedRange === r && styles.smallChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[
                    styles.smallChipText,
                    !rangeIsCustom && selectedRange === r && styles.smallChipTextActive,
                  ]}>{r}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setRangeIsCustom(true)}
                style={({ pressed }) => [
                  styles.smallChip,
                  rangeIsCustom && styles.smallChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.smallChipText, rangeIsCustom && styles.smallChipTextActive]}>✏️</Text>
              </Pressable>
            </View>
            {rangeIsCustom && (
              <View style={styles.customInputRow}>
                <Text style={styles.customInputLabel}>0  —  up to</Text>
                <TextInput
                  style={styles.customInput}
                  value={customRangeMax}
                  onChangeText={setCustomRangeMax}
                  keyboardType="number-pad"
                  placeholder="e.g. 200"
                  placeholderTextColor="#A1ADB4"
                  maxLength={5}
                />
              </View>
            )}
          </View>

          {/* Number of Questions */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>❓  Number of Questions</Text>
            <View style={styles.chipRow}>
              {NUM_QUESTION_PRESETS.map((n) => (
                <Pressable
                  key={n}
                  testID={`num-${n}`}
                  onPress={() => { setSelectedNum(n); setNumIsCustom(false); }}
                  style={({ pressed }) => [
                    styles.numChip,
                    !numIsCustom && selectedNum === n && styles.numChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.numChipText, !numIsCustom && selectedNum === n && styles.numChipTextActive]}>
                    {n}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setNumIsCustom(true)}
                style={({ pressed }) => [
                  styles.numChip,
                  numIsCustom && styles.numChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.numChipText, numIsCustom && styles.numChipTextActive]}>✏️</Text>
              </Pressable>
            </View>
            {numIsCustom && (
              <View style={styles.customInputRow}>
                <Text style={styles.customInputLabel}>Enter count  (1–50)</Text>
                <TextInput
                  style={styles.customInput}
                  value={customNum}
                  onChangeText={setCustomNum}
                  keyboardType="number-pad"
                  placeholder="e.g. 7"
                  placeholderTextColor="#A1ADB4"
                  maxLength={2}
                />
              </View>
            )}
          </View>

          {/* Start Button — inside scroll so it's always visible */}
          <Pressable
            testID="start-practice-btn"
            onPress={handleStart}
            style={({ pressed }) => [styles.startButton, { marginTop: 8, marginBottom: 8 }, pressed && styles.pressed]}
          >
            <Feather name="play" size={26} color="#FFF" style={{ marginRight: 12 }} />
            <Text style={styles.startButtonText}>Start Practice</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

// ─── Screen 2: Practice ───────────────────────────────────────────────────────

function PracticeScreen({
  mode,
  question,
  questionNumber,
  totalQuestions,
  isLastQuestion,
  onDone,
  onBack,
}: {
  mode: InteractionMode;
  question: typeof QUESTION_POOL[0];
  questionNumber: number;
  totalQuestions: number;
  isLastQuestion: boolean;
  onDone: (wasCorrect: boolean) => void;
  onBack: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean } | null>(null);

  const pulse = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: questionNumber / totalQuestions,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [questionNumber, totalQuestions]);

  // Reset per question
  useEffect(() => {
    setFeedback(null);
    setPlaying(false);
    setRecording(false);
    setProcessing(false);
  }, [question, mode]);

  // Mic pulse animation
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
    onPanResponderTerminate: () => { setRecording(false); },
  }), [recording]);

  const handlePlay = () => {
    setPlaying(true);
    setTimeout(() => setPlaying(false), 2000);
  };

  const handleCheckAnswer = (isCorrect: boolean) => {
    setProcessing(true);
    setTimeout(() => {
      setFeedback({ isCorrect });
      setProcessing(false);
    }, 800);
  };

  const modeData = MODE_OPTIONS.find((m) => m.key === mode)!;
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <ScreenShell showBack onBack={onBack}>
      {/* Progress Indicator */}
      <View style={styles.progressWrapper}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: modeData.color }]} />
        </View>
        <Text style={styles.progressLabel}>
          Question <Text style={[styles.progressBold, { color: modeData.color }]}>{questionNumber}</Text> of <Text style={styles.progressBold}>{totalQuestions}</Text>
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.practiceContent, { paddingBottom: insets.bottom + 30 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.practiceMeta}>
          <Text style={[styles.practiceMode, { color: modeData.color }]}>{modeData.marathi}</Text>
        </View>

        {mode !== 'voice' && (
          <Pressable
            onPress={handlePlay}
            style={({ pressed }) => [styles.playButton, playing && styles.playingButton, pressed && styles.pressed]}
          >
            <Feather name={playing ? 'volume-2' : 'play'} size={22} color={playing ? '#FFFFFF' : colors.primary} />
            <Text style={[styles.playText, playing && styles.playTextActive]}>
              {playing ? 'ऐकू येत आहे...' : 'प्रश्न ऐका'}
            </Text>
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
                disabled={!!feedback}
                style={({ pressed }) => [
                  styles.mcqOption,
                  feedback && opt === question.correct && styles.mcqCorrect,
                  pressed && !feedback && styles.pressed,
                ]}
                onPress={() => handleCheckAnswer(opt === question.correct)}
              >
                <Text style={[styles.mcqOptionText, feedback && opt === question.correct && { color: '#FFF' }]}>{opt}</Text>
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
            {!feedback && (
              <Pressable
                onPress={() => handleCheckAnswer(true)}
                style={({ pressed }) => [styles.submitButton, pressed && styles.pressed]}
              >
                <Text style={styles.submitText}>तपासा</Text>
              </Pressable>
            )}
          </View>
        )}

        {mode === 'voice' && (
          <View style={styles.recordArea}>
            <Text style={styles.recordLabel}>
              {processing ? 'तपासत आहे...' : recording ? 'बोला... ऐकत आहे!' : 'उत्तर बोलण्यासाठी दाबा'}
            </Text>
            <Animated.View style={{ transform: [{ scale: pulse }] }} {...responder.panHandlers}>
              <View style={[styles.recordButton, recording && styles.recordingButton, processing && styles.processingButton]}>
                {processing
                  ? <ActivityIndicator size="large" color="#FFFFFF" />
                  : <Feather name={recording ? 'radio' : 'mic'} size={42} color="#FFFFFF" />}
              </View>
            </Animated.View>
            {!processing && <Text style={styles.holdHint}>दाबून ठेवा • सोडल्यावर उत्तर तपासले जाईल</Text>}
          </View>
        )}

        {/* Feedback + Next/Finish */}
        {feedback && (
          <View style={[styles.feedback, feedback.isCorrect ? styles.correctFeedback : styles.retryFeedback]}>
            <Feather name={feedback.isCorrect ? 'check-circle' : 'x-circle'} size={30} color="#FFFFFF" />
            <View style={{ flex: 1 }}>
              <Text style={styles.feedbackTitle}>{feedback.isCorrect ? 'बरोबर! 🎉' : 'चुकले!'}</Text>
              <Text style={styles.feedbackSub}>{feedback.isCorrect ? 'छान काम!' : `बरोबर उत्तर: ${question.correct}`}</Text>
            </View>
          </View>
        )}

        {feedback && (
          <Pressable
            testID={isLastQuestion ? 'finish-session-btn' : 'next-question-btn'}
            onPress={() => onDone(feedback.isCorrect)}
            style={({ pressed }) => [
              styles.nextButton,
              isLastQuestion && styles.finishButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.nextButtonText}>
              {isLastQuestion ? '🏁  Finish Session' : 'Next Question  →'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </ScreenShell>
  );
}

// ─── Screen 3: Summary ────────────────────────────────────────────────────────

function SummaryScreen({
  score,
  onNewSession,
}: {
  score: { correct: number; total: number };
  onNewSession: () => void;
}) {
  const insets = useSafeAreaInsets();
  const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  const emoji = pct === 100 ? '🌟' : pct >= 60 ? '😊' : '💪';
  const message = pct === 100
    ? 'Perfect Score! शाबास!'
    : pct >= 60
    ? 'Great Job! छान काम!'
    : 'Keep Going! प्रयत्न करत राहा!';

  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 5, tension: 80 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: '#F0F9FF' }]}>
      <StatusBar style="dark" />
      <View style={[styles.summaryContainer, { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 20 }]}>
        <Animated.View style={[styles.summaryCard, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <Text style={styles.summaryEmoji}>{emoji}</Text>
          <Text style={styles.summaryTitle}>Session Complete!</Text>
          <Text style={styles.summaryMarathi}>सत्र पूर्ण!</Text>
          <Text style={styles.summaryMessage}>{message}</Text>

          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{score.total}</Text>
              <Text style={styles.statLabel}>Questions</Text>
            </View>
            <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: '#DDE7EE' }]}>
              <Text style={[styles.statNumber, { color: '#48A995' }]}>{score.correct}</Text>
              <Text style={styles.statLabel}>Correct ✅</Text>
            </View>
            <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: '#DDE7EE' }]}>
              <Text style={[styles.statNumber, { color: '#E95757' }]}>{score.total - score.correct}</Text>
              <Text style={styles.statLabel}>Incorrect ❌</Text>
            </View>
          </View>

          <View style={styles.scoreBarTrack}>
            <View style={[styles.scoreBarFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.scorePercent}>{pct}% accuracy</Text>
        </Animated.View>

        <Pressable
          testID="new-session-btn"
          onPress={onNewSession}
          style={({ pressed }) => [styles.newSessionButton, pressed && styles.pressed]}
        >
          <Feather name="refresh-cw" size={24} color="#FFF" style={{ marginRight: 10 }} />
          <Text style={styles.newSessionText}>Start New Session</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Shell
  topBar: { minHeight: 82, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  brandIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#F6A64A', alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 22, color: '#17324D', fontWeight: '800' },
  soundDot: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E7F5FF', alignItems: 'center', justifyContent: 'center' },
  iconPlaceholder: { width: 42 },
  iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7F5FF' },
  scrollContent: { paddingHorizontal: 22, paddingTop: 16, flexGrow: 1 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },

  // Config Screen
  configHero: { alignItems: 'center', marginBottom: 28, marginTop: 8 },
  configKicker: { fontSize: 15, color: '#E58A2B', fontWeight: '800', letterSpacing: 1 },
  configTitle: { fontSize: 34, color: '#17324D', fontWeight: '800', marginTop: 6 },
  configSub: { fontSize: 16, color: '#7A8994', marginTop: 5 },

  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 20, marginBottom: 18, shadowColor: '#17324D', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  sectionLabel: { fontSize: 16, fontWeight: '800', color: '#17324D', marginBottom: 14 },

  modeList: { gap: 12 },
  modeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, borderWidth: 2, borderColor: 'transparent' },
  modeIconSmall: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  modeCopy: { flex: 1 },
  modeRowTitle: { fontSize: 16, fontWeight: '800', color: '#17324D' },
  modeRowMarathi: { fontSize: 13, color: '#8A969E', marginTop: 2 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },

  smallChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: '#F4F7FA', alignItems: 'center', justifyContent: 'center' },
  smallChipActive: { backgroundColor: '#2477D4' },
  smallChipText: { fontSize: 14, fontWeight: '800', color: '#7A8994' },
  smallChipTextActive: { color: '#FFFFFF' },

  numChip: { width: 60, height: 60, borderRadius: 18, backgroundColor: '#F4F7FA', alignItems: 'center', justifyContent: 'center' },
  numChipActive: { backgroundColor: '#17324D' },
  numChipText: { fontSize: 22, fontWeight: '800', color: '#7A8994' },
  numChipTextActive: { color: '#FFFFFF' },

  customInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 12 },
  customInputLabel: { fontSize: 15, fontWeight: '700', color: '#5C6B76', flex: 1 },
  customInput: { width: 110, height: 50, borderRadius: 14, backgroundColor: '#F4F7FA', borderWidth: 2, borderColor: '#2477D4', paddingHorizontal: 14, fontSize: 20, fontWeight: '800', color: '#17324D', textAlign: 'center' },

  startButton: { height: 70, borderRadius: 22, backgroundColor: '#F6A64A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#F6A64A', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  startButtonText: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },

  // Progress
  progressWrapper: { paddingHorizontal: 22, paddingBottom: 12, paddingTop: 4 },
  progressTrack: { height: 8, backgroundColor: '#EEF2F6', borderRadius: 99, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 99 },
  progressLabel: { fontSize: 14, color: '#7A8994', fontWeight: '600', textAlign: 'center' },
  progressBold: { fontWeight: '800', color: '#17324D' },

  // Practice Screen
  practiceContent: { paddingHorizontal: 22, paddingTop: 8, flexGrow: 1 },
  practiceMeta: { marginBottom: 16, alignItems: 'center' },
  practiceMode: { fontSize: 17, fontWeight: '800' },

  questionCard: { backgroundColor: '#FFFFFF', minHeight: 160, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#17324D', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3, marginBottom: 20, padding: 20 },
  questionLabel: { color: '#7A8994', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  questionText: { color: '#17324D', fontSize: 46, fontWeight: '800', letterSpacing: 1 },

  playButton: { alignSelf: 'center', marginBottom: 20, paddingHorizontal: 22, minHeight: 50, borderRadius: 18, borderWidth: 2, borderColor: '#2477D4', flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  playingButton: { backgroundColor: '#2477D4' },
  playText: { color: '#2477D4', fontSize: 17, fontWeight: '800' },
  playTextActive: { color: '#FFFFFF' },

  mcqGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 15 },
  mcqOption: { width: '47%', backgroundColor: '#FFFFFF', height: 100, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#17324D', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  mcqCorrect: { backgroundColor: '#48A995' },
  mcqOptionText: { fontSize: 32, fontWeight: '800', color: '#17324D' },

  scribbleArea: { marginTop: 10 },
  canvasPlaceholder: { width: '100%', height: 200, backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 2, borderColor: '#DDE7EE', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  canvasText: { color: '#A1ADB4', fontSize: 18, fontWeight: '700', marginTop: 10 },
  submitButton: { width: '100%', height: 60, backgroundColor: '#48A995', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },

  recordArea: { alignItems: 'center', marginTop: 22 },
  recordLabel: { color: '#17324D', fontSize: 18, fontWeight: '800', marginBottom: 13 },
  recordButton: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#E95757', alignItems: 'center', justifyContent: 'center', shadowColor: '#E95757', shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 6 },
  recordingButton: { backgroundColor: '#C73C4E' },
  processingButton: { backgroundColor: '#7184E6' },
  holdHint: { color: '#8A969E', fontSize: 12, marginTop: 13 },

  feedback: { marginTop: 20, minHeight: 78, borderRadius: 21, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  correctFeedback: { backgroundColor: '#48A995' },
  retryFeedback: { backgroundColor: '#E95757' },
  feedbackTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  feedbackSub: { color: '#FFFFFF', opacity: 0.9, fontSize: 14, marginTop: 2 },

  nextButton: { marginTop: 16, height: 64, borderRadius: 20, backgroundColor: '#2477D4', alignItems: 'center', justifyContent: 'center' },
  finishButton: { backgroundColor: '#F6A64A' },
  nextButtonText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },

  // Summary Screen
  summaryContainer: { flex: 1, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 32, padding: 28, alignItems: 'center', shadowColor: '#17324D', shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8, marginBottom: 28 },
  summaryEmoji: { fontSize: 72, marginBottom: 10 },
  summaryTitle: { fontSize: 32, fontWeight: '800', color: '#17324D' },
  summaryMarathi: { fontSize: 20, fontWeight: '700', color: '#E58A2B', marginTop: 4 },
  summaryMessage: { fontSize: 17, color: '#5C6B76', marginTop: 8, marginBottom: 22, textAlign: 'center' },

  statRow: { flexDirection: 'row', width: '100%', backgroundColor: '#F8FAFC', borderRadius: 18, overflow: 'hidden', marginBottom: 20 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statNumber: { fontSize: 32, fontWeight: '800', color: '#17324D' },
  statLabel: { fontSize: 12, fontWeight: '700', color: '#8A969E', marginTop: 3 },

  scoreBarTrack: { width: '100%', height: 10, backgroundColor: '#EEF2F6', borderRadius: 99, overflow: 'hidden', marginBottom: 8 },
  scoreBarFill: { height: '100%', backgroundColor: '#48A995', borderRadius: 99 },
  scorePercent: { fontSize: 15, fontWeight: '700', color: '#7A8994' },

  newSessionButton: { width: '100%', height: 70, borderRadius: 22, backgroundColor: '#F6A64A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#F6A64A', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  newSessionText: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
});
