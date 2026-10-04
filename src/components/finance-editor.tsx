"use client";
import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import type { Source, Category, Transaction } from "./finance-types";
import { api, today } from "./finance-utils";

export function Editor({ type, initial, sources, categories, onClose, onDone }: { type: "transaction" | "category" | "source"; initial: Transaction | Category | Source | null; sources: Source[]; categories: Category[]; onClose: () => void; onDone: () => Promise<void> }) {
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

