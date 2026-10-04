"use client";

import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import { ArrowRight, CreditCard, FolderTree, LayoutDashboard, LogOut, Settings2, X } from "lucide-react";
import type { Tab } from "./finance-types";

export const nav: { key: Tab; label: string; Icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Overview", Icon: LayoutDashboard },
  { key: "transactions", label: "Transactions", Icon: ArrowRight },
  { key: "categories", label: "Categories", Icon: FolderTree },
  { key: "sources", label: "Sources", Icon: CreditCard },
  { key: "settings", label: "Settings", Icon: Settings2 },
];

export function FinanceNavigation({ email, tab, onTab, onSignOut, onClose, mobile = false }: { email: string; tab: Tab; onTab: (tab: Tab) => void; onSignOut: () => void; onClose: () => void; mobile?: boolean }) {
  return <div className="sidebar-inner">
    <div className="sidebar-top"><div className="brand"><div className="brand-mark">M</div><div><strong>MyMoney</strong><span>PERSONAL FINANCE</span></div></div>{mobile && <IconButton onClick={onClose} aria-label="Close navigation"><X size={20}/></IconButton>}</div>
    <div className="workspace-label">WORKSPACE</div>
    <nav className="nav-list" aria-label={mobile ? "Mobile navigation" : "Main navigation"}>{nav.map(({ key, label, Icon }) => <Button key={key} className={`nav-item ${tab === key ? "active" : ""}`} aria-current={tab === key ? "page" : undefined} onClick={() => { onTab(key); onClose(); }}><Icon size={18} strokeWidth={1.9}/>{label}</Button>)}</nav>
    <div className="sidebar-bottom"><div className="profile"><div className="avatar">{email.slice(0,1).toUpperCase()}</div><div className="profile-text"><strong>{email.split("@")[0]}</strong><span>{email}</span></div><IconButton onClick={onSignOut} title="Sign out" aria-label="Sign out"><LogOut size={17}/></IconButton></div></div>
  </div>;
}
