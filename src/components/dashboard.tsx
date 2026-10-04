"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import Drawer from "@mui/material/Drawer";
import DialogContent from "@mui/material/DialogContent";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { ArrowRight, ArrowUpRight, CreditCard, Pencil, FileText, Menu, Plus, Search, Trash2, X } from "lucide-react";

import type { Source, Category, Transaction, Attachment, Tab } from "./finance-types";
import { api, formatMoney, formatDate } from "./finance-utils";
import { Stat, TransactionTable } from "./finance-primitives";
import { ManagementPage } from "./management-page";
import { Editor } from "./finance-editor";
import { AuthScreen } from "./finance-auth-screen";
import { FinanceNavigation, nav } from "./finance-navigation";
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
    <aside className="sidebar"><FinanceNavigation email={user.email} tab={tab} onTab={value => { setTab(value); setError(""); }} onSignOut={() => void signOut()} onClose={() => setMobileNav(false)}/></aside>
    <Drawer anchor="left" open={mobileNav} onClose={() => setMobileNav(false)} slotProps={{ paper: { sx: { width: 260, bgcolor: "background.paper" } } }}><FinanceNavigation email={user.email} tab={tab} onTab={value => { setTab(value); setError(""); }} onSignOut={() => void signOut()} onClose={() => setMobileNav(false)} mobile/></Drawer>
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
        {tab === "manage" && <ManagementPage sources={sources} categories={categories} onAddSource={() => setModal("source")} onAddCategory={() => setModal("category")} onEditSource={item => edit("source", item)} onEditCategory={item => edit("category", item)} onDeleteSource={id => remove("sources", id)} onDeleteCategory={id => remove("categories", id)}/>}
        {tab === "settings" && <><div className="page-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h1>Settings</h1><p>A few details about your finance space.</p></div></div><div className="settings-card"><div className="settings-row"><div><strong>Account</strong><span>Your connected UseAuth identity</span></div><b>{user.email}</b></div><div className="settings-row"><div><strong>Currency</strong><span>Default for new transactions</span></div><b>INR</b></div><div className="settings-row"><div><strong>API access</strong><span>Use a UseAuth bearer token with the REST and MCP endpoints</span></div><b>/api/v1 · /api/mcp</b></div><div className="settings-row"><div><strong>Attachment storage</strong><span>Private files are managed by S3 Sync</span></div><b>Connected through API</b></div></div></>}
      </div>
    </main>
    {modal && <Editor type={modal} initial={editing} sources={sources} categories={categories} onClose={() => { setModal(null); setEditing(null); }} onDone={finish}/>}
    <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} aria-labelledby="delete-title"><DialogContent><h2 id="delete-title">Delete this item?</h2><p>This action cannot be undone.</p><div className="modal-actions"><Button onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="contained" color="error" onClick={confirmRemove}>Delete</Button></div></DialogContent></Dialog>
    {selected && <Dialog open onClose={() => setSelected(null)} fullScreen={smallScreen} aria-labelledby="transaction-detail-title"><DialogContent className="detail-panel"><div className="modal-header"><div><span className="eyebrow">TRANSACTION DETAILS</span><h2 id="transaction-detail-title">{selected.description}</h2></div><Button className="icon-button" onClick={() => setSelected(null)}><X size={21}/></Button></div><div className={`detail-amount ${selected.kind}`}>{selected.kind === "expense" ? "−" : "+"}{formatMoney(selected.amount_minor, selected.currency)}</div><div className="detail-list"><div><span>Date</span><strong>{formatDate(selected.occurred_on)}</strong></div><div><span>Category</span><strong>{catName(selected.category_id)}</strong></div><div><span>Source</span><strong>{sourceName(selected.source_id)}</strong></div><div><span>Type</span><strong className="capitalize">{selected.kind}</strong></div>{selected.note && <div><span>Note</span><strong>{selected.note}</strong></div>}</div><div className="detail-files"><h3>Attachments</h3>{attachments.filter(a => a.transaction_id === selected.id).map(a => <Button key={a.id} onClick={async () => { try { const result = await api<{ url: string }>("/api/files", { method: "POST", body: JSON.stringify({ action: "download", fileId: a.file_id }) }); window.open(result.url, "_blank", "noopener,noreferrer"); } catch (cause) { setError((cause as Error).message); } }}><FileText size={17}/>{a.file_name}<ArrowUpRight size={15}/></Button>)}<label className="upload-label"><Plus size={17}/> Attach a file<input type="file" hidden onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { const signed = await api<{ url: string; fileId: string; objectKey: string }>("/api/files", { method: "POST", body: JSON.stringify({ action: "upload", fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size }) }); const put = await fetch(signed.url, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file }); if (!put.ok) throw new Error("Upload failed"); await api("/api/files", { method: "POST", body: JSON.stringify({ action: "finalize", fileId: signed.fileId, objectKey: signed.objectKey, fileName: file.name, contentType: file.type || "application/octet-stream", size: file.size }) }); await api("/api/v1/attachments", { method: "POST", body: JSON.stringify({ transaction_id: selected.id, file_id: signed.fileId }) }); await load(); } catch (cause) { setError((cause as Error).message); } }}/></label></div><Button variant="outlined" className="secondary-button detail-edit" onClick={() => edit("transaction", selected)}><Pencil size={16}/> Edit transaction</Button><Button className="danger-button" onClick={() => remove("transactions", selected.id)}><Trash2 size={17}/> Delete transaction</Button></DialogContent></Dialog>}
  </div>;
}
