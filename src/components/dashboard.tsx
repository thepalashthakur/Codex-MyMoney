"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import DialogActions from "@mui/material/DialogActions";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CreditCard, Pencil, FileText, FolderTree, LayoutDashboard, LogOut, Menu, MoreHorizontal, Plus, Search, Settings2, Trash2, Wallet, X } from "lucide-react";

type Source = { id: string; name: string; kind: string; color: string; last_four: string | null };
type Category = { id: string; name: string; kind: "income" | "expense"; color: string; parent_id: string | null };
type Transaction = { id: string; kind: "income" | "expense"; amount_minor: number; currency: string; occurred_on: string; description: string; note: string; source_id: string | null; category_id: string | null; metadata: Record<string, unknown> };
type Attachment = { id: string; transaction_id: string; file_id: string; file_name: string; content_type: string; size_bytes: number };
type Tab = "overview" | "transactions" | "categories" | "sources" | "settings";
const nav: { key: Tab; label: string; Icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Overview", Icon: LayoutDashboard }, { key: "transactions", label: "Transactions", Icon: ArrowRight },
  { key: "categories", label: "Categories", Icon: FolderTree }, { key: "sources", label: "Sources", Icon: CreditCard }, { key: "settings", label: "Settings", Icon: Settings2 },
];
const formatMoney = (minor: number, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(minor / 100);
const formatDate = (date: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const today = () => new Date().toLocaleDateString("en-CA");

async function api<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const send = () => fetch(path, { ...init, headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers }, cache: "no-store" });
  let response = await send();
  if (response.status === 401 && !path.includes("/api/session/")) {
    const refresh = await fetch("/api/session/refresh", { method: "POST" });
    if (refresh.ok) response = await send();
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || data.error || "Request failed");
  return data as T;
}

export default function Dashboard() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [sources, setSources] = useState<Source[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"transaction" | "category" | "source" | null>(null);
  const [editing, setEditing] = useState<Transaction | Category | Source | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [mobileNav, setMobileNav] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ resource: string; id: string } | null>(null);
  const theme = useTheme();
  const smallScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const load = useCallback(async () => {
    const [a, b, c, d] = await Promise.all([api<{ data: Source[] }>("/api/v1/sources"), api<{ data: Category[] }>("/api/v1/categories"), api<{ data: Transaction[] }>("/api/v1/transactions?limit=200"), api<{ data: Attachment[] }>("/api/v1/attachments?limit=200")]);
    setSources(a.data); setCategories(b.data); setTransactions(c.data); setAttachments(d.data);
  }, []);
  useEffect(() => {
    (async () => {
      try {
        let session;
        try { session = await api<{ user: { email: string } }>("/api/session/me"); }
        catch { await api("/api/session/refresh", { method: "POST" }); session = await api<{ user: { email: string } }>("/api/session/me"); }
        setUser(session.user); await load();
      } catch { setUser(null); }
      finally { setLoading(false); }
    })();
  }, [load]);
  const totals = useMemo(() => transactions.filter(t => t.currency === "INR").reduce((acc, t) => { acc[t.kind] += Number(t.amount_minor); return acc; }, { income: 0, expense: 0 }), [transactions]);
  const filtered = useMemo(() => transactions.filter(t => (filter === "all" || t.kind === filter) && (`${t.description} ${t.note}`.toLowerCase().includes(search.toLowerCase()))), [transactions, filter, search]);
  const catName = (id: string | null) => categories.find(c => c.id === id)?.name || "Uncategorized";
  const sourceName = (id: string | null) => sources.find(s => s.id === id)?.name || "No source";
  const finish = async () => { setModal(null); setEditing(null); setSelected(null); setError(""); await load(); };
  const edit = (type: "transaction" | "category" | "source", item: Transaction | Category | Source) => { setSelected(null); setEditing(item); setModal(type); };
  const remove = (resource: string, id: string) => setDeleteTarget({ resource, id });
  const confirmRemove = async () => {
    if (!deleteTarget) return;
    try { await api(`/api/v1/${deleteTarget.resource}/${deleteTarget.id}`, { method: "DELETE" }); await load(); setSelected(null); setDeleteTarget(null); }
    catch (cause) { setError((cause as Error).message); }
  };
  const signOut = async () => { await api("/api/session/sign-out", { method: "POST" }); setUser(null); setTab("overview"); };

  if (loading) return <div className="loading-screen" aria-label="Loading your workspace"><Skeleton variant="rounded" width={48} height={48}/><Skeleton width={220} height={28}/><Skeleton variant="rounded" width="min(90vw, 440px)" height={160}/></div>;
  if (!user) return <AuthScreen onSuccess={async (u) => { setUser(u); setLoading(true); try { await load(); } catch (cause) { setError((cause as Error).message); } finally { setLoading(false); } }} />;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="sidebar-top"><div className="brand"><div className="brand-mark">M</div><div><strong>MyMoney</strong><span>PERSONAL FINANCE</span></div></div><Button className="icon-button close-mobile" onClick={() => setMobileNav(false)} aria-label="Close menu"><X size={19}/></Button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list">{nav.map(({ key, label, Icon }) => <Button key={key} className={`nav-item ${tab === key ? "active" : ""}`} onClick={() => { setTab(key); setMobileNav(false); setError(""); }}><Icon size={18} strokeWidth={1.9}/>{label}{tab === key && <span className="nav-active-line"/>}</Button>)}</nav>
      <div className="sidebar-bottom"><div className="profile"><div className="avatar">{user.email?.slice(0,1).toUpperCase()}</div><div className="profile-text"><strong>{user.email?.split("@")[0]}</strong><span>{user.email}</span></div><Button className="icon-button" onClick={signOut} title="Sign out"><LogOut size={17}/></Button></div></div>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
    <main className="main"><header className="topbar"><Button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open menu"><Menu size={21}/></Button><div className="breadcrumb">Personal workspace <span>/</span> <strong>{nav.find(n => n.key === tab)?.label}</strong></div><div className="topbar-right"><span className="topbar-date">{new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date())}</span><div className="top-avatar">{user.email?.slice(0,1).toUpperCase()}</div></div></header>
      <div className="content">
        {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
        {tab === "overview" && <><div className="page-heading"><div><div className="eyebrow">YOUR FINANCIAL PICTURE</div><h1>Good to see you, {user.email?.split("@")[0]}</h1><p>Here’s what’s happening with your money.</p></div><Button variant="contained" className="primary-button" onClick={() => setModal("transaction")}><Plus size={18}/> Add transaction</Button></div>
          <div className="hero-card"><div className="hero-content"><div className="hero-label">YOUR BALANCE</div><div className="hero-value">{formatMoney(totals.income - totals.expense)}</div><p>Across your recorded INR transactions</p><Button onClick={() => setTab("transactions")}>View all transactions <ArrowRight size={16}/></Button></div></div>
          <div className="stat-grid"><Stat title="Total income" amount={totals.income} icon="income" note="Money coming in"/><Stat title="Total expenses" amount={totals.expense} icon="expense" note="Money going out"/><Paper elevation={0} className="stat-card mini-stat"><div className="stat-icon lavender"><CreditCard size={20}/></div><div className="stat-title">Connected sources</div><div className="stat-amount">{sources.length.toString().padStart(2, "0")}</div><div className="stat-note">Cards, banks & cash</div></Paper></div>
          <div className="section-heading"><div><h2>Recent activity</h2><p>Your latest income and expenses, all in one place.</p></div><Button className="text-link" onClick={() => setTab("transactions")}>View all <ArrowRight size={17}/></Button></div>
          <TransactionTable rows={transactions.slice(0, 6)} categories={categories} sources={sources} onClick={setSelected}/>
          {transactions.length === 0 && <div className="empty-extra"><Button variant="outlined" className="secondary-button" onClick={() => setModal("transaction")}><Plus size={17}/> Add your first transaction</Button></div>}
        </>}
        {tab === "transactions" && <><div className="page-heading"><div><div className="eyebrow">THE FULL PICTURE</div><h1>Transactions</h1><p>Every entry tells a part of your story.</p></div><Button variant="contained" className="primary-button" onClick={() => setModal("transaction")}><Plus size={18}/> Add transaction</Button></div><div className="toolbar"><TextField label="Search transactions" type="search" value={search} onChange={e => setSearch(e.target.value)} slotProps={{ input: { startAdornment: <Search size={18} aria-hidden="true"/> } }} sx={{ minWidth: { xs: 0, sm: 260 }, flex: { xs: 1, sm: "none" } }}/><div className="segmented">{["all", "income", "expense"].map(k => <Button key={k} className={filter === k ? "selected" : ""} onClick={() => setFilter(k)}>{k[0].toUpperCase()+k.slice(1)}</Button>)}</div></div><TransactionTable rows={filtered} categories={categories} sources={sources} onClick={setSelected}/></>}
        {tab === "categories" && <><div className="page-heading"><div><div className="eyebrow">MAKE IT YOURS</div><h1>Categories</h1><p>Organize your money in a way that makes sense to you.</p></div><Button variant="contained" className="primary-button" onClick={() => setModal("category")}><Plus size={18}/> New category</Button></div><div className="two-columns"><CategorySection title="Expense categories" kind="expense" categories={categories} onDelete={id => remove("categories", id)} onEdit={item => edit("category", item)}/><CategorySection title="Income categories" kind="income" categories={categories} onDelete={id => remove("categories", id)} onEdit={item => edit("category", item)}/></div></>}
        {tab === "sources" && <><div className="page-heading"><div><div className="eyebrow">WHERE IT FLOWS</div><h1>Sources</h1><p>Keep your cards, accounts, and cash together.</p></div><Button variant="contained" className="primary-button" onClick={() => setModal("source")}><Plus size={18}/> Add source</Button></div><div className="source-grid">{sources.map(s => <div className="source-card" key={s.id}><div className="source-card-top"><div className="source-icon" style={{ background: s.color }}><CreditCard size={22}/></div><div className="source-actions"><Button className="icon-button" onClick={() => edit("source", s)} aria-label={`Edit ${s.name}`}><Pencil size={16}/></Button><Button className="icon-button" onClick={() => remove("sources", s.id)} aria-label={`Delete ${s.name}`}><Trash2 size={16}/></Button></div></div><strong>{s.name}</strong><span>{s.kind}{s.last_four ? ` •••• ${s.last_four}` : ""}</span></div>)}<Button className="source-add" onClick={() => setModal("source")}><span><Plus size={22}/></span><strong>Add a source</strong><small>Bank, card, cash & more</small></Button></div></>}
        {tab === "settings" && <><div className="page-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h1>Settings</h1><p>A few details about your finance space.</p></div></div><div className="settings-card"><div className="settings-row"><div><strong>Account</strong><span>Your connected UseAuth identity</span></div><b>{user.email}</b></div><div className="settings-row"><div><strong>Currency</strong><span>Default for new transactions</span></div><b>INR</b></div><div className="settings-row"><div><strong>API access</strong><span>Use a UseAuth bearer token with the REST and MCP endpoints</span></div><b>/api/v1 · /api/mcp</b></div><div className="settings-row"><div><strong>Attachment storage</strong><span>Private files are managed by S3 Sync</span></div><b>Connected through API</b></div></div></>}
      </div>
    </main>
    {modal && <Editor type={modal} initial={editing} sources={sources} categories={categories} onClose={() => { setModal(null); setEditing(null); }} onDone={finish}/>}
    <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} aria-labelledby="delete-title"><DialogContent><h2 id="delete-title">Delete this item?</h2><p>This action cannot be undone.</p><div className="modal-actions"><Button onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="contained" color="error" onClick={confirmRemove}>Delete</Button></div></DialogContent></Dialog>
    {selected && <Dialog open onClose={() => setSelected(null)} fullScreen={smallScreen} aria-labelledby="transaction-detail-title"><DialogContent className="detail-panel"><div className="modal-header"><div><span className="eyebrow">TRANSACTION DETAILS</span><h2 id="transaction-detail-title">{selected.description}</h2></div><Button className="icon-button" onClick={() => setSelected(null)}><X size={21}/></Button></div><div className={`detail-amount ${selected.kind}`}>{selected.kind === "expense" ? "−" : "+"}{formatMoney(selected.amount_minor, selected.currency)}</div><div className="detail-list"><div><span>Date</span><strong>{formatDate(selected.occurred_on)}</strong></div><div><span>Category</span><strong>{catName(selected.category_id)}</strong></div><div><span>Source</span><strong>{sourceName(selected.source_id)}</strong></div><div><span>Type</span><strong className="capitalize">{selected.kind}</strong></div>{selected.note && <div><span>Note</span><strong>{selected.note}</strong></div>}</div><div className="detail-files"><h3>Attachments</h3>{attachments.filter(a => a.transaction_id === selected.id).map(a => <Button key={a.id} onClick={async () => { try { const result = await api<{ url: string }>("/api/files", { method: "POST", body: JSON.stringify({ action: "download", fileId: a.file_id }) }); window.open(result.url, "_blank", "noopener,noreferrer"); } catch (cause) { setError((cause as Error).message); } }}><FileText size={17}/>{a.file_name}<ArrowUpRight size={15}/></Button>)}<label className="upload-label"><Plus size={17}/> Attach a file<input type="file" hidden onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { const signed = await api<{ url: string; fileId: string; objectKey: string }>("/api/files", { method: "POST", body: JSON.stringify({ action: "upload", fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size }) }); const put = await fetch(signed.url, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file }); if (!put.ok) throw new Error("Upload failed"); await api("/api/files", { method: "POST", body: JSON.stringify({ action: "finalize", fileId: signed.fileId, objectKey: signed.objectKey, fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size }) }); await api("/api/v1/attachments", { method: "POST", body: JSON.stringify({ transaction_id: selected.id, file_id: signed.fileId }) }); await load(); } catch (cause) { setError((cause as Error).message); } }}/></label></div><Button variant="outlined" className="secondary-button detail-edit" onClick={() => edit("transaction", selected)}><Pencil size={16}/> Edit transaction</Button><Button className="danger-button" onClick={() => remove("transactions", selected.id)}><Trash2 size={17}/> Delete transaction</Button></DialogContent></Dialog>}
  </div>;
}

function Stat({ title, amount, icon, note }: { title: string; amount: number; icon: "income" | "expense"; note: string }) { return <Paper elevation={0} className="stat-card"><div className={`stat-icon ${icon}`}>{icon === "income" ? <ArrowDownLeft size={21}/> : <ArrowUpRight size={21}/>}</div><div className="stat-title">{title}</div><div className="stat-amount">{formatMoney(amount)}</div><div className="stat-note">{note}</div></Paper>; }
function TransactionTable({ rows, categories, sources, onClick }: { rows: Transaction[]; categories: Category[]; sources: Source[]; onClick: (t: Transaction) => void }) { return <Paper elevation={0} className="table-card"><div className="table-head"><span>TRANSACTION</span><span>CATEGORY</span><span>DATE</span><span>AMOUNT</span><span/></div>{rows.length === 0 ? <div className="empty-state"><div className="empty-icon"><Wallet size={27}/></div><h3>Nothing here yet</h3><p>Your transactions will show up here as soon as you add one.</p></div> : rows.map(t => <Button className="table-row" key={t.id} onClick={() => onClick(t)}><span className="transaction-main"><span className={`transaction-icon ${t.kind}`}>{t.kind === "income" ? <ArrowDownLeft size={20}/> : <ArrowUpRight size={20}/>}</span><span><strong>{t.description}</strong><small>{sources.find(s => s.id === t.source_id)?.name || "No source"}</small></span></span><span className="category-cell">{categories.find(c => c.id === t.category_id)?.name || "Uncategorized"}</span><span className="date-cell">{formatDate(t.occurred_on)}</span><span className={`amount-cell ${t.kind}`}>{t.kind === "expense" ? "−" : "+"}{formatMoney(t.amount_minor, t.currency)}</span><MoreHorizontal size={18} className="more-icon"/></Button>)}</Paper>; }
function CategorySection({ title, kind, categories, onDelete, onEdit }: { title: string; kind: "income" | "expense"; categories: Category[]; onDelete: (id: string) => void; onEdit: (item: Category) => void }) { const items = categories.filter(c => c.kind === kind); return <Paper elevation={0} className="list-card"><div className="list-card-heading"><div className={`small-round ${kind}`}>{kind === "income" ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}</div><h2>{title}</h2><span>{items.length}</span></div>{items.length === 0 ? <p className="list-empty">No categories yet. Add one to get organized.</p> : items.map(c => <div className="category-row" key={c.id}><span className="color-dot" style={{ background: c.color }}/><span style={{ paddingLeft: c.parent_id ? 18 : 0 }}>{c.name}{c.parent_id && <small>under {categories.find(p => p.id === c.parent_id)?.name}</small>}</span><Button className="icon-button" onClick={() => onEdit(c)} aria-label={`Edit ${c.name}`}><Pencil size={15}/></Button><Button className="icon-button" onClick={() => onDelete(c.id)} aria-label={`Delete ${c.name}`}><Trash2 size={15}/></Button></div>)}</Paper>; }

function Editor({ type, initial, sources, categories, onClose, onDone }: { type: "transaction" | "category" | "source"; initial: Transaction | Category | Source | null; sources: Source[]; categories: Category[]; onClose: () => void; onDone: () => Promise<void> }) {
  const [kind, setKind] = useState<"income" | "expense">(initial && "kind" in initial && (initial.kind === "income" || initial.kind === "expense") ? initial.kind : "expense"); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const compact = useMediaQuery(useTheme().breakpoints.down("sm"));
  const submit = async (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); setBusy(true); setError(""); const form = new FormData(e.currentTarget); try {
    let body: Record<string, unknown>;
    if (type === "transaction") body = { kind, amount_minor: Math.round(Number(form.get("amount")) * 100), currency: String(form.get("currency") || "INR").toUpperCase(), occurred_on: String(form.get("date")), description: String(form.get("description")), note: String(form.get("note") || ""), category_id: form.get("category_id") || null, source_id: form.get("source_id") || null, metadata: form.get("metadata") ? JSON.parse(String(form.get("metadata"))) : {} };
    else if (type === "category") body = { name: String(form.get("name")), kind, parent_id: form.get("parent_id") || null, color: String(form.get("color")) };
    else body = { name: String(form.get("name")), kind: String(form.get("source_kind")), color: String(form.get("color")), last_four: form.get("last_four") || null };
    await api(`/api/v1/${type === "transaction" ? "transactions" : type === "category" ? "categories" : "sources"}${initial ? `/${initial.id}` : ""}`, { method: initial ? "PATCH" : "POST", body: JSON.stringify(body) }); await onDone();
  } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } };
  return <Dialog open onClose={onClose} aria-labelledby="editor-title" fullScreen={compact}>
    <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
      <div className="modal-header"><div><span className="eyebrow">LET’S KEEP TRACK</span><h2 id="editor-title">{initial ? `Edit ${type}` : type === "transaction" ? "Add transaction" : type === "category" ? "New category" : "Add source"}</h2></div><Button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={21}/></Button></div>
      <form className="editor-form" onSubmit={submit}>
        {type !== "source" && <div className="type-picker"><Button type="button" className={kind === "expense" ? "selected" : ""} onClick={() => setKind("expense")}><ArrowUpRight size={17}/> Expense</Button><Button type="button" className={kind === "income" ? "selected" : ""} onClick={() => setKind("income")}><ArrowDownLeft size={17}/> Income</Button></div>}
        {type === "transaction" ? <>
          <TextField label="Amount" name="amount" type="number" defaultValue={initial && "amount_minor" in initial ? initial.amount_minor / 100 : ""} slotProps={{ htmlInput: { min: 0.01, step: 0.01 } }} required fullWidth/>
          <div className="form-row"><TextField label="Description" name="description" defaultValue={initial && "description" in initial ? initial.description : ""} slotProps={{ htmlInput: { maxLength: 200 } }} required/><TextField label="Date" name="date" type="date" defaultValue={initial && "occurred_on" in initial ? initial.occurred_on : today()} slotProps={{ inputLabel: { shrink: true } }} required/></div>
          <div className="form-row"><TextField select label="Category" name="category_id" defaultValue={initial && "category_id" in initial ? initial.category_id || "" : ""}><MenuItem value="">Uncategorized</MenuItem>{categories.filter(c => c.kind === kind).map(c => <MenuItem value={c.id} key={c.id}>{c.parent_id ? "↳ " : ""}{c.name}</MenuItem>)}</TextField><TextField select label="Source" name="source_id" defaultValue={initial && "source_id" in initial ? initial.source_id || "" : ""}><MenuItem value="">No source</MenuItem>{sources.map(source => <MenuItem value={source.id} key={source.id}>{source.name}</MenuItem>)}</TextField></div>
          <TextField label="Note" name="note" defaultValue={initial && "note" in initial ? initial.note : ""} multiline minRows={3} fullWidth/>
          <TextField label="Additional metadata (JSON)" name="metadata" defaultValue={initial && "metadata" in initial ? JSON.stringify(initial.metadata) : ""} multiline minRows={2} fullWidth/>
          <input name="currency" type="hidden" value={initial && "currency" in initial ? initial.currency : "INR"}/>
        </> : type === "category" ? <>
          <TextField label="Category name" name="name" defaultValue={initial && "name" in initial ? initial.name : ""} placeholder={kind === "expense" ? "e.g. Groceries" : "e.g. Salary"} required fullWidth/>
          <TextField select label="Parent category" name="parent_id" defaultValue={initial && "parent_id" in initial ? initial.parent_id || "" : ""} fullWidth><MenuItem value="">Top level category</MenuItem>{categories.filter(c => c.kind === kind).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</TextField>
          <label>Color<input name="color" type="color" defaultValue={initial && "color" in initial ? initial.color : kind === "expense" ? "#ba3b42" : "#245fa6"}/></label>
        </> : <>
          <TextField label="Source name" name="name" defaultValue={initial && "name" in initial ? initial.name : ""} placeholder="e.g. Savings account" required fullWidth/>
          <TextField label="Type" name="source_kind" defaultValue={initial && "kind" in initial ? initial.kind : "Bank account"} slotProps={{ htmlInput: { list: "source-kind-suggestions", maxLength: 40 } }} required fullWidth/>
          <datalist id="source-kind-suggestions"><option value="Bank account"/><option value="Credit card"/><option value="Debit card"/><option value="Cash"/><option value="Bank transfer"/><option value="Digital wallet"/></datalist>
          <div className="form-row"><TextField label="Last 4 digits" name="last_four" defaultValue={initial && "last_four" in initial ? initial.last_four || "" : ""} slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 4 } }}/><label>Color<input name="color" type="color" defaultValue={initial && "color" in initial ? initial.color : "#245fa6"}/></label></div>
        </>}
        {error && <Alert severity="error" role="alert">{error}</Alert>}
        <DialogActions sx={{ p: 0, pt: 1 }}><Button type="button" onClick={onClose}>Cancel</Button><Button variant="contained" disabled={busy} type="submit">{busy ? "Saving…" : initial ? "Save changes" : `Save ${type}`}</Button></DialogActions>
      </form>
    </DialogContent>
  </Dialog>;
}

function AuthScreen({ onSuccess }: { onSuccess: (user: { email: string }) => void }) { const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in"); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const submit = async (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); setBusy(true); setError(""); setMessage(""); const form = new FormData(e.currentTarget); try { const result = await api<{ confirmation_required: boolean; message: string; user: { email: string } }>(`/api/session/${mode}`, { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) }); if (result.confirmation_required) setMessage(result.message || "Check your email to confirm your account."); else onSuccess(result.user); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }; return <div className="auth-page"><div className="auth-form-wrap"><div className="auth-form"><div className="auth-mobile-brand"><div className="brand-mark">M</div><strong>MyMoney</strong></div><span className="eyebrow">WELCOME TO MYMONEY</span><h2>{mode === "sign-in" ? "Welcome back" : "Create your account"}</h2><p>{mode === "sign-in" ? "Sign in to see your money more clearly." : "Start building a clearer picture of your finances."}</p><form onSubmit={submit}><TextField label="Email address" name="email" type="email" placeholder="you@example.com" autoComplete="email" required fullWidth/><TextField label="Password" name="password" type="password" slotProps={{ htmlInput: { minLength: mode === "sign-up" ? 8 : 1 } }} placeholder="Enter your password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required fullWidth/>{error && <div className="form-error">{error}</div>}{message && <div className="success-banner">{message}</div>}<Button variant="contained" type="submit" className="primary-button auth-submit" disabled={busy}>{busy ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}<ArrowRight size={18}/></Button></form><div className="auth-switch">{mode === "sign-in" ? "New to MyMoney?" : "Already have an account?"} <Button onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(""); setMessage(""); }}>{mode === "sign-in" ? "Create an account" : "Sign in"}</Button></div></div></div></div>; }
