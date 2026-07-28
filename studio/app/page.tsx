'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  CirclePlus,
  FileCheck2,
  Library,
  LogIn,
  LogOut,
  Menu,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { createStarterPack } from '../lib/template';
import type {
  KnowledgeModule,
  KnowledgePackContent,
  KnowledgePattern,
  MemberRole,
  PackRecord,
  PackStatus,
  PackVersion,
  ValidationIssue,
} from '../lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://within-reflection-api-hiren.fly.dev';
const tabs = ['Overview', 'Skills', 'Patterns', 'Safety & language'] as const;
type Tab = (typeof tabs)[number];
type Membership = { organization_id: string; role: MemberRole; organization_name: string };

const splitLines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean);
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const canAuthor = (role?: MemberRole) => role === 'author' || role === 'admin';
const canReview = (role?: MemberRole) => role === 'reviewer' || role === 'admin';
const canPublish = (role?: MemberRole) => role === 'publisher' || role === 'admin';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="text-input" {...props} />;
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="text-area" {...props} />;
}

function StatusBadge({ status }: { status: PackStatus }) {
  return <span className={`status status-${status}`}>{status.replace('_', ' ')}</span>;
}

export default function StudioPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [packs, setPacks] = useState<PackRecord[]>([]);
  const [selectedPackId, setSelectedPackId] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [content, setContent] = useState<KnowledgePackContent | null>(null);
  const [changeSummary, setChangeSummary] = useState('');
  const [tab, setTab] = useState<Tab>('Overview');
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [selectedPatternId, setSelectedPatternId] = useState('');
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newPackOpen, setNewPackOpen] = useState(false);
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [newVersionValue, setNewVersionValue] = useState('0.2.0');

  const loadWorkspace = useCallback(async (activeUser: User) => {
    if (!supabase) return;
    const membershipResult = await supabase
      .from('organization_members')
      .select('organization_id, role, organizations(name)')
      .eq('user_id', activeUser.id);
    if (membershipResult.error) throw membershipResult.error;

    const nextMemberships = (membershipResult.data ?? []).map((item) => {
      const organization = item.organizations as unknown as { name: string } | null;
      return { organization_id: item.organization_id, role: item.role as MemberRole, organization_name: organization?.name ?? 'Organization' };
    });
    setMemberships(nextMemberships);
    if (!nextMemberships.length) {
      setPacks([]);
      return;
    }

    const organizationIds = nextMemberships.map((item) => item.organization_id);
    const packResult = await supabase
      .from('knowledge_packs')
      .select('id, organization_id, slug, title, summary, visibility')
      .in('organization_id', organizationIds)
      .order('updated_at', { ascending: false });
    if (packResult.error) throw packResult.error;
    const packIds = (packResult.data ?? []).map((pack) => pack.id);
    const versionResult = packIds.length
      ? await supabase.from('knowledge_pack_versions').select('*').in('pack_id', packIds).order('created_at', { ascending: false })
      : { data: [], error: null };
    if (versionResult.error) throw versionResult.error;

    const nextPacks = (packResult.data ?? []).map((pack) => ({
      ...pack,
      versions: (versionResult.data ?? []).filter((version) => version.pack_id === pack.id) as PackVersion[],
    })) as PackRecord[];
    setPacks(nextPacks);
    setSelectedPackId((current) => current && nextPacks.some((pack) => pack.id === current) ? current : nextPacks[0]?.id ?? '');
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setMemberships([]);
      setPacks([]);
      return;
    }
    loadWorkspace(user).catch((error: Error) => setNotice(error.message));
  }, [loadWorkspace, user]);

  const selectedPack = packs.find((pack) => pack.id === selectedPackId);
  const versionRecord = selectedPack?.versions.find((version) => version.version === selectedVersion);
  const role = memberships.find((item) => item.organization_id === selectedPack?.organization_id)?.role;
  const dirty = Boolean(content && versionRecord && JSON.stringify(content) !== JSON.stringify(versionRecord.content));
  const editable = versionRecord?.status === 'draft' && canAuthor(role);

  useEffect(() => {
    const version = selectedPack?.versions.find((item) => item.version === selectedVersion) ?? selectedPack?.versions[0];
    if (!version) {
      setContent(null);
      return;
    }
    if (version.version !== selectedVersion) setSelectedVersion(version.version);
    setContent(clone(version.content));
    setChangeSummary(version.change_summary);
    setSelectedModuleId(version.content.modules[0]?.id ?? '');
    setSelectedPatternId(version.content.patterns[0]?.id ?? '');
    setIssues([]);
  }, [selectedPackId, selectedVersion, selectedPack]);

  const validateContent = async (draft: KnowledgePackContent) => {
    const response = await fetch(`${API_URL}/v1/collections/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const result = await response.json() as { valid: boolean; issues?: ValidationIssue[] };
    const nextIssues = result.issues ?? [];
    setIssues(nextIssues);
    return result.valid;
  };

  const run = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    setNotice('');
    try {
      await action();
      setNotice(success);
      if (user) await loadWorkspace(user);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The operation failed.');
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = () => content && versionRecord && run(async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    if (!(await validateContent(content))) throw new Error('Resolve validation issues before saving.');
    const { error } = await supabase.from('knowledge_pack_versions').update({ content, change_summary: changeSummary }).eq('pack_id', content.id).eq('version', content.version).eq('status', 'draft');
    if (error) throw error;
  }, 'Draft saved.');

  const transition = (operation: 'submit' | 'publish', success: string) => versionRecord && run(async () => {
    if (!supabase || !content) throw new Error('The workspace is not configured.');
    if (operation === 'submit' && !(await validateContent(content))) throw new Error('Resolve validation issues before review.');
    if (operation === 'submit' && dirty) throw new Error('Save the draft before submitting it.');
    const functionName = operation === 'submit' ? 'submit_knowledge_pack_version' : 'publish_knowledge_pack_version';
    const { error } = await supabase.rpc(functionName, { p_pack_id: versionRecord.pack_id, p_version: versionRecord.version });
    if (error) throw error;
  }, success);

  const review = (decision: 'approved' | 'changes_requested') => versionRecord && run(async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const notes = decision === 'changes_requested' ? 'Changes requested in the authoring studio.' : 'Reviewed against the pack safety and content contract.';
    const { error } = await supabase.rpc('review_knowledge_pack_version', {
      p_pack_id: versionRecord.pack_id,
      p_version: versionRecord.version,
      p_decision: decision,
      p_notes: notes,
    });
    if (error) throw error;
  }, decision === 'approved' ? 'Version approved.' : 'Version returned to draft.');

  const createPack = (values: { id: string; title: string; summary: string; version: string; clinical: boolean }) => run(async () => {
    if (!supabase || !memberships[0]) throw new Error('You need an organization membership.');
    const draft = createStarterPack(values.id, values.version, values.title, values.summary, values.clinical);
    if (!(await validateContent(draft))) throw new Error('The starter content did not validate.');
    const slug = values.id.split('.').at(-1)?.replaceAll('_', '-') ?? values.id;
    const { error } = await supabase.rpc('create_knowledge_pack_draft', {
      p_organization_id: memberships[0].organization_id,
      p_pack_id: values.id,
      p_slug: slug,
      p_title: values.title,
      p_summary: values.summary,
      p_version: values.version,
      p_content: draft,
    });
    if (error) throw error;
    setSelectedPackId(values.id);
    setNewPackOpen(false);
  }, 'Skill collection draft created.');

  const createVersion = () => content && selectedPack && run(async () => {
    if (!supabase || !user) throw new Error('The workspace is not configured.');
    const draft = clone(content);
    draft.version = newVersionValue;
    if (!(await validateContent(draft))) throw new Error('The new version did not validate.');
    const { error } = await supabase.from('knowledge_pack_versions').insert({
      pack_id: selectedPack.id,
      version: newVersionValue,
      status: 'draft',
      content: draft,
      change_summary: '',
      created_by: user.id,
    });
    if (error) throw error;
    setSelectedVersion(newVersionValue);
    setNewVersionOpen(false);
  }, 'New draft version created.');

  if (!authReady) return <main className="center-state">Loading workspace…</main>;
  if (!supabase) return <main className="center-state"><AlertTriangle />Studio environment variables are missing.</main>;
  if (!user) return <Login />;

  return (
    <main className="studio-shell">
      <header className="topbar">
        <div className="brand"><button className="icon-button mobile-only" title="Open packs" onClick={() => setSidebarOpen(true)}><Menu /></button><span className="brand-mark">W</span><strong>Within Studio</strong></div>
        <div className="account"><span>{user.email}</span><button className="icon-button" title="Sign out" onClick={() => supabase?.auth.signOut()}><LogOut /></button></div>
      </header>

      <div className="workspace">
        <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
          <div className="sidebar-heading"><div><small>Workspace</small><strong>{memberships[0]?.organization_name ?? 'No organization'}</strong></div><button className="icon-button mobile-only" title="Close packs" onClick={() => setSidebarOpen(false)}><X /></button></div>
          <button className="primary-button full-width" disabled={!memberships.length || busy} onClick={() => setNewPackOpen(true)}><CirclePlus />New skill collection</button>
          <nav className="pack-list" aria-label="Skill collections">
            {packs.map((pack) => (
              <button key={pack.id} className={`pack-row ${pack.id === selectedPackId ? 'selected' : ''}`} onClick={() => { setSelectedPackId(pack.id); setSelectedVersion(''); setSidebarOpen(false); }}>
                <BookOpen /><span><strong>{pack.title}</strong><small>{pack.id}</small></span><StatusBadge status={pack.versions[0]?.status ?? 'draft'} />
              </button>
            ))}
          </nav>
          {!memberships.length && <div className="empty-sidebar"><ShieldCheck /><p>Your account is signed in but is not a member of an authoring organization.</p></div>}
        </aside>

        <section className="editor">
          {!content || !selectedPack || !versionRecord ? <EmptyWorkspace onCreate={() => setNewPackOpen(true)} disabled={!memberships.length} /> : <>
            <div className="editor-header">
              <div><div className="eyebrow"><span>{selectedPack.id}</span><StatusBadge status={versionRecord.status} /></div><h1>{content.title}</h1><p>{content.summary}</p></div>
              <div className="version-control"><label>Version<select value={selectedVersion} onChange={(event) => setSelectedVersion(event.target.value)}>{selectedPack.versions.map((version) => <option key={version.version}>{version.version}</option>)}</select></label><span className="role">{role}</span></div>
            </div>

            <div className="workflow-bar">
              <div className="workflow-state"><ShieldCheck /><span><strong>{content.clinicalReviewRequired ? 'Additional expert review required' : 'Editorial review required'}</strong><small>Author, reviewer, and publisher actions are recorded separately.</small></span></div>
              <div className="workflow-actions">
                {versionRecord.status !== 'draft' && canAuthor(role) && <button className="secondary-button" onClick={() => setNewVersionOpen(true)}><Plus />New draft</button>}
                {editable && <button className="secondary-button" disabled={busy || !dirty} onClick={saveDraft}><Save />Save draft</button>}
                {editable && <button className="primary-button" disabled={busy} onClick={() => transition('submit', 'Submitted for independent review.')}><Send />Submit review</button>}
                {versionRecord.status === 'in_review' && canReview(role) && <button className="secondary-button" disabled={busy} onClick={() => review('changes_requested')}><X />Request changes</button>}
                {versionRecord.status === 'in_review' && canReview(role) && <button className="primary-button" disabled={busy} onClick={() => review('approved')}><Check />Approve</button>}
                {versionRecord.status === 'approved' && canPublish(role) && <button className="primary-button" disabled={busy} onClick={() => transition('publish', 'Version published.')}><FileCheck2 />Publish</button>}
              </div>
            </div>

            {(notice || issues.length > 0) && <div className={`notice ${issues.length ? 'notice-error' : ''}`}><AlertTriangle /> <div>{notice && <strong>{notice}</strong>}{issues.slice(0, 6).map((issue) => <p key={`${issue.path}-${issue.message}`}><code>{issue.path || 'content'}</code> {issue.message}</p>)}</div></div>}

            <div className="tabs" role="tablist">{tabs.map((item) => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item}</button>)}</div>
            <div className="editor-body">
              {tab === 'Overview' && <OverviewEditor content={content} editable={editable} onChange={setContent} changeSummary={changeSummary} onChangeSummary={setChangeSummary} />}
              {tab === 'Skills' && <ModulesEditor content={content} editable={editable} selectedId={selectedModuleId} onSelect={setSelectedModuleId} onChange={setContent} />}
              {tab === 'Patterns' && <PatternsEditor content={content} editable={editable} selectedId={selectedPatternId} onSelect={setSelectedPatternId} onChange={setContent} />}
              {tab === 'Safety & language' && <SafetyEditor content={content} editable={editable} onChange={setContent} />}
            </div>
          </>}
        </section>
      </div>
      {newPackOpen && <NewPackDialog busy={busy} onClose={() => setNewPackOpen(false)} onCreate={createPack} />}
      {newVersionOpen && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true"><div className="modal-header"><div><small>Versioning</small><h2>Create draft version</h2></div><button className="icon-button" title="Close" onClick={() => setNewVersionOpen(false)}><X /></button></div><Field label="Semantic version"><TextInput value={newVersionValue} onChange={(event) => setNewVersionValue(event.target.value)} placeholder="0.2.0" /></Field><div className="modal-actions"><button className="secondary-button" onClick={() => setNewVersionOpen(false)}>Cancel</button><button className="primary-button" disabled={busy} onClick={createVersion}><Plus />Create draft</button></div></section></div>}
    </main>
  );
}

function Login() {
  const [error, setError] = useState('');
  const login = async () => {
    if (!supabase) return;
    const result = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
    if (result.error) setError(result.error.message);
  };
  return <main className="login-screen"><section className="login-panel"><span className="brand-mark large">W</span><p className="kicker">Within Studio</p><h1>Author structured life skills</h1><p>Build discoverable skills, pattern rules, and safety boundaries for independent review.</p><button className="primary-button login-button" onClick={login}><LogIn />Continue with Google</button>{error && <p className="form-error">{error}</p>}<small>Access is limited to invited organization members.</small></section></main>;
}

function EmptyWorkspace({ onCreate, disabled }: { onCreate: () => void; disabled: boolean }) {
  return <div className="empty-workspace"><Library /><h1>No skill collection selected</h1><p>Create a private draft or choose an existing collection from the workspace.</p><button className="primary-button" disabled={disabled} onClick={onCreate}><Plus />Create first draft</button></div>;
}

function OverviewEditor({ content, editable, onChange, changeSummary, onChangeSummary }: { content: KnowledgePackContent; editable: boolean; onChange: (value: KnowledgePackContent) => void; changeSummary: string; onChangeSummary: (value: string) => void }) {
  const update = (patch: Partial<KnowledgePackContent>) => onChange({ ...content, ...patch });
  return <div className="form-grid">
    <Field label="Title"><TextInput disabled={!editable} value={content.title} onChange={(event) => update({ title: event.target.value })} /></Field>
    <Field label="Supported life areas" hint="Comma-separated"><TextInput disabled={!editable} value={content.supportedLifeAreas.join(', ')} onChange={(event) => update({ supportedLifeAreas: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} /></Field>
    <Field label="Summary"><TextArea disabled={!editable} value={content.summary} onChange={(event) => update({ summary: event.target.value })} /></Field>
    <Field label="Intended audience"><TextArea disabled={!editable} value={content.intendedAudience} onChange={(event) => update({ intendedAudience: event.target.value })} /></Field>
    <Field label="Author name"><TextInput disabled={!editable} value={content.authors[0]?.name ?? ''} onChange={(event) => update({ authors: [{ name: event.target.value, credentials: content.authors[0]?.credentials ?? '' }] })} /></Field>
    <Field label="Credentials and role"><TextInput disabled={!editable} value={content.authors[0]?.credentials ?? ''} onChange={(event) => update({ authors: [{ name: content.authors[0]?.name ?? '', credentials: event.target.value }] })} /></Field>
    <label className="check-field"><input type="checkbox" disabled={!editable} checked={content.clinicalReviewRequired} onChange={(event) => update({ clinicalReviewRequired: event.target.checked })} /><span><strong>Additional expert review</strong><small>Use for health-adjacent collections; approval must come from another organization member.</small></span></label>
    <Field label="Change summary"><TextArea disabled={!editable} value={changeSummary} onChange={(event) => onChangeSummary(event.target.value)} placeholder="What changed in this version?" /></Field>
  </div>;
}

function ModulesEditor({ content, editable, selectedId, onSelect, onChange }: { content: KnowledgePackContent; editable: boolean; selectedId: string; onSelect: (id: string) => void; onChange: (value: KnowledgePackContent) => void }) {
  const selected = content.modules.find((module) => module.id === selectedId) ?? content.modules[0];
  const update = (patch: Partial<KnowledgeModule>) => selected && onChange({ ...content, modules: content.modules.map((module) => module.id === selected.id ? { ...module, ...patch } : module) });
  const add = () => { const id = `skill_${content.modules.length + 1}`; onChange({ ...content, modules: [...content.modules, { id, title: 'New skill', purpose: '', journalPrompts: [''], steps: [''], completionCriteria: [], contraindications: [] }] }); onSelect(id); };
  const remove = () => selected && content.modules.length > 1 && (onChange({ ...content, modules: content.modules.filter((module) => module.id !== selected.id) }), onSelect(content.modules.find((module) => module.id !== selected.id)?.id ?? ''));
  return <SplitEditor title="Skills" items={content.modules.map((module) => ({ id: module.id, title: module.title }))} selectedId={selected?.id ?? ''} onSelect={onSelect} onAdd={editable ? add : undefined}>
    {selected && <div className="form-grid"><div className="section-title"><div><small>Reflection skill</small><h2>{selected.title}</h2></div>{editable && <button className="icon-button danger" title="Delete skill" disabled={content.modules.length <= 1} onClick={remove}><Trash2 /></button>}</div>
      <Field label="Skill ID" hint="Stable after publication"><TextInput disabled={!editable} value={selected.id} onChange={(event) => { const oldId = selected.id; const id = event.target.value; onChange({ ...content, modules: content.modules.map((module) => module.id === oldId ? { ...module, id } : module), patterns: content.patterns.map((pattern) => pattern.moduleId === oldId ? { ...pattern, moduleId: id } : pattern) }); onSelect(id); }} /></Field>
      <Field label="Title"><TextInput disabled={!editable} value={selected.title} onChange={(event) => update({ title: event.target.value })} /></Field>
      <Field label="Purpose"><TextArea disabled={!editable} value={selected.purpose} onChange={(event) => update({ purpose: event.target.value })} /></Field>
      <Field label="Journal prompts" hint="One prompt per line"><TextArea disabled={!editable} value={selected.journalPrompts.join('\n')} onChange={(event) => update({ journalPrompts: splitLines(event.target.value) })} /></Field>
      <Field label="Practice steps" hint="One step per line"><TextArea disabled={!editable} value={selected.steps.join('\n')} onChange={(event) => update({ steps: splitLines(event.target.value) })} /></Field>
      <Field label="Completion criteria" hint="One observable criterion per line"><TextArea disabled={!editable} value={selected.completionCriteria.join('\n')} onChange={(event) => update({ completionCriteria: splitLines(event.target.value) })} /></Field>
      <Field label="Contraindications" hint="When this skill should not be offered"><TextArea disabled={!editable} value={selected.contraindications.join('\n')} onChange={(event) => update({ contraindications: splitLines(event.target.value) })} /></Field>
    </div>}
  </SplitEditor>;
}

function PatternsEditor({ content, editable, selectedId, onSelect, onChange }: { content: KnowledgePackContent; editable: boolean; selectedId: string; onSelect: (id: string) => void; onChange: (value: KnowledgePackContent) => void }) {
  const selected = content.patterns.find((pattern) => pattern.id === selectedId) ?? content.patterns[0];
  const update = (patch: Partial<KnowledgePattern>) => selected && onChange({ ...content, patterns: content.patterns.map((pattern) => pattern.id === selected.id ? { ...pattern, ...patch } : pattern) });
  const add = () => { const id = `pattern_${content.patterns.length + 1}`; onChange({ ...content, patterns: [...content.patterns, { id, category: 'self_reflection', title: 'New pattern', description: '', minimumEvidenceEntries: 2, supportingSignals: [''], weakeningSignals: [], excludingSignals: [], moduleId: content.modules[0]?.id ?? '' }] }); onSelect(id); };
  const remove = () => selected && content.patterns.length > 1 && (onChange({ ...content, patterns: content.patterns.filter((pattern) => pattern.id !== selected.id) }), onSelect(content.patterns.find((pattern) => pattern.id !== selected.id)?.id ?? ''));
  return <SplitEditor title="Patterns" items={content.patterns.map((pattern) => ({ id: pattern.id, title: pattern.title }))} selectedId={selected?.id ?? ''} onSelect={onSelect} onAdd={editable ? add : undefined}>
    {selected && <div className="form-grid"><div className="section-title"><div><small>Detection rule</small><h2>{selected.title}</h2></div>{editable && <button className="icon-button danger" title="Delete pattern" disabled={content.patterns.length <= 1} onClick={remove}><Trash2 /></button>}</div>
      <Field label="Pattern ID"><TextInput disabled={!editable} value={selected.id} onChange={(event) => { const id = event.target.value; onChange({ ...content, patterns: content.patterns.map((pattern) => pattern.id === selected.id ? { ...pattern, id } : pattern) }); onSelect(id); }} /></Field>
      <Field label="Category"><TextInput disabled={!editable} value={selected.category} onChange={(event) => update({ category: event.target.value })} /></Field>
      <Field label="Title"><TextInput disabled={!editable} value={selected.title} onChange={(event) => update({ title: event.target.value })} /></Field>
      <Field label="Description"><TextArea disabled={!editable} value={selected.description} onChange={(event) => update({ description: event.target.value })} /></Field>
      <Field label="Minimum evidence entries" hint="At least two separate journal entries"><TextInput type="number" min={2} max={10} disabled={!editable} value={selected.minimumEvidenceEntries} onChange={(event) => update({ minimumEvidenceEntries: Number(event.target.value) })} /></Field>
      <Field label="Recommended skill"><select disabled={!editable} value={selected.moduleId} onChange={(event) => update({ moduleId: event.target.value })}>{content.modules.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}</select></Field>
      <Field label="Supporting signals" hint="Observable evidence only, one per line"><TextArea disabled={!editable} value={selected.supportingSignals.join('\n')} onChange={(event) => update({ supportingSignals: splitLines(event.target.value) })} /></Field>
      <Field label="Weakening signals" hint="Evidence that reduces confidence"><TextArea disabled={!editable} value={selected.weakeningSignals.join('\n')} onChange={(event) => update({ weakeningSignals: splitLines(event.target.value) })} /></Field>
      <Field label="Excluding signals" hint="Cases that must not trigger this pattern"><TextArea disabled={!editable} value={selected.excludingSignals.join('\n')} onChange={(event) => update({ excludingSignals: splitLines(event.target.value) })} /></Field>
    </div>}
  </SplitEditor>;
}

function SafetyEditor({ content, editable, onChange }: { content: KnowledgePackContent; editable: boolean; onChange: (value: KnowledgePackContent) => void }) {
  return <div className="form-grid safety-form"><div className="section-title"><div><small>Guardrails</small><h2>Safety and language contract</h2></div><ShieldCheck /></div>
    <Field label="Scope"><TextArea disabled={!editable} value={content.safety.scope} onChange={(event) => onChange({ ...content, safety: { ...content.safety, scope: event.target.value } })} /></Field>
    <Field label="Escalation rules" hint="One deterministic routing rule per line"><TextArea disabled={!editable} value={content.safety.escalationRules.join('\n')} onChange={(event) => onChange({ ...content, safety: { ...content.safety, escalationRules: splitLines(event.target.value) } })} /></Field>
    <Field label="Approved language" hint="Calibrated phrases the AI may use"><TextArea disabled={!editable} value={content.language.approvedTerms.join('\n')} onChange={(event) => onChange({ ...content, language: { ...content.language, approvedTerms: splitLines(event.target.value) } })} /></Field>
    <Field label="Prohibited claims" hint="One explicit restriction per line"><TextArea disabled={!editable} value={content.language.prohibitedClaims.join('\n')} onChange={(event) => onChange({ ...content, language: { ...content.language, prohibitedClaims: splitLines(event.target.value) } })} /></Field>
  </div>;
}

function SplitEditor({ title, items, selectedId, onSelect, onAdd, children }: { title: string; items: { id: string; title: string }[]; selectedId: string; onSelect: (id: string) => void; onAdd?: () => void; children: React.ReactNode }) {
  return <div className="split-editor"><aside className="item-list"><div className="item-list-header"><strong>{title}</strong>{onAdd && <button className="icon-button" title={`Add ${title.toLowerCase().slice(0, -1)}`} onClick={onAdd}><Plus /></button>}</div>{items.map((item) => <button className={item.id === selectedId ? 'selected' : ''} key={item.id} onClick={() => onSelect(item.id)}><span>{item.title || 'Untitled'}</span><small>{item.id}</small></button>)}</aside><section className="detail-form">{children}</section></div>;
}

function NewPackDialog({ busy, onClose, onCreate }: { busy: boolean; onClose: () => void; onCreate: (values: { id: string; title: string; summary: string; version: string; clinical: boolean }) => void }) {
  const [id, setId] = useState('within.new_skills');
  const [title, setTitle] = useState('New Life Skills');
  const [summary, setSummary] = useState('Structured reflection skills for everyday decisions, relationships, and personal growth.');
  const [version, setVersion] = useState('0.1.0');
  const clinical = false;
  const valid = /^[a-z][a-z0-9_.-]{2,79}$/.test(id) && /^\d+\.\d+\.\d+/.test(version) && title.trim() && summary.trim();
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true"><div className="modal-header"><div><small>Private draft</small><h2>New skill collection</h2></div><button className="icon-button" title="Close" onClick={onClose}><X /></button></div><div className="form-grid"><Field label="Collection ID" hint="Stable identifier, lowercase only"><TextInput value={id} onChange={(event) => setId(event.target.value)} /></Field><Field label="Version"><TextInput value={version} onChange={(event) => setVersion(event.target.value)} /></Field><Field label="Title"><TextInput value={title} onChange={(event) => setTitle(event.target.value)} /></Field><Field label="Summary"><TextArea value={summary} onChange={(event) => setSummary(event.target.value)} /></Field></div><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={busy || !valid} onClick={() => onCreate({ id, title, summary, version, clinical })}><Plus />Create draft</button></div></section></div>;
}
