import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  Apple,
  Brain,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  CircleUserRound,
  Cloud,
  Eye,
  LogOut,
  Menu,
  MessageCircle,
  Pencil,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react-native';
import type { Session } from '@supabase/supabase-js';
import { completeReply, sendConversationMessage } from './src/services/conversation';
import {
  deleteAccount,
  getCurrentSession,
  getSignInFailureMessage,
  observeSession,
  signIn,
  signOut,
} from './src/services/account';
import {
  deleteCloudConversation,
  loadCloudConversation,
  mergeConversationStates,
  saveCloudConversation,
} from './src/services/conversationSync';
import {
  clearConversationState,
  emptyConversationState,
  loadConversationState,
  saveConversationState,
} from './src/storage/conversation';
import { applyMemoryUpserts, userCorrectMemory } from './src/services/memory';
import type {
  ConversationMessage,
  ConversationState,
  ConversationSummary,
  ConversationThread,
  DurableMemory,
  ResponseReasoning,
} from './src/types/conversation';

type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

const C = {
  canvas: '#F4F2ED',
  paper: '#FFFEFC',
  ink: '#202522',
  muted: '#67706B',
  faint: '#8B918D',
  line: '#D9DDD8',
  green: '#1F6554',
  greenSoft: '#E3EEE9',
  blue: '#315C78',
  blueSoft: '#E6EDF2',
  amber: '#8B5A18',
  amberSoft: '#F4EAD7',
  danger: '#A13D35',
  dangerSoft: '#F7E4E0',
};

const STARTERS = [
  'Something happened and I want a clearer view',
  'I keep having the same conflict',
  'I am stuck on a decision',
];

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function formatThreadTime(value: string) {
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? formatTime(value)
    : new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date);
}

function titleFromMessage(content: string) {
  const firstLine = content.trim().split(/\n/)[0]!.replace(/\s+/g, ' ');
  return firstLine.length <= 56 ? firstLine : `${firstLine.slice(0, 53).trimEnd()}...`;
}

function reasoningLabel(reasoning: ResponseReasoning) {
  if (reasoning.stance === 'challenge') return 'A direct challenge';
  if (reasoning.stance === 'escalate') return 'Why this needs more support';
  return 'Why this response';
}

function ReasoningDetails({ reasoning }: { reasoning: ResponseReasoning }) {
  const sections = [
    { label: 'From what you shared', values: reasoning.knownFacts },
    { label: 'Possible readings', values: reasoning.interpretations },
    { label: 'What could change this view', values: reasoning.missingContext },
  ].filter((section) => section.values.length > 0);

  return (
    <View style={styles.reasoning}>
      {reasoning.directChallenge ? (
        <View style={styles.challenge}>
          <Text style={styles.challengeLabel}>DIRECT CHALLENGE</Text>
          <Text style={styles.challengeText}>{reasoning.directChallenge}</Text>
        </View>
      ) : null}
      {sections.map((section) => (
        <View key={section.label} style={styles.reasoningSection}>
          <Text style={styles.reasoningHeading}>{section.label}</Text>
          {section.values.map((value) => (
            <View key={value} style={styles.reasoningRow}>
              <View style={styles.reasoningDot} />
              <Text style={styles.reasoningText}>{value}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function Message({
  message,
  expanded,
  onToggle,
}: {
  message: ConversationMessage;
  expanded: boolean;
  onToggle: () => void;
}) {
  const user = message.role === 'user';
  return (
    <View style={[styles.messageWrap, user && styles.userMessageWrap]}>
      {!user ? (
        <View style={styles.assistantMark}>
          <Eye color={C.paper} size={15} strokeWidth={2.4} />
        </View>
      ) : null}
      <View style={[styles.messageColumn, user && styles.userMessageColumn]}>
        <View style={[styles.bubble, user ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, user && styles.userMessageText]}>{message.content}</Text>
          <Text style={[styles.messageTime, user && styles.userMessageTime]}>{formatTime(message.createdAt)}</Text>
        </View>
        {message.reasoning ? (
          <>
            <Pressable accessibilityRole="button" onPress={onToggle} style={styles.reasoningToggle}>
              <Text style={styles.reasoningToggleText}>{reasoningLabel(message.reasoning)}</Text>
              {expanded ? <ChevronUp color={C.green} size={16} /> : <ChevronDown color={C.green} size={16} />}
            </Pressable>
            {expanded ? <ReasoningDetails reasoning={message.reasoning} /> : null}
          </>
        ) : null}
      </View>
    </View>
  );
}

function ConversationHome({
  threads,
  onDelete,
  onOpen,
  onStarter,
}: {
  threads: ConversationThread[];
  onDelete: (thread: ConversationThread) => void;
  onOpen: (threadId: string) => void;
  onStarter: (value: string) => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyMark}><Eye color={C.paper} size={27} strokeWidth={2.2} /></View>
      <Text style={styles.emptyTitle}>Talk it through.</Text>
      <Text style={styles.emptySubtitle}>See what you might be missing.</Text>
      {threads.length > 0 ? (
        <View style={styles.threadList}>
          <Text style={styles.threadListHeading}>YOUR CONVERSATIONS</Text>
          {threads.map((thread) => {
            const lastMessage = thread.messages.at(-1);
            return (
              <View key={thread.id} style={styles.threadRow}>
                <Pressable onPress={() => onOpen(thread.id)} style={({ pressed }) => [styles.threadMain, pressed && styles.pressed]}>
                  <View style={styles.resumeIcon}><MessageCircle color={C.paper} size={18} /></View>
                  <View style={styles.resumeText}>
                    <Text style={styles.resumeTitle} numberOfLines={1}>{thread.title}</Text>
                    <Text style={styles.threadPreview} numberOfLines={1}>{lastMessage?.content ?? 'Empty conversation'}</Text>
                    <Text style={styles.resumeMeta}>
                      {formatThreadTime(thread.updatedAt)}
                      {lastMessage?.role === 'user' ? '  ·  Needs response' : ''}
                    </Text>
                  </View>
                  <ChevronLeft color={C.green} size={20} style={styles.resumeChevron} />
                </Pressable>
                <Pressable accessibilityLabel={`Delete ${thread.title}`} onPress={() => onDelete(thread)} style={styles.threadDelete}>
                  <Trash2 color={C.faint} size={17} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
      <View style={styles.starters}>
        {STARTERS.map((starter) => (
          <Pressable key={starter} onPress={() => onStarter(starter)} style={({ pressed }) => [styles.starter, pressed && styles.pressed]}>
            <MessageCircle color={C.green} size={18} />
            <Text style={styles.starterText}>{starter}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Settings({
  visible,
  session,
  syncStatus,
  busy,
  memoryCount,
  onClose,
  onSignIn,
  onSignOut,
  onClear,
  onMemory,
  onDeleteAccount,
}: {
  visible: boolean;
  session: Session | null;
  syncStatus: SyncStatus;
  busy: boolean;
  memoryCount: number;
  onClose: () => void;
  onSignIn: (provider: 'google' | 'apple') => void;
  onSignOut: () => void;
  onClear: () => void;
  onMemory: () => void;
  onDeleteAccount: () => void;
}) {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  const syncCopy = syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Sync needs attention' : 'Conversation synced';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetEyebrow}>WITHIN</Text>
            <Text style={styles.sheetTitle}>Your account</Text>
          </View>
          <Pressable accessibilityLabel="Close settings" onPress={onClose} style={styles.iconButton}><X color={C.ink} size={22} /></Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.settingsBody}>
          {session ? (
            <View style={styles.accountBlock}>
              <CircleUserRound color={C.green} size={23} />
              <View style={styles.accountText}>
                <Text style={styles.accountName}>{session.user.user_metadata.full_name ?? session.user.email ?? 'Signed in'}</Text>
                <View style={styles.syncRow}><Cloud color={syncStatus === 'error' ? C.danger : C.green} size={14} /><Text style={styles.syncText}>{syncCopy}</Text></View>
              </View>
            </View>
          ) : (
            <View style={styles.signInBlock}>
              <Text style={styles.settingsHeading}>Keep your conversation with you</Text>
              <Text style={styles.settingsCopy}>Sign in to securely sync across your devices.</Text>
              <Pressable disabled={busy} onPress={() => onSignIn('google')} style={styles.authButton}>
                <Text style={styles.googleGlyph}>G</Text><Text style={styles.authButtonText}>Continue with Google</Text>
              </Pressable>
              {Platform.OS === 'ios' ? (
                <Pressable disabled={busy} onPress={() => onSignIn('apple')} style={[styles.authButton, styles.appleButton]}>
                  <Apple color={C.paper} fill={C.paper} size={18} /><Text style={styles.appleButtonText}>Continue with Apple</Text>
                </Pressable>
              ) : null}
            </View>
          )}

          <View style={styles.settingsSection}>
            <Text style={styles.settingsHeading}>Privacy</Text>
            <Pressable disabled={!apiUrl} onPress={() => apiUrl && Linking.openURL(`${apiUrl}/privacy`)} style={styles.settingsRow}>
              <ShieldCheck color={C.green} size={20} /><Text style={styles.settingsRowText}>Privacy policy</Text>
            </Pressable>
          </View>

          <View style={styles.settingsSection}>
            <Text style={styles.settingsHeading}>Conversations</Text>
            <Pressable onPress={onMemory} style={styles.settingsRow}>
              <Brain color={C.green} size={20} />
              <Text style={styles.settingsRowText}>Memory</Text>
              <Text style={styles.settingsRowMeta}>{memoryCount}</Text>
            </Pressable>
            <Pressable onPress={onClear} style={styles.settingsRow}>
              <Trash2 color={C.danger} size={20} /><Text style={[styles.settingsRowText, styles.dangerText]}>Clear all conversations and memory</Text>
            </Pressable>
          </View>

          {session ? (
            <View style={styles.settingsSection}>
              <Pressable disabled={busy} onPress={onSignOut} style={styles.settingsRow}>
                <LogOut color={C.ink} size={20} /><Text style={styles.settingsRowText}>Sign out</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={onDeleteAccount} style={styles.settingsRow}>
                <Trash2 color={C.danger} size={20} /><Text style={[styles.settingsRowText, styles.dangerText]}>Delete account and data</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function MemoryManager({
  visible,
  summary,
  threadTitle,
  memories,
  onClose,
  onUpdate,
  onDelete,
  onUpdateSummary,
  onDeleteSummary,
}: {
  visible: boolean;
  summary?: ConversationSummary;
  threadTitle?: string;
  memories: DurableMemory[];
  onClose: () => void;
  onUpdate: (memory: DurableMemory) => void;
  onDelete: (memoryId: string) => void;
  onUpdateSummary: (text: string) => void;
  onDeleteSummary: () => void;
}) {
  const [editingId, setEditingId] = useState<string>();
  const [subject, setSubject] = useState('');
  const [detail, setDetail] = useState('');
  const [summaryEditing, setSummaryEditing] = useState(false);
  const [summaryText, setSummaryText] = useState('');

  const beginEdit = (memory: DurableMemory) => {
    setEditingId(memory.id);
    setSubject(memory.subject);
    setDetail(memory.detail);
  };

  const saveEdit = (memory: DurableMemory) => {
    if (!subject.trim() || !detail.trim()) return;
    onUpdate(userCorrectMemory(memory, subject, detail));
    setEditingId(undefined);
  };

  const beginSummaryEdit = () => {
    setSummaryText(summary?.text ?? '');
    setSummaryEditing(true);
  };

  const saveSummary = () => {
    if (!summaryText.trim()) return;
    onUpdateSummary(summaryText.trim());
    setSummaryEditing(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetEyebrow}>YOUR CONTEXT</Text>
            <Text style={styles.sheetTitle}>Memory</Text>
          </View>
          <Pressable accessibilityLabel="Close memory" onPress={onClose} style={styles.iconButton}><X color={C.ink} size={22} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.memoryBody}>
          <Text style={styles.memoryIntro}>
            These details can influence future responses. Correct anything inaccurate or remove anything you do not want remembered.
          </Text>

          {summary?.text ? (
            <View style={styles.summaryBlock}>
              <View style={styles.memoryItemHeader}>
                <View style={styles.accountText}>
                  <Text style={styles.memoryKind}>CURRENT THREAD SUMMARY</Text>
                  {threadTitle ? <Text style={styles.summaryThreadTitle} numberOfLines={1}>{threadTitle}</Text> : null}
                </View>
                <View style={styles.memoryActions}>
                  <Pressable accessibilityLabel="Edit thread summary" onPress={summaryEditing ? saveSummary : beginSummaryEdit} style={styles.smallIconButton}>
                    {summaryEditing ? <Check color={C.green} size={18} /> : <Pencil color={C.green} size={17} />}
                  </Pressable>
                  <Pressable accessibilityLabel="Delete thread summary" onPress={onDeleteSummary} style={styles.smallIconButton}>
                    <Trash2 color={C.danger} size={17} />
                  </Pressable>
                </View>
              </View>
              {summaryEditing
                ? <TextInput value={summaryText} onChangeText={setSummaryText} maxLength={2_000} multiline style={[styles.memoryInput, styles.summaryInput]} />
                : <Text style={styles.summaryText}>{summary.text}</Text>}
            </View>
          ) : null}

          {memories.length === 0 ? (
            <View style={styles.memoryEmpty}>
              <Brain color={C.green} size={25} />
              <Text style={styles.memoryEmptyTitle}>Nothing saved yet</Text>
              <Text style={styles.memoryEmptyCopy}>Durable context will appear here as the conversation develops.</Text>
            </View>
          ) : memories.map((memory) => {
            const editing = editingId === memory.id;
            return (
              <View key={memory.id} style={styles.memoryItem}>
                <View style={styles.memoryItemHeader}>
                  <View style={styles.memoryMeta}>
                    <Text style={styles.memoryKind}>{memory.kind.toUpperCase()}</Text>
                    {memory.confidence === 'user_confirmed' ? <Text style={styles.confirmedLabel}>CORRECTED BY YOU</Text> : null}
                  </View>
                  <View style={styles.memoryActions}>
                    <Pressable accessibilityLabel={`Edit ${memory.subject}`} onPress={() => editing ? saveEdit(memory) : beginEdit(memory)} style={styles.smallIconButton}>
                      {editing ? <Check color={C.green} size={18} /> : <Pencil color={C.green} size={17} />}
                    </Pressable>
                    <Pressable accessibilityLabel={`Delete ${memory.subject}`} onPress={() => onDelete(memory.id)} style={styles.smallIconButton}>
                      <Trash2 color={C.danger} size={17} />
                    </Pressable>
                  </View>
                </View>
                {editing ? (
                  <>
                    <TextInput value={subject} onChangeText={setSubject} maxLength={100} style={styles.memoryInput} />
                    <TextInput value={detail} onChangeText={setDetail} maxLength={400} multiline style={[styles.memoryInput, styles.memoryDetailInput]} />
                  </>
                ) : (
                  <>
                    <Text style={styles.memorySubject}>{memory.subject}</Text>
                    <Text style={styles.memoryDetail}>{memory.detail}</Text>
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Consent({ visible, onAccept }: { visible: boolean; onAccept: () => void }) {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.consent}>
          <View style={styles.consentIcon}><ShieldCheck color={C.green} size={25} /></View>
          <Text style={styles.consentTitle}>A clearer conversation</Text>
          <Text style={styles.consentCopy}>
            Within uses AI and may be wrong. It only knows what you share, and it is not therapy, diagnosis, or emergency support.
          </Text>
          <Text style={styles.consentCopy}>
            Your recent messages are sent to our API and Google Gemini to generate each response.
          </Text>
          <Pressable onPress={onAccept} style={styles.primaryButton}><Text style={styles.primaryButtonText}>I understand</Text></Pressable>
          {apiUrl ? <Pressable onPress={() => Linking.openURL(`${apiUrl}/privacy`)} style={styles.textButton}><Text style={styles.textButtonText}>Read privacy policy</Text></Pressable> : null}
        </View>
      </View>
    </Modal>
  );
}

function WithinApp() {
  const [state, setState] = useState<ConversationState>(emptyConversationState);
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [memoryVisible, setMemoryVisible] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [expandedMessage, setExpandedMessage] = useState<string>();
  const [conversationOpen, setConversationOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string>();
  const scrollRef = useRef<ScrollView>(null);
  const loadedCloudUser = useRef<string | undefined>(undefined);
  const activeThread = useMemo(
    () => state.threads.find(({ id: threadId }) => threadId === activeThreadId),
    [activeThreadId, state.threads],
  );
  const visibleThreads = useMemo(
    () => state.threads.filter(({ archivedAt }) => !archivedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [state.threads],
  );
  const showConversation = conversationOpen && Boolean(activeThread);

  useEffect(() => {
    let active = true;
    Promise.all([loadConversationState(), getCurrentSession()])
      .then(([saved, currentSession]) => {
        if (!active) return;
        setState(saved);
        setSession(currentSession);
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
    const unsubscribe = observeSession(setSession);
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!hydrated || !session || loadedCloudUser.current === session.user.id) return;
    loadedCloudUser.current = session.user.id;
    setSyncStatus('syncing');
    loadCloudConversation(session.user.id)
      .then((remote) => {
        setState((current) => mergeConversationStates(current, remote));
        setSyncStatus('synced');
      })
      .catch(() => setSyncStatus('error'));
  }, [hydrated, session]);

  useEffect(() => {
    if (!hydrated) return;
    saveConversationState(state).catch(() => undefined);
    if (!session) {
      setSyncStatus('local');
      return;
    }
    setSyncStatus('syncing');
    const timeout = setTimeout(() => {
      saveCloudConversation(session.user.id, state)
        .then(() => setSyncStatus('synced'))
        .catch(() => setSyncStatus('error'));
    }, 700);
    return () => clearTimeout(timeout);
  }, [hydrated, session, state]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (showConversation) {
        scrollRef.current?.scrollToEnd({ animated: true });
      } else {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }
    }, 80);
    return () => clearTimeout(timeout);
  }, [activeThread?.messages.length, sending, expandedMessage, showConversation]);

  useEffect(() => {
    if (!showConversation) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      Keyboard.dismiss();
      setInput('');
      setConversationOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [showConversation]);

  const syncLabel = useMemo(() => {
    if (!session) return 'Private on this device';
    if (syncStatus === 'syncing') return 'Syncing';
    if (syncStatus === 'error') return 'Sync issue';
    return 'Synced';
  }, [session, syncStatus]);
  const responsePending = activeThread?.messages.at(-1)?.role === 'user' && !sending;

  const requestResponse = async (
    threadId: string,
    context: ConversationMessage[],
    summary?: ConversationSummary,
  ) => {
    setError('');
    setSending(true);

    try {
      const result = await sendConversationMessage(context, {
        summary,
        memories: state.memories,
      });
      const assistantMessage: ConversationMessage = result.response ? {
        id: id('assistant'),
        role: 'assistant',
        content: completeReply(result.response),
        createdAt: new Date().toISOString(),
        reasoning: {
          stance: result.response.stance,
          knownFacts: result.response.knownFacts,
          interpretations: result.response.interpretations,
          missingContext: result.response.missingContext,
          directChallenge: result.response.directChallenge,
          followUpQuestion: result.response.followUpQuestion,
        },
      } : {
        id: id('safety'),
        role: 'assistant',
        content: result.supportMessage ?? 'Please contact a person who can support you right now.',
        createdAt: new Date().toISOString(),
      };
      setState((current) => {
        if (!current.threads.some(({ id: currentThreadId }) => currentThreadId === threadId)) return current;
        return {
          ...current,
          threads: current.threads.map((thread) => thread.id === threadId ? {
            ...thread,
            messages: [...thread.messages, assistantMessage],
            summary: result.response?.summary ?? thread.summary,
            updatedAt: assistantMessage.createdAt,
          } : thread),
          memories: result.response
            ? applyMemoryUpserts(current.memories, result.response.memoryUpserts)
            : current.memories,
          updatedAt: assistantMessage.createdAt,
        };
      });
    } catch {
      setError('Within could not respond. Your message is saved; try again in a moment.');
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const content = input.trim();
    if (!content || sending || !state.aiConsent) return;

    const now = new Date().toISOString();
    const userMessage: ConversationMessage = { id: id('user'), role: 'user', content, createdAt: now };
    const currentThread = conversationOpen ? activeThread : undefined;
    const threadId = currentThread?.id ?? id('thread');
    const context = [...(currentThread?.messages ?? []), userMessage];
    setInput('');
    setActiveThreadId(threadId);
    setConversationOpen(true);
    setState((current) => ({
      ...current,
      threads: currentThread
        ? current.threads.map((thread) => thread.id === threadId
          ? { ...thread, messages: [...thread.messages, userMessage], updatedAt: now }
          : thread)
        : [{
          id: threadId,
          title: titleFromMessage(content),
          messages: [userMessage],
          createdAt: now,
          updatedAt: now,
        }, ...current.threads],
      updatedAt: now,
    }));
    await requestResponse(threadId, context, currentThread?.summary);
  };

  const retry = () => {
    if (sending || !activeThread || activeThread.messages.at(-1)?.role !== 'user') return;
    setConversationOpen(true);
    requestResponse(activeThread.id, activeThread.messages, activeThread.summary);
  };

  const openThread = (threadId: string) => {
    setError('');
    setInput('');
    setExpandedMessage(undefined);
    setActiveThreadId(threadId);
    setConversationOpen(true);
  };

  const deleteThread = (thread: ConversationThread) => {
    Alert.alert(
      'Delete conversation?',
      'This deletes its messages and summary. Cross-conversation memories remain available in Memory until you delete them there.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const deletedAt = new Date().toISOString();
            setState((current) => ({
              ...current,
              threads: current.threads.filter(({ id: threadId }) => threadId !== thread.id),
              deletedThreads: [
                { id: thread.id, deletedAt },
                ...current.deletedThreads.filter(({ id: threadId }) => threadId !== thread.id),
              ].slice(0, 200),
              updatedAt: deletedAt,
            }));
            if (activeThreadId === thread.id) {
              setActiveThreadId(undefined);
              setConversationOpen(false);
            }
          },
        },
      ],
    );
  };

  const clearConversation = () => {
    Alert.alert('Clear everything?', 'This removes all conversations, summaries, and remembered details from this device and your synced account. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          const cleared = { ...emptyConversationState, aiConsent: state.aiConsent, updatedAt: new Date().toISOString() };
          setState(cleared);
          setConversationOpen(false);
          setActiveThreadId(undefined);
          await clearConversationState();
          if (session) await deleteCloudConversation(session.user.id).catch(() => setSyncStatus('error'));
          setSettingsVisible(false);
        },
      },
    ]);
  };

  const handleSignIn = async (provider: 'google' | 'apple') => {
    setAccountBusy(true);
    try {
      await signIn(provider);
    } catch (signInError) {
      Alert.alert('Sign-in failed', getSignInFailureMessage(signInError));
    } finally {
      setAccountBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAccountBusy(true);
    try {
      await signOut();
      loadedCloudUser.current = undefined;
      setSession(null);
      setSettingsVisible(false);
    } catch {
      Alert.alert('Could not sign out', 'Check your connection and try again.');
    } finally {
      setAccountBusy(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert('Delete your account?', 'This permanently deletes your synced Within data and account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete account',
        style: 'destructive',
        onPress: async () => {
          setAccountBusy(true);
          try {
            await deleteAccount();
            await clearConversationState();
            setState(emptyConversationState);
            setConversationOpen(false);
            setActiveThreadId(undefined);
            setSession(null);
            setSettingsVisible(false);
          } catch {
            Alert.alert('Account not deleted', 'Check your connection and try again.');
          } finally {
            setAccountBusy(false);
          }
        },
      },
    ]);
  };

  if (!hydrated) {
    return <View style={styles.loading}><ActivityIndicator color={C.green} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.headerLeading}>
            {showConversation ? (
              <Pressable
                accessibilityLabel="Back to home"
                onPress={() => {
                  Keyboard.dismiss();
                  setInput('');
                  setConversationOpen(false);
                }}
                style={styles.backButton}
              >
                <ChevronLeft color={C.ink} size={27} />
              </Pressable>
            ) : null}
            <View>
              <Text style={styles.brand}>Within</Text>
              <View style={styles.statusRow}><View style={[styles.statusDot, syncStatus === 'error' && styles.statusDotError]} /><Text style={styles.statusText}>{syncLabel}</Text></View>
            </View>
          </View>
          <Pressable accessibilityLabel="Open settings" onPress={() => setSettingsVisible(true)} style={styles.iconButton}>
            <Menu color={C.ink} size={23} />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.conversation}
          contentContainerStyle={[styles.conversationContent, !showConversation && styles.emptyConversationContent]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!showConversation ? (
            <ConversationHome
              threads={visibleThreads}
              onDelete={deleteThread}
              onOpen={openThread}
              onStarter={setInput}
            />
          ) : activeThread!.messages.map((message) => (
            <Message
              key={message.id}
              message={message}
              expanded={expandedMessage === message.id}
              onToggle={() => setExpandedMessage((current) => current === message.id ? undefined : message.id)}
            />
          ))}
          {sending ? (
            <View style={styles.thinking}>
              <View style={styles.assistantMark}><Eye color={C.paper} size={15} strokeWidth={2.4} /></View>
              <View style={styles.thinkingBubble}><ActivityIndicator color={C.green} size="small" /><Text style={styles.thinkingText}>Taking a second look...</Text></View>
            </View>
          ) : null}
        </ScrollView>

        {showConversation && (error || responsePending) ? (
          <View style={styles.errorBar}>
            <Text style={styles.errorText}>{error || 'Your message is saved and still needs a response.'}</Text>
            <Pressable onPress={retry} disabled={sending} style={styles.retryButton}><Text style={styles.retryText}>Retry</Text></Pressable>
          </View>
        ) : null}

        <View style={styles.composerWrap}>
          <View style={styles.composer}>
            <TextInput
              accessibilityLabel="Message Within"
              value={input}
              onChangeText={setInput}
              placeholder={showConversation ? 'What is on your mind?' : 'Start a new conversation...'}
              placeholderTextColor={C.faint}
              multiline
              maxLength={8_000}
              style={styles.input}
              onSubmitEditing={() => { if (Platform.OS === 'web') send(); }}
            />
            <Pressable
              accessibilityLabel="Send message"
              disabled={!input.trim() || sending || !state.aiConsent}
              onPress={send}
              style={({ pressed }) => [styles.sendButton, (!input.trim() || sending || !state.aiConsent) && styles.sendButtonDisabled, pressed && styles.pressed]}
            >
              <Send color={C.paper} size={19} />
            </Pressable>
          </View>
          <Text style={styles.disclaimer}>AI can be wrong. Check important decisions.</Text>
        </View>
      </KeyboardAvoidingView>

      <Consent
        visible={hydrated && !state.aiConsent}
        onAccept={() => setState((current) => ({ ...current, aiConsent: true, updatedAt: new Date().toISOString() }))}
      />
      <Settings
        visible={settingsVisible}
        session={session}
        syncStatus={syncStatus}
        busy={accountBusy}
        memoryCount={state.memories.length}
        onClose={() => setSettingsVisible(false)}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onClear={clearConversation}
        onMemory={() => { setSettingsVisible(false); setMemoryVisible(true); }}
        onDeleteAccount={handleDeleteAccount}
      />
      <MemoryManager
        visible={memoryVisible}
        summary={showConversation ? activeThread?.summary : undefined}
        threadTitle={showConversation ? activeThread?.title : undefined}
        memories={state.memories}
        onClose={() => setMemoryVisible(false)}
        onUpdate={(memory) => setState((current) => ({
          ...current,
          memories: current.memories.map((item) => item.id === memory.id ? memory : item),
          updatedAt: memory.updatedAt,
        }))}
        onDelete={(memoryId) => setState((current) => ({
          ...current,
          memories: current.memories.filter((memory) => memory.id !== memoryId),
          updatedAt: new Date().toISOString(),
        }))}
        onUpdateSummary={(text) => {
          if (!activeThreadId) return;
          const updatedAt = new Date().toISOString();
          setState((current) => ({
            ...current,
            threads: current.threads.map((thread) => thread.id === activeThreadId
              ? { ...thread, summary: { text, updatedAt }, updatedAt }
              : thread),
            updatedAt,
          }));
        }}
        onDeleteSummary={() => {
          if (!activeThreadId) return;
          const updatedAt = new Date().toISOString();
          setState((current) => ({
            ...current,
            threads: current.threads.map((thread) => thread.id === activeThreadId
              ? { ...thread, summary: undefined, updatedAt }
              : thread),
            updatedAt,
          }));
        }}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><WithinApp /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: C.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.canvas },
  pressed: { opacity: 0.7 },
  header: { minHeight: 70, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, backgroundColor: C.paper, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeading: { flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 38, height: 42, alignItems: 'flex-start', justifyContent: 'center' },
  brand: { color: C.ink, fontSize: 22, lineHeight: 27, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  statusDotError: { backgroundColor: C.danger },
  statusText: { color: C.muted, fontSize: 11, lineHeight: 15 },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  conversation: { flex: 1 },
  conversationContent: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 28, gap: 22 },
  emptyConversationContent: { flexGrow: 1, justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 8, paddingBottom: 28 },
  emptyMark: { width: 55, height: 55, borderRadius: 28, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { color: C.ink, fontSize: 29, lineHeight: 35, fontWeight: '800' },
  emptySubtitle: { color: C.muted, fontSize: 16, lineHeight: 23, marginTop: 5, marginBottom: 31 },
  threadList: { width: '100%', gap: 9, marginBottom: 18 },
  threadListHeading: { color: C.faint, fontSize: 10, lineHeight: 14, fontWeight: '800', marginBottom: 2 },
  threadRow: { minHeight: 78, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, borderRadius: 7, flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden' },
  threadMain: { flex: 1, minWidth: 0, paddingLeft: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  threadPreview: { color: C.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
  threadDelete: { width: 42, alignItems: 'center', justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: C.line },
  resumeIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  resumeText: { flex: 1 },
  resumeTitle: { color: C.ink, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  resumeMeta: { color: C.muted, fontSize: 11, lineHeight: 15, marginTop: 2 },
  resumeChevron: { transform: [{ rotate: '180deg' }] },
  starters: { width: '100%', gap: 10 },
  starter: { minHeight: 54, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, borderRadius: 7, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  starterText: { flex: 1, color: C.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  messageWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, maxWidth: '94%' },
  userMessageWrap: { alignSelf: 'flex-end', justifyContent: 'flex-end', maxWidth: '88%' },
  assistantMark: { width: 29, height: 29, borderRadius: 15, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  messageColumn: { flexShrink: 1, maxWidth: '100%' },
  userMessageColumn: { alignItems: 'flex-end' },
  bubble: { paddingHorizontal: 15, paddingTop: 12, paddingBottom: 8, borderRadius: 7 },
  assistantBubble: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderTopLeftRadius: 2 },
  userBubble: { backgroundColor: C.green, borderTopRightRadius: 2 },
  messageText: { color: C.ink, fontSize: 15, lineHeight: 23 },
  userMessageText: { color: C.paper },
  messageTime: { color: C.faint, fontSize: 10, lineHeight: 13, marginTop: 7, alignSelf: 'flex-end' },
  userMessageTime: { color: '#C9DDD5' },
  reasoningToggle: { minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 2 },
  reasoningToggleText: { color: C.green, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  reasoning: { borderLeftWidth: 2, borderLeftColor: C.green, paddingLeft: 13, paddingTop: 4, paddingBottom: 2, gap: 17 },
  challenge: { backgroundColor: C.amberSoft, borderRadius: 5, padding: 12 },
  challengeLabel: { color: C.amber, fontSize: 10, lineHeight: 14, fontWeight: '800' },
  challengeText: { color: C.ink, fontSize: 13, lineHeight: 20, marginTop: 5 },
  reasoningSection: { gap: 7 },
  reasoningHeading: { color: C.ink, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  reasoningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  reasoningDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.faint, marginTop: 7 },
  reasoningText: { flex: 1, color: C.muted, fontSize: 12, lineHeight: 18 },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  thinkingBubble: { minHeight: 42, borderWidth: 1, borderColor: C.line, borderRadius: 7, borderTopLeftRadius: 2, backgroundColor: C.paper, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14 },
  thinkingText: { color: C.muted, fontSize: 13 },
  errorBar: { backgroundColor: C.dangerSoft, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7C5BE', paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  errorText: { flexShrink: 1, color: C.danger, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  retryButton: { minHeight: 30, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  retryText: { color: C.danger, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  composerWrap: { backgroundColor: C.paper, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, paddingHorizontal: 13, paddingTop: 10, paddingBottom: Platform.OS === 'android' ? 12 : 8 },
  composer: { minHeight: 50, maxHeight: 132, borderWidth: 1, borderColor: C.line, backgroundColor: C.canvas, borderRadius: 7, paddingLeft: 13, paddingRight: 6, paddingVertical: 5, flexDirection: 'row', alignItems: 'flex-end' },
  input: { flex: 1, minHeight: 39, maxHeight: 116, color: C.ink, fontSize: 15, lineHeight: 21, paddingTop: 9, paddingBottom: 8, paddingRight: 9, textAlignVertical: 'top' },
  sendButton: { width: 39, height: 39, borderRadius: 6, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: '#AAB8B2' },
  disclaimer: { color: C.faint, fontSize: 10, lineHeight: 14, textAlign: 'center', marginTop: 6 },
  sheet: { flex: 1, backgroundColor: C.canvas },
  sheetHeader: { minHeight: 78, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: C.paper, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetEyebrow: { color: C.green, fontSize: 10, lineHeight: 14, fontWeight: '800' },
  sheetTitle: { color: C.ink, fontSize: 23, lineHeight: 29, fontWeight: '800' },
  settingsBody: { padding: 20, gap: 22 },
  accountBlock: { minHeight: 72, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 7, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 13 },
  accountText: { flex: 1 },
  accountName: { color: C.ink, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  syncText: { color: C.muted, fontSize: 12 },
  signInBlock: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 7, padding: 17, gap: 10 },
  settingsSection: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 7, paddingHorizontal: 16, paddingTop: 15 },
  settingsHeading: { color: C.ink, fontSize: 14, lineHeight: 19, fontWeight: '800', marginBottom: 2 },
  settingsCopy: { color: C.muted, fontSize: 13, lineHeight: 19, marginBottom: 5 },
  authButton: { minHeight: 48, borderWidth: 1, borderColor: C.line, borderRadius: 5, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleGlyph: { color: C.blue, fontSize: 18, fontWeight: '800' },
  authButtonText: { color: C.ink, fontSize: 14, fontWeight: '700' },
  appleButton: { backgroundColor: C.ink, borderColor: C.ink },
  appleButtonText: { color: C.paper, fontSize: 14, fontWeight: '700' },
  settingsRow: { minHeight: 52, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingsRowText: { flex: 1, color: C.ink, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  settingsRowMeta: { color: C.faint, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  dangerText: { color: C.danger },
  memoryBody: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },
  memoryIntro: { color: C.muted, fontSize: 13, lineHeight: 20, marginBottom: 20 },
  summaryBlock: { borderLeftWidth: 2, borderLeftColor: C.green, paddingLeft: 14, paddingVertical: 3, marginBottom: 25 },
  summaryText: { color: C.ink, fontSize: 13, lineHeight: 20, marginTop: 7 },
  summaryThreadTitle: { color: C.ink, fontSize: 13, lineHeight: 18, fontWeight: '700', marginTop: 3 },
  memoryEmpty: { minHeight: 210, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  memoryEmptyTitle: { color: C.ink, fontSize: 17, lineHeight: 23, fontWeight: '800', marginTop: 12 },
  memoryEmptyCopy: { color: C.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 5 },
  memoryItem: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, paddingVertical: 17 },
  memoryItemHeader: { minHeight: 28, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  memoryMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  memoryKind: { color: C.green, fontSize: 10, lineHeight: 14, fontWeight: '800' },
  confirmedLabel: { color: C.blue, backgroundColor: C.blueSoft, borderRadius: 3, overflow: 'hidden', paddingHorizontal: 6, paddingVertical: 2, fontSize: 9, lineHeight: 12, fontWeight: '800' },
  memoryActions: { flexDirection: 'row', alignItems: 'center' },
  smallIconButton: { width: 36, height: 32, alignItems: 'center', justifyContent: 'center' },
  memorySubject: { color: C.ink, fontSize: 15, lineHeight: 20, fontWeight: '800', marginTop: 5 },
  memoryDetail: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 5 },
  memoryInput: { minHeight: 43, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, borderRadius: 5, color: C.ink, fontSize: 14, lineHeight: 20, paddingHorizontal: 11, paddingVertical: 9, marginTop: 8 },
  memoryDetailInput: { minHeight: 82, textAlignVertical: 'top' },
  summaryInput: { minHeight: 112, textAlignVertical: 'top' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20, 25, 22, 0.46)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  consent: { width: '88%', maxWidth: 430, backgroundColor: C.paper, borderRadius: 7, padding: 22 },
  consentIcon: { width: 49, height: 49, borderRadius: 25, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  consentTitle: { color: C.ink, fontSize: 23, lineHeight: 29, fontWeight: '800', marginBottom: 10 },
  consentCopy: { color: C.muted, fontSize: 14, lineHeight: 21, marginBottom: 10 },
  primaryButton: { minHeight: 50, backgroundColor: C.green, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginTop: 7 },
  primaryButtonText: { color: C.paper, fontSize: 14, fontWeight: '800' },
  textButton: { minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  textButtonText: { color: C.green, fontSize: 13, fontWeight: '700' },
});
