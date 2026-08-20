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

type Screen = 'home' | 'modes' | 'practice' | 'summary';
type ModeKey = 'numbers' | 'addition' | 'subtraction';
type Feedback = 'correct' | 'retry' | null;

const STUDENTS = [
  { name: 'मीरा', roman: 'Meera', color: '#F6A64A', icon: 'sun' as const },
  { name: 'राहुल', roman: 'Rahul', color: '#61B7A8', icon: 'smile' as const },
  { name: 'प्रिया', roman: 'Priya', color: '#7C8DE8', icon: 'star' as const },
];

const MODES: Array<{
  key: ModeKey;
  title: string;
  marathi: string;
  color: string;
  icon: 'grid' | 'plus' | 'minus';
}> = [
  { key: 'numbers', title: 'Number Familiarity', marathi: 'संख्या ओळख', color: '#F6A64A', icon: 'grid' },
  { key: 'addition', title: 'Addition', marathi: 'बेरीज', color: '#48A995', icon: 'plus' },
  { key: 'subtraction', title: 'Subtraction', marathi: 'वजाबाकी', color: '#7184E6', icon: 'minus' },
];

const QUESTIONS = [
  { mode: 'addition' as ModeKey, display: '१२ + ८ = ?', spoken: 'बारा अधिक आठ' },
  { mode: 'subtraction' as ModeKey, display: '१५ − ६ = ?', spoken: 'पंधरा वजा सहा' },
  { mode: 'numbers' as ModeKey, display: '३६', spoken: 'छत्तीस' },
  { mode: 'addition' as ModeKey, display: '७ + ९ = ?', spoken: 'सात अधिक नऊ' },
  { mode: 'subtraction' as ModeKey, display: '१८ − ९ = ?', spoken: 'अठरा वजा नऊ' },
];

function IconButton({
  name,
  label,
  onPress,
  color,
}: {
  name: React.ComponentProps<typeof Feather>['name'];
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: color }, pressed && styles.pressed]}
    >
      <Feather name={name} size={24} color="#FFFFFF" />
    </Pressable>
  );
}

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
        {showBack ? <IconButton name="arrow-left" label="Back" onPress={onBack ?? (() => {})} color={colors.primary} /> : <View style={styles.iconPlaceholder} />}
        <BrandMark />
        <View style={styles.soundDot}><Feather name="volume-2" size={18} color={colors.primary} /></View>
      </View>
      {children}
    </View>
  );
}

export default function AnkGuruApp() {
  const [screen, setScreen] = useState<Screen>('home');
  const [student, setStudent] = useState<typeof STUDENTS[number] | null>(null);
  const [mode, setMode] = useState<ModeKey>('addition');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [attempted, setAttempted] = useState(0);
  const [correct, setCorrect] = useState(0);

  const chooseStudent = (chosen: typeof STUDENTS[number]) => {
    setStudent(chosen);
    setScreen('modes');
  };
  const chooseMode = (chosen: ModeKey) => {
    setMode(chosen);
    setQuestionIndex(0);
    setFeedback(null);
    setScreen('practice');
  };
  const resetHome = () => {
    setStudent(null);
    setAttempted(0);
    setCorrect(0);
    setQuestionIndex(0);
    setFeedback(null);
    setScreen('home');
  };
  const modeQuestions = QUESTIONS.filter((item) => item.mode === mode);
  const activeQuestion = modeQuestions[questionIndex % modeQuestions.length] ?? QUESTIONS[0];

  if (screen === 'home') return <HomeScreen onChoose={chooseStudent} />;
  if (screen === 'modes') return <ModeScreen student={student} onBack={() => setScreen('home')} onChoose={chooseMode} />;
  if (screen === 'summary') return <SummaryScreen attempted={attempted || 5} correct={correct || 4} onHome={resetHome} />;
  return (
    <PracticeScreen
      student={student}
      mode={mode}
      question={activeQuestion}
      questionIndex={questionIndex}
      feedback={feedback}
      playing={playing}
      recording={recording}
      processing={processing}
      onBack={() => setScreen('modes')}
      onPlay={() => {
        setPlaying(true);
        setTimeout(() => setPlaying(false), 2000);
      }}
      onStartRecording={() => { setRecording(true); setFeedback(null); }}
      onStopRecording={() => {
        if (!recording) return;
        setRecording(false);
        setProcessing(true);
        setTimeout(() => {
          const isCorrect = (questionIndex + attempted) % 3 !== 1;
          setFeedback(isCorrect ? 'correct' : 'retry');
          setAttempted((count) => count + 1);
          if (isCorrect) setCorrect((count) => count + 1);
          setProcessing(false);
        }, 1500);
      }}
      onNext={() => {
        setQuestionIndex((index) => (index + 1) % QUESTIONS.length);
        setFeedback(null);
      }}
      onFinish={() => setScreen('summary')}
    />
  );
}

function HomeScreen({ onChoose }: { onChoose: (student: typeof STUDENTS[number]) => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 26 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeBlock}>
          <Text style={styles.kicker}>चला, शिकूया!</Text>
          <Text style={styles.heroTitle}>कोण सराव करत आहे?</Text>
          <Text style={styles.heroSubtitle}>तुमचे नाव निवडा</Text>
        </View>
        <View style={styles.sunIllustration}><Feather name="sun" size={64} color="#F6A64A" /></View>
        <View style={styles.studentList}>
          {STUDENTS.map((item) => (
            <Pressable key={item.roman} testID={`student-${item.roman}`} onPress={() => onChoose(item)} style={({ pressed }) => [styles.studentCard, pressed && styles.cardPressed]}>
              <View style={[styles.avatar, { backgroundColor: item.color }]}><Feather name={item.icon} size={30} color="#FFFFFF" /></View>
              <View style={styles.studentCopy}><Text style={styles.studentName}>{item.name}</Text><Text style={styles.studentRoman}>{item.roman}</Text></View>
              <Feather name="chevron-right" size={28} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
        <View style={styles.offlinePill}><Feather name="wifi-off" size={16} color="#397B71" /><Text style={styles.offlineText}>ऑफलाइन सराव • इंटरनेटची गरज नाही</Text></View>
      </ScrollView>
    </ScreenShell>
  );
}

function ModeScreen({
  student,
  onBack,
  onChoose,
}: {
  student: typeof STUDENTS[number] | null;
  onBack: () => void;
  onChoose: (mode: ModeKey) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScreenShell showBack onBack={onBack}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 26 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeBlock}>
          <Text style={styles.kicker}>नमस्कार, {student?.name ?? 'मित्रा'}!</Text>
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
        <View style={styles.tipCard}><Feather name="heart" size={20} color="#E95757" /><Text style={styles.tipText}>घाई करू नका. प्रत्येक उत्तर एक नवीन पाऊल आहे.</Text></View>
      </ScrollView>
    </ScreenShell>
  );
}

function PracticeScreen({
  student,
  mode,
  question,
  questionIndex,
  feedback,
  playing,
  recording,
  processing,
  onBack,
  onPlay,
  onStartRecording,
  onStopRecording,
  onNext,
  onFinish,
}: {
  student: typeof STUDENTS[number] | null;
  mode: ModeKey;
  question: typeof QUESTIONS[number];
  questionIndex: number;
  feedback: Feedback;
  playing: boolean;
  recording: boolean;
  processing: boolean;
  onBack: () => void;
  onPlay: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onNext: () => void;
  onFinish: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(1)).current;
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
    onPanResponderGrant: onStartRecording,
    onPanResponderRelease: onStopRecording,
    onPanResponderTerminate: onStopRecording,
  }), [onStartRecording, onStopRecording]);

  return (
    <ScreenShell showBack onBack={onBack}>
      <ScrollView contentContainerStyle={[styles.practiceContent, { paddingBottom: insets.bottom + 26 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.practiceMeta}><Text style={styles.practiceMode}>{MODES.find((item) => item.key === mode)?.marathi}</Text><Text style={styles.questionCount}>प्रश्न {questionIndex + 1} / ५</Text></View>
        <View style={styles.questionCard}>
          <Text style={styles.questionLabel}>ऐका आणि उत्तर द्या</Text>
          <Text style={styles.questionText}>{question.display}</Text>
          <Text style={styles.questionHint}>{question.spoken}</Text>
        </View>
        <Pressable testID="play-question" onPress={onPlay} style={({ pressed }) => [styles.playButton, playing && styles.playingButton, pressed && styles.pressed]}>
          <Feather name={playing ? 'volume-2' : 'play'} size={22} color={playing ? '#FFFFFF' : colors.primary} />
          <Text style={[styles.playText, playing && styles.playTextActive]}>{playing ? 'ऐकू येत आहे...' : 'प्रश्न ऐका'}</Text>
        </Pressable>
        <View style={styles.recordArea}>
          <Text style={styles.recordLabel}>{processing ? 'तपासत आहे...' : recording ? 'बोला... ऐकत आहे!' : 'उत्तर बोलण्यासाठी दाबा'}</Text>
          <Animated.View style={{ transform: [{ scale: pulse }] }} {...responder.panHandlers}>
            <View style={[styles.recordButton, recording && styles.recordingButton, processing && styles.processingButton]}>
              {processing ? <ActivityIndicator size="large" color="#FFFFFF" /> : <Feather name={recording ? 'radio' : 'mic'} size={42} color="#FFFFFF" />}
            </View>
          </Animated.View>
          {!processing && <Text style={styles.holdHint}>दाबून ठेवा • सोडल्यावर उत्तर तपासले जाईल</Text>}
        </View>
        {feedback && (
          <View style={[styles.feedback, feedback === 'correct' ? styles.correctFeedback : styles.retryFeedback]}>
            <Feather name={feedback === 'correct' ? 'check-circle' : 'refresh-cw'} size={30} color="#FFFFFF" />
            <View><Text style={styles.feedbackTitle}>{feedback === 'correct' ? 'बरोबर!' : 'पुन्हा प्रयत्न करा'}</Text><Text style={styles.feedbackSub}>{feedback === 'correct' ? 'खूप छान केले!' : 'तुम्ही हे करू शकता!'}</Text></View>
          </View>
        )}
        {feedback && <View style={styles.actionRow}><Pressable testID="next-question" onPress={onNext} style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}><Text style={styles.nextText}>पुढचा प्रश्न</Text><Feather name="arrow-right" size={20} color="#FFFFFF" /></Pressable><Pressable testID="finish-session" onPress={onFinish} style={({ pressed }) => [styles.finishButton, pressed && styles.pressed]}><Text style={styles.finishText}>सत्र संपवा</Text></Pressable></View>}
        {!feedback && !processing && <Text style={styles.encourage}>{student?.name}, तू नक्की करू शकतोस!</Text>}
      </ScrollView>
    </ScreenShell>
  );
}

function SummaryScreen({ attempted, correct, onHome }: { attempted: number; correct: number; onHome: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={[styles.summaryContent, { paddingBottom: insets.bottom + 26 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryIcon}><Feather name="award" size={56} color="#F6A64A" /></View>
        <Text style={styles.summaryKicker}>सराव पूर्ण!</Text>
        <Text style={styles.summaryTitle}>खूप छान केले!</Text>
        <Text style={styles.summarySubtitle}>आजचा सराव इथे संपला.</Text>
        <View style={styles.statsCard}>
          <View style={styles.stat}><Text style={styles.statNumber}>{attempted}</Text><Text style={styles.statLabel}>प्रश्न सोडवले</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.stat}><Text style={[styles.statNumber, { color: '#48A995' }]}>{correct}</Text><Text style={styles.statLabel}>बरोबर उत्तरे</Text></View>
        </View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min((correct / Math.max(attempted, 1)) * 100, 100)}%` }]} /></View>
        <Text style={styles.progressText}>दररोज थोडा सराव, मोठी प्रगती!</Text>
        <Pressable testID="back-to-home" onPress={onHome} style={({ pressed }) => [styles.homeButton, pressed && styles.pressed]}><Feather name="home" size={22} color="#FFFFFF" /><Text style={styles.homeButtonText}>घरी चला</Text></Pressable>
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
  iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 22, paddingTop: 30, flexGrow: 1 },
  welcomeBlock: { alignItems: 'center', marginBottom: 12 },
  kicker: { fontSize: 18, color: '#E58A2B', fontWeight: '700', marginBottom: 10 },
  heroTitle: { fontSize: 30, lineHeight: 38, color: '#17324D', fontWeight: '800', textAlign: 'center' },
  heroSubtitle: { fontSize: 17, color: '#5C6B76', marginTop: 6 },
  sunIllustration: { alignSelf: 'center', width: 112, height: 112, borderRadius: 56, backgroundColor: '#FFF0B8', alignItems: 'center', justifyContent: 'center', marginVertical: 22 },
  studentList: { gap: 14 },
  studentCard: { backgroundColor: '#FFFFFF', minHeight: 86, borderRadius: 22, padding: 14, flexDirection: 'row', alignItems: 'center', shadowColor: '#17324D', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  cardPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  avatar: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  studentCopy: { flex: 1, marginLeft: 16 },
  studentName: { fontSize: 23, color: '#17324D', fontWeight: '800' },
  studentRoman: { color: '#7A8994', fontSize: 14, marginTop: 2 },
  offlinePill: { alignSelf: 'center', marginTop: 'auto', paddingTop: 26, flexDirection: 'row', alignItems: 'center', gap: 7 },
  offlineText: { color: '#397B71', fontSize: 13, fontWeight: '600' },
  modeList: { gap: 16, marginTop: 28 },
  modeCard: { backgroundColor: '#FFFFFF', minHeight: 105, borderRadius: 22, borderLeftWidth: 7, padding: 16, flexDirection: 'row', alignItems: 'center', shadowColor: '#17324D', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  modeIcon: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  modeCopy: { flex: 1, marginLeft: 15 },
  modeTitle: { color: '#17324D', fontSize: 19, fontWeight: '800' },
  modeMarathi: { color: '#6D7C87', fontSize: 16, marginTop: 5 },
  tipCard: { backgroundColor: '#FFF0B8', borderRadius: 18, padding: 15, marginTop: 26, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipText: { flex: 1, color: '#6B571B', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  practiceContent: { paddingHorizontal: 22, paddingTop: 20, flexGrow: 1 },
  practiceMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  practiceMode: { color: '#E58A2B', fontSize: 16, fontWeight: '800' },
  questionCount: { color: '#7A8994', fontSize: 14, fontWeight: '700' },
  questionCard: { backgroundColor: '#FFFFFF', minHeight: 190, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#17324D', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  questionLabel: { color: '#7A8994', fontSize: 15, fontWeight: '700', marginBottom: 16 },
  questionText: { color: '#17324D', fontSize: 46, fontWeight: '800', letterSpacing: 1 },
  questionHint: { color: '#A1ADB4', fontSize: 14, marginTop: 12 },
  playButton: { alignSelf: 'center', marginTop: 18, paddingHorizontal: 22, minHeight: 50, borderRadius: 18, borderWidth: 2, borderColor: '#2477D4', flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  playingButton: { backgroundColor: '#2477D4' },
  playText: { color: '#2477D4', fontSize: 17, fontWeight: '800' },
  playTextActive: { color: '#FFFFFF' },
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
  actionRow: { marginTop: 15, gap: 10 },
  nextButton: { minHeight: 55, borderRadius: 18, backgroundColor: '#2477D4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  nextText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  finishButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  finishText: { color: '#7184E6', fontSize: 15, fontWeight: '800' },
  encourage: { color: '#E58A2B', fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 20 },
  summaryContent: { paddingHorizontal: 22, paddingTop: 42, alignItems: 'center', flexGrow: 1 },
  summaryIcon: { width: 112, height: 112, borderRadius: 56, backgroundColor: '#FFF0B8', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  summaryKicker: { color: '#E58A2B', fontSize: 18, fontWeight: '800' },
  summaryTitle: { color: '#17324D', fontSize: 34, fontWeight: '800', marginTop: 8 },
  summarySubtitle: { color: '#6D7C87', fontSize: 16, marginTop: 8 },
  statsCard: { width: '100%', marginTop: 34, backgroundColor: '#FFFFFF', borderRadius: 24, paddingVertical: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', shadowColor: '#17324D', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  stat: { alignItems: 'center', flex: 1 },
  statNumber: { color: '#2477D4', fontSize: 42, fontWeight: '800' },
  statLabel: { color: '#6D7C87', fontSize: 14, marginTop: 5 },
  statDivider: { width: 1, height: 55, backgroundColor: '#DDE7EE' },
  progressTrack: { width: '100%', height: 12, borderRadius: 6, backgroundColor: '#E7F5FF', marginTop: 27, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 6, backgroundColor: '#48A995' },
  progressText: { color: '#397B71', fontWeight: '700', marginTop: 12 },
  homeButton: { marginTop: 'auto', width: '100%', minHeight: 58, borderRadius: 19, backgroundColor: '#2477D4', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  homeButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});