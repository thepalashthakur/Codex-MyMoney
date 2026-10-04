"use client";

import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import { CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import type { Category, Source } from "./finance-types";
import { CategorySection } from "./finance-primitives";

type ManagementPageProps = {
  sources: Source[];
  categories: Category[];
  onAddSource: () => void;
  onAddCategory: () => void;
  onEditSource: (source: Source) => void;
  onEditCategory: (category: Category) => void;
  onDeleteSource: (id: string) => void;
  onDeleteCategory: (id: string) => void;
};

export function ManagementPage({ sources, categories, onAddSource, onAddCategory, onEditSource, onEditCategory, onDeleteSource, onDeleteCategory }: ManagementPageProps) {
  return <>
    <div className="page-heading">
      <div><div className="eyebrow">ORGANIZE YOUR MONEY</div><h1>Sources &amp; categories</h1><p>Keep your accounts and transaction categories in one place.</p></div>
    </div>

    <section className="management-section" aria-labelledby="sources-heading">
      <div className="management-section-heading">
        <div><h2 id="sources-heading">Sources</h2><p>Manage the accounts, cards, and cash you use.</p></div>
        <Button variant="contained" className="primary-button" onClick={onAddSource}><Plus size={18}/> Add source</Button>
      </div>
      {sources.length === 0 ? <Paper elevation={0} className="management-empty"><CreditCard size={24} aria-hidden="true"/><p>No sources yet. Add a bank account, card, or cash source to organize transactions.</p><Button variant="outlined" onClick={onAddSource}>Add your first source</Button></Paper> :
        <div className="source-grid">{sources.map(source => <Paper elevation={0} className="source-card" key={source.id}>
          <div className="source-card-top"><div className="source-icon" style={{ background: source.color }}><CreditCard size={22} aria-hidden="true"/></div><div className="source-actions"><Button className="icon-button" onClick={() => onEditSource(source)} aria-label={`Edit source ${source.name}`}><Pencil size={16}/></Button><Button className="icon-button" onClick={() => onDeleteSource(source.id)} aria-label={`Delete source ${source.name}`}><Trash2 size={16}/></Button></div></div>
          <strong>{source.name}</strong><span>{source.kind}{source.last_four ? ` •••• ${source.last_four}` : ""}</span>
        </Paper>)}</div>}
    </section>

    <section className="management-section" aria-labelledby="categories-heading">
      <div className="management-section-heading">
        <div><h2 id="categories-heading">Categories</h2><p>Group income and expenses in a way that makes sense to you.</p></div>
        <Button variant="outlined" className="secondary-button" onClick={onAddCategory}><Plus size={18}/> New category</Button>
      </div>
      <div className="two-columns">
        <CategorySection title="Expense categories" kind="expense" categories={categories} onDelete={onDeleteCategory} onEdit={onEditCategory}/>
        <CategorySection title="Income categories" kind="income" categories={categories} onDelete={onDeleteCategory} onEdit={onEditCategory}/>
      </div>
    </section>
  </>;
}
