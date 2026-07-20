import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookHeart,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Compass,
  FileText,
  HeartHandshake,
  Home,
  Lightbulb,
  Link2,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  UserRound,
  X,
} from 'lucide-react-native';
import { analyzeJournal } from './src/services/journal';
import { clearJournalState, emptyJournalState, loadJournalState, saveJournalState } from './src/storage/journal';
import type { JournalEntry, JournalState, PatternInsight, SkillId } from './src/types/journal';

type Tab = 'today' | 'journal' | 'patterns' | 'skills' | 'you';
type Screen = Tab | 'editor';
type EntryDraft = { title: string; body: string; mood?: number; lifeAreas: string[]; analyze: boolean };

const C = {
  canvas: '#F7F3EC',
  paper: '#FFFDFC',
  ink: '#1E2926',
  muted: '#68726E',
  line: '#DDDCD4',
  teal: '#176B68',
  tealSoft: '#DDEBE7',
  coral: '#D96952',
  coralSoft: '#F7E3DC',
  yellow: '#E9B949',
  yellowSoft: '#F8EDCB',
  green: '#557C5C',
  danger: '#A13D35',
  dangerSoft: '#F9E2DE',
};

const MOODS = [
  { value: 1, label: 'Low' },
  { value: 2, label: 'Heavy' },
  { value: 3, label: 'Steady' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Bright' },
];

const LIFE_AREAS = ['Dating', 'Relationships', 'Friends', 'Work', 'Family', 'Habits'];

const SKILLS: Record<SkillId, { title: string; purpose: string; steps: string[] }> = {
  pace_check: {
    title: 'Check the pace',
    purpose: 'Separate excitement from the speed of your next commitment.',
    steps: ['List what has changed recently.', 'Name the pace that would feel sustainable.', 'Wait 24 hours before the next major commitment.'],
  },
  boundary_builder: {
    title: 'Build a clear boundary',
    purpose: 'Turn a private preference into a limit you can communicate and keep.',
    steps: ['State what you need without explaining it away.', 'Make one specific request.', 'Decide what you will do if the limit is ignored.'],
  },
  decision_pause: {
    title: 'Pause a pressured decision',
    purpose: 'Reduce urgency before making a choice that is difficult to reverse.',
    steps: ['Name what feels urgent.', 'Separate reversible from irreversible consequences.', 'Choose a specific time to reconsider.'],
  },
  conflict_repair: {
    title: 'Repair after conflict',
    purpose: 'Move from blame toward one observable issue and a concrete request.',
    steps: ['Describe what happened without motive or character labels.', 'Name the impact on you.', 'Ask for one specific change.'],
  },
  assumption_check: {
    title: 'Check the story',
    purpose: 'Separate what you know from the meaning your mind added.',
    steps: ['Write only the observable facts.', 'Write your current interpretation.', 'List two other plausible explanations.'],
  },
  routine_protection: {
    title: 'Protect what keeps you grounded',
    purpose: 'Notice when a new priority begins displacing the life you value.',
    steps: ['Name the routine or relationship that shifted.', 'Decide whether that change was intentional.', 'Put one protected activity back on your calendar.'],
  },
  burnout_check: {
    title: 'Check your load',
    purpose: 'Compare commitments added with recovery removed.',
    steps: ['List what you added this week.', 'List what recovery time disappeared.', 'Renegotiate or remove one commitment.'],
  },
};

function formatDay(value: string) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(value));
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'long' }).format(new Date(value));
}

function entryTitle(entry: Pick<JournalEntry, 'title' | 'body'>) {
  return entry.title.trim() || entry.body.trim().split(/\s+/).slice(0, 7).join(' ');
}

function IconButton({ children, onPress, label }: { children: React.ReactNode; onPress?: () => void; label: string }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Pressable onPress={onPress} hitSlop={10}><Text style={styles.textAction}>{action}</Text></Pressable> : null}
    </View>
  );
}

function EmptyState({ icon, title, body, action, onPress }: { icon: React.ReactNode; title: string; body: string; action?: string; onPress?: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>{icon}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action ? <Pressable onPress={onPress} style={styles.emptyAction}><Text style={styles.emptyActionText}>{action}</Text><ArrowRight color={C.teal} size={17} /></Pressable> : null}
    </View>
  );
}

function InsightCard({ insight, onPress }: { insight: PatternInsight; onPress: () => void }) {
  const label = insight.confidence === 'strong_pattern' ? 'Strong pattern' : insight.confidence === 'recurring_pattern' ? 'Recurring pattern' : 'Early signal';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.insightCard, pressed && styles.pressed]}>
      <View style={styles.insightMeta}><View style={styles.signalDot} /><Text style={styles.insightLabel}>{label}</Text><Text style={styles.evidenceCount}>{insight.evidenceEntryIds.length} entries</Text></View>
      <Text style={styles.insightTitle}>{insight.title}</Text>
      <Text style={styles.insightObservation} numberOfLines={3}>{insight.observation}</Text>
      <View style={styles.insightFooter}><Text style={styles.skillLink}>{SKILLS[insight.skillId].title}</Text><ChevronRight color={C.teal} size={18} /></View>
    </Pressable>
  );
}

function TodayScreen({ state, onWrite, onJournal, onInsight }: { state: JournalState; onWrite: () => void; onJournal: () => void; onInsight: (insight: PatternInsight) => void }) {
  const latest = state.entries[0];
  const priority = state.insights[0];
  const today = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()).toUpperCase();

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.brandRow}>
        <View><Text style={styles.brand}>Within</Text><Text style={styles.eyebrow}>{today}</Text></View>
        <View style={styles.privateBadge}><LockKeyhole color={C.teal} size={13} /><Text style={styles.privateBadgeText}>Private journal</Text></View>
      </View>

      <View style={styles.hero}>
        <Image source={require('./assets/reflection-journal.png')} style={styles.heroImage} resizeMode="cover" />
        <View style={styles.heroShade} />
        <View style={styles.heroContent}>
          <Text style={styles.heroKicker}>TODAY'S ENTRY</Text>
          <Text style={styles.heroTitle}>Write what happened. Keep the meaning yours.</Text>
          <Pressable onPress={onWrite} style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}>
            <BookOpen color={C.paper} size={19} /><Text style={styles.heroButtonText}>{latest && new Date(latest.createdAt).toDateString() === new Date().toDateString() ? 'Continue writing' : 'Write about today'}</Text><ArrowRight color={C.paper} size={18} />
          </Pressable>
        </View>
      </View>

      {priority ? (
        <><SectionHeader title="Worth noticing" action="All patterns" onPress={() => onInsight(priority)} /><InsightCard insight={priority} onPress={() => onInsight(priority)} /></>
      ) : (
        <View style={styles.buildingBand}>
          <TrendingUp color={C.teal} size={21} />
          <View style={styles.flex}><Text style={styles.buildingTitle}>Patterns need time</Text><Text style={styles.bodySmall}>{state.entries.length < 2 ? 'After a few entries, Within can compare repeated behavior without guessing from one day.' : 'Your entries are being compared quietly. Weak signals stay private until there is enough evidence.'}</Text></View>
        </View>
      )}

      <SectionHeader title="Recent journal" action={state.entries.length ? 'View all' : undefined} onPress={onJournal} />
      {latest ? (
        <Pressable onPress={onJournal} style={({ pressed }) => [styles.entryRow, pressed && styles.pressed]}>
          <View style={styles.dateTile}><Text style={styles.dateDay}>{new Date(latest.createdAt).getDate()}</Text><Text style={styles.dateMonth}>{new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(latest.createdAt)).toUpperCase()}</Text></View>
          <View style={styles.flex}><Text style={styles.entryTitle} numberOfLines={1}>{entryTitle(latest)}</Text><Text style={styles.entryPreview} numberOfLines={2}>{latest.body}</Text></View>
          {latest.analysisState === 'analyzing' ? <ActivityIndicator color={C.teal} size="small" /> : <ChevronRight color={C.muted} size={19} />}
        </Pressable>
      ) : (
        <EmptyState icon={<FileText color={C.teal} size={25} />} title="Your journal starts here" body="There are no streaks to protect and nothing to perform. Begin with one honest entry." action="Create first entry" onPress={onWrite} />
      )}

      <View style={styles.principleBand}><ShieldCheck color={C.green} size={22} /><Text style={styles.principleText}>You write freely. AI analysis is structured, optional, and never changes your words.</Text></View>
    </ScrollView>
  );
}

function JournalScreen({ entries, onWrite, onEdit, onDelete, onAnalyze }: { entries: JournalEntry[]; onWrite: () => void; onEdit: (entry: JournalEntry) => void; onDelete: (entry: JournalEntry) => void; onAnalyze: (entry: JournalEntry) => void }) {
  const [query, setQuery] = useState('');
  const filtered = entries.filter((entry) => `${entry.title} ${entry.body} ${entry.lifeAreas.join(' ')}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.screenHeader}><View><Text style={styles.screenTitle}>Journal</Text><Text style={styles.lead}>Your words remain the source of truth.</Text></View><IconButton label="New journal entry" onPress={onWrite}><Plus color={C.ink} size={23} /></IconButton></View>
      {entries.length ? <View style={styles.searchWrap}><Search color={C.muted} size={18} /><TextInput value={query} onChangeText={setQuery} placeholder="Search your entries" placeholderTextColor={C.muted} style={styles.searchInput} /></View> : null}
      {filtered.length ? filtered.map((entry) => (
        <Pressable key={entry.id} onPress={() => onEdit(entry)} style={({ pressed }) => [styles.journalItem, pressed && styles.pressed]}>
          <View style={styles.journalItemTop}><Text style={styles.journalDate}>{formatFullDate(entry.createdAt)}</Text><Pressable accessibilityLabel="Delete entry" hitSlop={12} onPress={() => onDelete(entry)}><Trash2 color={C.muted} size={17} /></Pressable></View>
          <Text style={styles.journalTitle}>{entryTitle(entry)}</Text>
          <Text style={styles.journalPreview} numberOfLines={3}>{entry.body}</Text>
          <View style={styles.journalMeta}>
            {entry.lifeAreas.map((area) => <View key={area} style={styles.tag}><Text style={styles.tagText}>{area}</Text></View>)}
            {entry.analysisState === 'analyzed' ? <View style={styles.analyzedMark}><Sparkles color={C.teal} size={12} /><Text style={styles.analyzedText}>Analyzed</Text></View> : null}
            {entry.analysisState === 'failed' ? <Pressable onPress={(event) => { event.stopPropagation(); onAnalyze(entry); }} style={styles.retryAnalysis}><Sparkles color={C.coral} size={12} /><Text style={styles.analysisFailed}>Retry analysis</Text></Pressable> : null}
          </View>
        </Pressable>
      )) : <EmptyState icon={<BookHeart color={C.teal} size={26} />} title={entries.length ? 'No matching entries' : 'A journal, not a conversation'} body={entries.length ? 'Try a different search.' : 'Write in your own words. Within will never reply beneath each entry like a chatbot.'} action={entries.length ? undefined : 'Write first entry'} onPress={onWrite} />}
    </ScrollView>
  );
}

function PatternsScreen({ insights, onInsight }: { insights: PatternInsight[]; onInsight: (insight: PatternInsight) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.screenTitle}>Patterns</Text>
      <Text style={styles.lead}>Evidence appears here only after it repeats across separate entries.</Text>
      {insights.length ? insights.map((insight) => <InsightCard key={insight.id} insight={insight} onPress={() => onInsight(insight)} />) : (
        <EmptyState icon={<TrendingUp color={C.teal} size={27} />} title="Nothing strong enough yet" body="That is a valid result. Within will not turn one emotional day into a story about your life." />
      )}
      <View style={styles.patternRule}><Lightbulb color={C.coral} size={20} /><View style={styles.flex}><Text style={styles.ruleTitle}>How a pattern earns your attention</Text><Text style={styles.bodySmall}>It needs at least two source entries, a repeated behavior or trend, and language that does not claim certainty about you or another person.</Text></View></View>
    </ScrollView>
  );
}

function SkillsScreen({ recommended }: { recommended?: SkillId }) {
  const ordered = Object.entries(SKILLS) as [SkillId, (typeof SKILLS)[SkillId]][];
  if (recommended) ordered.sort(([a]) => a === recommended ? -1 : 1);
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.screenTitle}>Skills</Text>
      <Text style={styles.lead}>Short practices for decisions that are easier to understand than to execute.</Text>
      {ordered.map(([id, skill], index) => (
        <View key={id} style={styles.skillRow}>
          <View style={[styles.skillNumber, recommended === id && styles.skillNumberRecommended]}><Text style={[styles.skillNumberText, recommended === id && styles.skillNumberTextRecommended]}>{index + 1}</Text></View>
          <View style={styles.flex}>{recommended === id ? <Text style={styles.recommendedLabel}>RECOMMENDED FOR A PATTERN</Text> : null}<Text style={styles.skillTitle}>{skill.title}</Text><Text style={styles.bodySmall}>{skill.purpose}</Text></View>
          <ChevronRight color={C.muted} size={19} />
        </View>
      ))}
      <Text style={styles.packAttribution}>Within Relationships · Knowledge pack 1.0.0</Text>
    </ScrollView>
  );
}

function YouScreen({ state, onAddGoal, onRemoveGoal, onClear }: { state: JournalState; onAddGoal: (goal: string) => void; onRemoveGoal: (goal: string) => void; onClear: () => void }) {
  const [goal, setGoal] = useState('');
  const add = () => { if (goal.trim()) { onAddGoal(goal.trim()); setGoal(''); } };
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.screenTitle}>You</Text>
      <Text style={styles.lead}>Give patterns context the AI should never guess.</Text>
      <SectionHeader title="Values and boundaries" />
      <Text style={styles.helpText}>Examples: Keep seeing friends while dating. Do not make major commitments under pressure.</Text>
      <View style={styles.goalInputRow}><TextInput value={goal} onChangeText={setGoal} onSubmitEditing={add} placeholder="Add something you want to protect" placeholderTextColor={C.muted} style={styles.goalInput} maxLength={240} /><Pressable accessibilityLabel="Add goal" onPress={add} style={styles.addGoal}><Plus color={C.paper} size={20} /></Pressable></View>
      {state.goals.map((item) => <View key={item} style={styles.goalRow}><Target color={C.coral} size={19} /><Text style={styles.goalText}>{item}</Text><Pressable accessibilityLabel="Remove goal" hitSlop={12} onPress={() => onRemoveGoal(item)}><X color={C.muted} size={18} /></Pressable></View>)}
      {!state.goals.length ? <Text style={styles.noGoals}>No goals added. Pattern language will remain general.</Text> : null}

      <SectionHeader title="Data and AI" />
      <View style={styles.settingsBand}><LockKeyhole color={C.teal} size={21} /><View style={styles.flex}><Text style={styles.settingTitle}>Stored on this device</Text><Text style={styles.bodySmall}>{state.entries.length} journal entries · {state.insights.length} patterns</Text></View></View>
      <Pressable onPress={() => Linking.openURL('https://within-reflection-api-hiren.fly.dev/privacy')} style={styles.menuRow}><ShieldCheck color={C.teal} size={21} /><View style={styles.flex}><Text style={styles.settingTitle}>Privacy policy</Text><Text style={styles.bodySmall}>How optional AI analysis processes your writing</Text></View><ChevronRight color={C.muted} size={19} /></Pressable>
      <Pressable onPress={onClear} style={styles.destructiveRow}><Trash2 color={C.danger} size={20} /><Text style={styles.destructiveText}>Delete all local journal data</Text></Pressable>
      <Text style={styles.version}>Within prototype · No account or cloud sync</Text>
    </ScrollView>
  );
}

function EntryEditor({ entry, onClose, onSave }: { entry?: JournalEntry; onClose: () => void; onSave: (draft: EntryDraft) => void }) {
  const [title, setTitle] = useState(entry?.title ?? '');
  const [body, setBody] = useState(entry?.body ?? '');
  const [mood, setMood] = useState<number | undefined>(entry?.mood);
  const [lifeAreas, setLifeAreas] = useState<string[]>(entry?.lifeAreas ?? []);
  const [shouldAnalyze, setShouldAnalyze] = useState(entry ? entry.analysisState !== 'not_requested' : true);
  const toggleArea = (area: string) => setLifeAreas((current) => current.includes(area) ? current.filter((item) => item !== area) : [...current, area].slice(0, 6));

  return (
    <SafeAreaView style={styles.editorPage} edges={['top', 'bottom']}>
      <View style={styles.editorHeader}><IconButton label="Close editor" onPress={onClose}><ArrowLeft color={C.ink} size={22} /></IconButton><View style={styles.editorHeading}><Text style={styles.editorTitle}>{entry ? 'Edit entry' : 'Today'}</Text><Text style={styles.editorDate}>{formatFullDate(entry?.createdAt ?? new Date().toISOString())}</Text></View><View style={styles.iconPlaceholder} /></View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
          <TextInput value={title} onChangeText={setTitle} placeholder="Give today a title (optional)" placeholderTextColor="#8A918D" style={styles.titleInput} maxLength={120} />
          <TextInput value={body} onChangeText={setBody} multiline autoFocus={!entry} placeholder="What happened today? Write it as you remember it." placeholderTextColor="#8A918D" style={styles.bodyInput} maxLength={8_000} textAlignVertical="top" />
          <Text style={styles.fieldLabel}>HOW DID TODAY FEEL?</Text>
          <View style={styles.moodRow}>{MOODS.map((item) => <Pressable key={item.value} onPress={() => setMood(mood === item.value ? undefined : item.value)} style={[styles.moodOption, mood === item.value && styles.moodSelected]}><Text style={[styles.moodValue, mood === item.value && styles.moodValueSelected]}>{item.value}</Text><Text style={[styles.moodLabel, mood === item.value && styles.moodLabelSelected]}>{item.label}</Text></Pressable>)}</View>
          <Text style={styles.fieldLabel}>LIFE AREAS</Text>
          <View style={styles.areaWrap}>{LIFE_AREAS.map((area) => <Pressable key={area} onPress={() => toggleArea(area)} style={[styles.areaChip, lifeAreas.includes(area) && styles.areaChipSelected]}>{lifeAreas.includes(area) ? <Check color={C.teal} size={14} /> : null}<Text style={[styles.areaText, lifeAreas.includes(area) && styles.areaTextSelected]}>{area}</Text></Pressable>)}</View>
          <View style={styles.analysisSetting}><View style={styles.analysisIcon}><Sparkles color={C.teal} size={20} /></View><View style={styles.flex}><Text style={styles.analysisTitle}>Look for patterns</Text><Text style={styles.bodySmall}>Send this entry and limited recent history for structured AI analysis.</Text></View><Switch value={shouldAnalyze} onValueChange={setShouldAnalyze} trackColor={{ false: '#C7CBC8', true: '#7BA9A1' }} thumbColor={shouldAnalyze ? C.teal : '#F5F5F3'} /></View>
          <Text style={styles.editorPrivacy}>Analysis can be wrong. It cannot diagnose, predict outcomes, or decide what you should do.</Text>
        </ScrollView>
        <View style={styles.editorFooter}><Pressable disabled={!body.trim()} onPress={() => onSave({ title, body: body.trim(), mood, lifeAreas, analyze: shouldAnalyze })} style={[styles.saveButton, !body.trim() && styles.disabled]}><Text style={styles.saveButtonText}>{entry ? 'Save changes' : 'Save journal entry'}</Text><Check color={C.paper} size={19} /></Pressable></View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InsightModal({ insight, entries, onClose, onDismiss, onOpenSkills }: { insight?: PatternInsight; entries: JournalEntry[]; onClose: () => void; onDismiss: () => void; onOpenSkills: () => void }) {
  if (!insight) return null;
  const evidence = insight.evidenceEntryIds.map((id) => entries.find((entry) => entry.id === id)).filter((entry): entry is JournalEntry => Boolean(entry));
  const skill = SKILLS[insight.skillId];
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.detailPage} edges={['top', 'bottom']}>
        <View style={styles.detailHeader}><IconButton label="Close insight" onPress={onClose}><ArrowLeft color={C.ink} size={22} /></IconButton><Text style={styles.headerTitle}>Pattern evidence</Text><View style={styles.iconPlaceholder} /></View>
        <ScrollView contentContainerStyle={styles.detailContent}>
          <View style={styles.confidencePill}><TrendingUp color={C.teal} size={14} /><Text style={styles.confidenceText}>{insight.confidence.replace('_', ' ')}</Text></View>
          <Text style={styles.detailTitle}>{insight.title}</Text>
          <Text style={styles.detailObservation}>{insight.observation}</Text>
          {insight.goalConnection ? <View style={styles.goalConnection}><Target color={C.coral} size={19} /><Text style={styles.goalConnectionText}>{insight.goalConnection}</Text></View> : null}
          <SectionHeader title="Why this appeared" />
          {evidence.map((entry) => <View key={entry.id} style={styles.evidenceRow}><View style={styles.evidenceDate}><CalendarDays color={C.teal} size={18} /><Text style={styles.evidenceDateText}>{formatDay(entry.createdAt)}</Text></View><View style={styles.flex}><Text style={styles.evidenceTitle}>{entryTitle(entry)}</Text><Text style={styles.bodySmall} numberOfLines={3}>{entry.body}</Text></View></View>)}
          <SectionHeader title="A skill to try" />
          <View style={styles.skillDetail}><ClipboardCheck color={C.teal} size={24} /><View style={styles.flex}><Text style={styles.skillDetailTitle}>{skill.title}</Text><Text style={styles.bodySmall}>{skill.purpose}</Text></View></View>
          {skill.steps.map((step, index) => <View key={step} style={styles.stepRow}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View><Text style={styles.stepText}>{step}</Text></View>)}
          <Pressable onPress={onOpenSkills} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Open skills</Text><ArrowRight color={C.paper} size={18} /></Pressable>
          <View style={styles.feedbackRow}><Pressable onPress={onClose} style={styles.feedbackButton}><Check color={C.teal} size={17} /><Text style={styles.feedbackText}>Helpful</Text></Pressable><Pressable onPress={onDismiss} style={styles.feedbackButton}><X color={C.muted} size={17} /><Text style={styles.feedbackText}>Not accurate</Text></Pressable></View>
          <Text style={styles.packAttribution}>Source: Within Relationships · Pack 1.0.0</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const tabs = [
    { id: 'today' as Tab, label: 'Today', icon: Home },
    { id: 'journal' as Tab, label: 'Journal', icon: BookOpen },
    { id: 'patterns' as Tab, label: 'Patterns', icon: TrendingUp },
    { id: 'skills' as Tab, label: 'Skills', icon: Compass },
    { id: 'you' as Tab, label: 'You', icon: UserRound },
  ];
  return <View style={styles.tabBar}>{tabs.map((tab) => { const Icon = tab.icon; const selected = active === tab.id; return <Pressable key={tab.id} onPress={() => onChange(tab.id)} style={styles.tabItem}><View style={[styles.tabIcon, selected && styles.tabIconSelected]}><Icon color={selected ? C.teal : C.muted} size={21} /></View><Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{tab.label}</Text></Pressable>; })}</View>;
}

function AppContent() {
  const [state, setState] = useState<JournalState>(emptyJournalState);
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<Screen>('today');
  const [editingEntry, setEditingEntry] = useState<JournalEntry | undefined>();
  const [selectedInsight, setSelectedInsight] = useState<PatternInsight | undefined>();
  const [pendingDraft, setPendingDraft] = useState<EntryDraft | undefined>();
  const [consentVisible, setConsentVisible] = useState(false);
  const [safetyMessage, setSafetyMessage] = useState<string | undefined>();

  useEffect(() => { loadJournalState().then((loaded) => { setState(loaded); setHydrated(true); }); }, []);
  useEffect(() => { if (hydrated) void saveJournalState(state); }, [hydrated, state]);

  const activeTab: Tab = screen === 'editor' ? 'journal' : screen;
  const recommended = state.insights[0]?.skillId;
  const openNewEntry = () => { setEditingEntry(undefined); setScreen('editor'); };
  const openEdit = (entry: JournalEntry) => { setEditingEntry(entry); setScreen('editor'); };

  const runAnalysis = async (entries: JournalEntry[], currentEntryId: string, notifyOnFailure = false) => {
    try {
      const response = await analyzeJournal(entries, currentEntryId, state.goals);
      if (response.safetyAction !== 'continue') {
        setSafetyMessage(response.supportMessage ?? 'Please contact a trusted person or local emergency support.');
        setState((current) => ({ ...current, entries: current.entries.map((entry) => entry.id === currentEntryId ? { ...entry, analysisState: 'not_requested' } : entry) }));
        return;
      }
      if (!response.analysis) throw new Error('Analysis response was empty');
      const createdAt = new Date().toISOString();
      setState((current) => {
        const incoming = response.analysis!.patterns.map((pattern) => ({ ...pattern, createdAt }));
        const incomingIds = new Set(incoming.map((pattern) => pattern.id));
        return {
          ...current,
          entries: current.entries.map((entry) => entry.id === currentEntryId ? { ...entry, analysisState: 'analyzed', summary: response.analysis!.entrySummary, themes: response.analysis!.themes } : entry),
          insights: [...incoming, ...current.insights.filter((insight) => !incomingIds.has(insight.id))],
        };
      });
    } catch {
      setState((current) => ({ ...current, entries: current.entries.map((entry) => entry.id === currentEntryId ? { ...entry, analysisState: 'failed' } : entry) }));
      if (notifyOnFailure) Alert.alert('Analysis is still unavailable', 'Your entry is safely stored on this device. Try again in a moment.');
    }
  };

  const persistDraft = (draft: EntryDraft, analyze: boolean) => {
    const now = new Date().toISOString();
    const id = editingEntry?.id ?? `entry_${Date.now()}`;
    const entry: JournalEntry = {
      id,
      createdAt: editingEntry?.createdAt ?? now,
      updatedAt: now,
      title: draft.title.trim(),
      body: draft.body,
      mood: draft.mood,
      lifeAreas: draft.lifeAreas,
      analysisState: analyze ? 'analyzing' : 'not_requested',
      summary: editingEntry?.summary,
      themes: editingEntry?.themes,
    };
    const entries = [entry, ...state.entries.filter((item) => item.id !== id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setState((current) => ({
      ...current,
      entries,
      insights: current.insights.filter((insight) => !insight.evidenceEntryIds.includes(id)),
    }));
    setScreen('journal');
    setEditingEntry(undefined);
    if (analyze) void runAnalysis(entries, id);
  };

  const handleSave = (draft: EntryDraft) => {
    if (draft.analyze && !state.aiConsent) {
      setPendingDraft(draft);
      setConsentVisible(true);
      return;
    }
    persistDraft(draft, draft.analyze);
  };

  const retryAnalysis = (entry: JournalEntry) => {
    const entries = state.entries.map((item) => item.id === entry.id ? { ...item, analysisState: 'analyzing' as const } : item);
    setState((current) => ({ ...current, entries }));
    void runAnalysis(entries, entry.id, true);
  };

  const acceptConsent = () => {
    setState((current) => ({ ...current, aiConsent: true }));
    setConsentVisible(false);
    if (pendingDraft) persistDraft(pendingDraft, true);
    setPendingDraft(undefined);
  };

  const saveWithoutAi = () => {
    setConsentVisible(false);
    if (pendingDraft) persistDraft(pendingDraft, false);
    setPendingDraft(undefined);
  };

  const deleteEntry = (entry: JournalEntry) => Alert.alert('Delete this entry?', 'Its evidence will also be removed from any patterns.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => setState((current) => ({ ...current, entries: current.entries.filter((item) => item.id !== entry.id), insights: current.insights.filter((insight) => !insight.evidenceEntryIds.includes(entry.id)) })) },
  ]);

  const clearAll = () => Alert.alert('Delete all journal data?', 'This permanently removes entries, patterns, goals, and AI consent stored on this device.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete everything', style: 'destructive', onPress: () => { void clearJournalState(); setState(emptyJournalState); } },
  ]);

  if (!hydrated) return <View style={styles.loading}><ActivityIndicator color={C.teal} /><Text style={styles.loadingText}>Opening your journal...</Text></View>;
  if (screen === 'editor') return <EntryEditor entry={editingEntry} onClose={() => setScreen('journal')} onSave={handleSave} />;

  return (
    <SafeAreaView style={styles.app} edges={['top']}>
      <View style={styles.flex}>
        {screen === 'today' ? <TodayScreen state={state} onWrite={openNewEntry} onJournal={() => setScreen('journal')} onInsight={setSelectedInsight} /> : null}
        {screen === 'journal' ? <JournalScreen entries={state.entries} onWrite={openNewEntry} onEdit={openEdit} onDelete={deleteEntry} onAnalyze={retryAnalysis} /> : null}
        {screen === 'patterns' ? <PatternsScreen insights={state.insights} onInsight={setSelectedInsight} /> : null}
        {screen === 'skills' ? <SkillsScreen recommended={recommended} /> : null}
        {screen === 'you' ? <YouScreen state={state} onAddGoal={(goal) => setState((current) => ({ ...current, goals: [...current.goals, goal].slice(0, 5) }))} onRemoveGoal={(goal) => setState((current) => ({ ...current, goals: current.goals.filter((item) => item !== goal) }))} onClear={clearAll} /> : null}
      </View>
      <TabBar active={activeTab} onChange={setScreen} />

      <InsightModal insight={selectedInsight} entries={state.entries} onClose={() => setSelectedInsight(undefined)} onDismiss={() => { if (selectedInsight) setState((current) => ({ ...current, insights: current.insights.filter((item) => item.id !== selectedInsight.id) })); setSelectedInsight(undefined); }} onOpenSkills={() => { setSelectedInsight(undefined); setScreen('skills'); }} />

      <Modal visible={consentVisible} transparent animationType="fade" onRequestClose={() => setConsentVisible(false)}>
        <View style={styles.modalBackdrop}><View style={styles.consentDialog}><View style={styles.consentIcon}><Sparkles color={C.teal} size={25} /></View><Text style={styles.consentTitle}>Analyze this journal with AI?</Text><Text style={styles.consentCopy}>This entry and up to 19 recent entries will be sent to Within's API and Google Gemini. The AI returns structured themes and pattern candidates, not a conversation.</Text><Text style={styles.consentCopy}>AI can misread context. It cannot diagnose people, predict outcomes, or make relationship decisions for you.</Text><Pressable onPress={() => Linking.openURL('https://within-reflection-api-hiren.fly.dev/privacy')} style={styles.consentLink}><LockKeyhole color={C.teal} size={16} /><Text style={styles.consentLinkText}>Read privacy policy</Text></Pressable><Pressable onPress={acceptConsent} style={styles.primaryButton}><Text style={styles.primaryButtonText}>I agree to AI analysis</Text><ArrowRight color={C.paper} size={18} /></Pressable><Pressable onPress={saveWithoutAi} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Save without AI</Text></Pressable></View></View>
      </Modal>

      <Modal visible={Boolean(safetyMessage)} transparent animationType="fade" onRequestClose={() => setSafetyMessage(undefined)}>
        <View style={styles.modalBackdrop}><View style={styles.consentDialog}><View style={styles.safetyIcon}><AlertTriangle color={C.danger} size={27} /></View><Text style={styles.consentTitle}>Contact a person now</Text><Text style={styles.consentCopy}>{safetyMessage}</Text><Pressable onPress={() => Linking.openURL('tel:112')} style={styles.dangerButton}><Text style={styles.primaryButtonText}>Call emergency services</Text></Pressable><Pressable onPress={() => setSafetyMessage(undefined)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Close</Text></Pressable></View></View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><StatusBar style="dark" /><AppContent /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.canvas }, flex: { flex: 1 }, pressed: { opacity: 0.76 }, loading: { flex: 1, backgroundColor: C.canvas, alignItems: 'center', justifyContent: 'center', gap: 12 }, loadingText: { color: C.muted, fontSize: 14 },
  page: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }, brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }, brand: { color: C.ink, fontSize: 29, fontWeight: '800' }, eyebrow: { color: C.teal, fontSize: 10, fontWeight: '800', marginTop: 4 }, privateBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 31, backgroundColor: C.tealSoft, borderRadius: 16 }, privateBadgeText: { color: C.teal, fontSize: 10, fontWeight: '800' },
  hero: { height: 320, borderRadius: 8, overflow: 'hidden', backgroundColor: C.green }, heroImage: { position: 'absolute', inset: 0, width: '100%', height: '100%' }, heroShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,36,31,0.42)' }, heroContent: { flex: 1, justifyContent: 'flex-end', padding: 20 }, heroKicker: { color: C.paper, fontSize: 10, fontWeight: '800', marginBottom: 9 }, heroTitle: { color: C.paper, fontSize: 28, lineHeight: 34, fontWeight: '700', maxWidth: 310, marginBottom: 18 }, heroButton: { minHeight: 51, paddingHorizontal: 16, backgroundColor: C.teal, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 11 }, heroButtonText: { color: C.paper, fontSize: 15, fontWeight: '800', flex: 1, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 27, marginBottom: 12 }, sectionTitle: { color: C.ink, fontSize: 18, fontWeight: '700' }, textAction: { color: C.teal, fontSize: 13, fontWeight: '800' },
  buildingBand: { marginTop: 16, padding: 15, backgroundColor: C.tealSoft, borderRadius: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, buildingTitle: { color: C.ink, fontSize: 15, fontWeight: '700', marginBottom: 3 }, bodySmall: { color: C.muted, fontSize: 13, lineHeight: 19 }, principleBand: { marginTop: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 11 }, principleText: { color: C.green, fontSize: 12, lineHeight: 18, fontWeight: '600', flex: 1 },
  insightCard: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 16, marginBottom: 12 }, insightMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 }, signalDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.coral, marginRight: 7 }, insightLabel: { color: C.coral, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', flex: 1 }, evidenceCount: { color: C.muted, fontSize: 10, fontWeight: '700' }, insightTitle: { color: C.ink, fontSize: 19, lineHeight: 24, fontWeight: '700', marginBottom: 7 }, insightObservation: { color: C.muted, fontSize: 14, lineHeight: 21 }, insightFooter: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line, flexDirection: 'row', alignItems: 'center' }, skillLink: { color: C.teal, fontSize: 13, fontWeight: '800', flex: 1 },
  entryRow: { minHeight: 104, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13 }, dateTile: { width: 43, height: 52, borderRadius: 5, backgroundColor: C.coralSoft, alignItems: 'center', justifyContent: 'center' }, dateDay: { color: C.coral, fontSize: 18, fontWeight: '800' }, dateMonth: { color: C.coral, fontSize: 9, fontWeight: '800' }, entryTitle: { color: C.ink, fontSize: 15, fontWeight: '700', marginBottom: 4 }, entryPreview: { color: C.muted, fontSize: 12, lineHeight: 17 },
  emptyState: { paddingVertical: 34, paddingHorizontal: 24, alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.line }, emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.tealSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }, emptyTitle: { color: C.ink, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 7 }, emptyBody: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 310 }, emptyAction: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 15 }, emptyActionText: { color: C.teal, fontSize: 14, fontWeight: '800' },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }, screenHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, screenTitle: { color: C.ink, fontSize: 29, fontWeight: '800' }, lead: { color: C.muted, fontSize: 15, lineHeight: 22, maxWidth: 340, marginTop: 5, marginBottom: 20 },
  searchWrap: { height: 48, borderWidth: 1, borderColor: C.line, borderRadius: 7, backgroundColor: C.paper, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 9, marginBottom: 14 }, searchInput: { flex: 1, color: C.ink, fontSize: 14, height: '100%' }, journalItem: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 8, padding: 16, marginBottom: 12 }, journalItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, journalDate: { color: C.teal, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }, journalTitle: { color: C.ink, fontSize: 18, lineHeight: 23, fontWeight: '700', marginBottom: 6 }, journalPreview: { color: C.muted, fontSize: 14, lineHeight: 21 }, journalMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 13 }, tag: { paddingHorizontal: 9, paddingVertical: 5, backgroundColor: C.tealSoft, borderRadius: 12 }, tagText: { color: C.teal, fontSize: 10, fontWeight: '700' }, analyzedMark: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' }, analyzedText: { color: C.teal, fontSize: 10, fontWeight: '700' }, retryAnalysis: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }, analysisFailed: { color: C.coral, fontSize: 10, fontWeight: '700' },
  patternRule: { marginTop: 21, paddingTop: 19, borderTopWidth: 1, borderTopColor: C.line, flexDirection: 'row', alignItems: 'flex-start', gap: 11 }, ruleTitle: { color: C.ink, fontSize: 14, fontWeight: '700', marginBottom: 4 }, skillRow: { minHeight: 104, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 13 }, skillNumber: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' }, skillNumberRecommended: { backgroundColor: C.teal, borderColor: C.teal }, skillNumberText: { color: C.muted, fontSize: 13, fontWeight: '800' }, skillNumberTextRecommended: { color: C.paper }, recommendedLabel: { color: C.coral, fontSize: 9, fontWeight: '800', marginBottom: 3 }, skillTitle: { color: C.ink, fontSize: 16, fontWeight: '700', marginBottom: 3 }, packAttribution: { color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 24 },
  helpText: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: -4, marginBottom: 11 }, goalInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }, goalInput: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: C.line, borderRadius: 7, backgroundColor: C.paper, paddingHorizontal: 13, color: C.ink, fontSize: 13 }, addGoal: { width: 48, height: 48, borderRadius: 6, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }, goalRow: { minHeight: 58, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 11 }, goalText: { flex: 1, color: C.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' }, noGoals: { color: C.muted, fontSize: 12, fontStyle: 'italic', marginVertical: 8 }, settingsBand: { minHeight: 75, padding: 14, backgroundColor: C.tealSoft, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 11 }, settingTitle: { color: C.ink, fontSize: 14, fontWeight: '700', marginBottom: 2 }, menuRow: { minHeight: 72, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 12 }, destructiveRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10 }, destructiveText: { color: C.danger, fontSize: 13, fontWeight: '700' }, version: { color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 20 },
  editorPage: { flex: 1, backgroundColor: C.canvas }, editorHeader: { minHeight: 66, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, editorHeading: { alignItems: 'center' }, editorTitle: { color: C.ink, fontSize: 16, fontWeight: '700' }, editorDate: { color: C.muted, fontSize: 10, marginTop: 3 }, iconPlaceholder: { width: 42 }, editorContent: { padding: 20, paddingBottom: 30 }, titleInput: { color: C.ink, fontSize: 23, lineHeight: 29, fontWeight: '700', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }, bodyInput: { color: C.ink, fontSize: 17, lineHeight: 27, minHeight: 240, paddingTop: 18, paddingBottom: 20 }, fieldLabel: { color: C.teal, fontSize: 10, fontWeight: '800', marginTop: 20, marginBottom: 10 }, moodRow: { flexDirection: 'row', gap: 6 }, moodOption: { flex: 1, height: 62, borderWidth: 1, borderColor: C.line, borderRadius: 7, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' }, moodSelected: { borderColor: C.teal, backgroundColor: C.tealSoft }, moodValue: { color: C.muted, fontSize: 16, fontWeight: '800' }, moodValueSelected: { color: C.teal }, moodLabel: { color: C.muted, fontSize: 9, fontWeight: '600', marginTop: 3 }, moodLabelSelected: { color: C.teal }, areaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, areaChip: { minHeight: 36, paddingHorizontal: 12, borderWidth: 1, borderColor: C.line, borderRadius: 18, backgroundColor: C.paper, flexDirection: 'row', alignItems: 'center', gap: 5 }, areaChipSelected: { borderColor: C.teal, backgroundColor: C.tealSoft }, areaText: { color: C.muted, fontSize: 12, fontWeight: '600' }, areaTextSelected: { color: C.teal, fontWeight: '700' }, analysisSetting: { marginTop: 27, paddingTop: 18, borderTopWidth: 1, borderTopColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 11 }, analysisIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.tealSoft, alignItems: 'center', justifyContent: 'center' }, analysisTitle: { color: C.ink, fontSize: 14, fontWeight: '700', marginBottom: 2 }, editorPrivacy: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 13 }, editorFooter: { padding: 14, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.paper }, saveButton: { height: 52, borderRadius: 6, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 }, saveButtonText: { color: C.paper, fontSize: 15, fontWeight: '800' }, disabled: { opacity: 0.38 },
  detailPage: { flex: 1, backgroundColor: C.canvas }, detailHeader: { minHeight: 66, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerTitle: { color: C.ink, fontSize: 16, fontWeight: '700' }, detailContent: { padding: 22, paddingBottom: 40 }, confidencePill: { alignSelf: 'flex-start', paddingHorizontal: 10, height: 29, borderRadius: 15, backgroundColor: C.tealSoft, flexDirection: 'row', alignItems: 'center', gap: 6 }, confidenceText: { color: C.teal, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }, detailTitle: { color: C.ink, fontSize: 29, lineHeight: 35, fontWeight: '800', marginTop: 17, marginBottom: 10 }, detailObservation: { color: C.muted, fontSize: 16, lineHeight: 25 }, goalConnection: { marginTop: 18, padding: 14, borderRadius: 7, backgroundColor: C.coralSoft, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }, goalConnectionText: { color: C.ink, fontSize: 13, lineHeight: 19, flex: 1, fontWeight: '600' }, evidenceRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'flex-start', gap: 13 }, evidenceDate: { width: 53, alignItems: 'center', gap: 4 }, evidenceDateText: { color: C.teal, fontSize: 10, fontWeight: '800' }, evidenceTitle: { color: C.ink, fontSize: 14, fontWeight: '700', marginBottom: 3 }, skillDetail: { padding: 15, backgroundColor: C.tealSoft, borderRadius: 7, flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 17 }, skillDetailTitle: { color: C.ink, fontSize: 16, fontWeight: '700', marginBottom: 4 }, stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, marginBottom: 13 }, stepNumber: { width: 29, height: 29, borderRadius: 15, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' }, stepNumberText: { color: C.teal, fontSize: 11, fontWeight: '800' }, stepText: { color: C.ink, fontSize: 14, lineHeight: 21, flex: 1, paddingTop: 3 }, primaryButton: { minHeight: 52, borderRadius: 6, backgroundColor: C.teal, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 }, primaryButtonText: { color: C.paper, fontSize: 14, fontWeight: '800' }, feedbackRow: { flexDirection: 'row', gap: 9, marginTop: 10 }, feedbackButton: { flex: 1, height: 45, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, feedbackText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  tabBar: { minHeight: 69, paddingBottom: Platform.OS === 'ios' ? 7 : 4, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.paper, flexDirection: 'row' }, tabItem: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 3 }, tabIcon: { width: 35, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, tabIconSelected: { backgroundColor: C.tealSoft }, tabLabel: { color: C.muted, fontSize: 9, fontWeight: '600' }, tabLabelSelected: { color: C.teal, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(24,32,29,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 }, consentDialog: { width: '100%', maxWidth: 390, backgroundColor: C.canvas, borderRadius: 8, padding: 22 }, consentIcon: { width: 49, height: 49, borderRadius: 25, backgroundColor: C.tealSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 17 }, safetyIcon: { width: 49, height: 49, borderRadius: 25, backgroundColor: C.dangerSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 17 }, consentTitle: { color: C.ink, fontSize: 23, lineHeight: 29, fontWeight: '800', marginBottom: 10 }, consentCopy: { color: C.muted, fontSize: 14, lineHeight: 21, marginBottom: 10 }, consentLink: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4, marginBottom: 19 }, consentLinkText: { color: C.teal, fontSize: 13, fontWeight: '800' }, secondaryButton: { height: 47, alignItems: 'center', justifyContent: 'center', marginTop: 4 }, secondaryButtonText: { color: C.muted, fontSize: 13, fontWeight: '700' }, dangerButton: { minHeight: 52, borderRadius: 6, backgroundColor: C.danger, paddingHorizontal: 17, alignItems: 'center', justifyContent: 'center' },
});
