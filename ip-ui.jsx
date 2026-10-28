// Shared primitives + app shell
import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Bot,
  Briefcase,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Copy,
  Eraser,
  FileCheck,
  FileCheck2,
  FileText,
  FileUp,
  FileUser,
  Info,
  Kanban,
  LayoutGrid,
  Loader,
  Lock,
  Menu,
  PenLine,
  Play,
  Plug,
  RotateCcw,
  Save,
  Search,
  SearchX,
  Server,
  Sparkles,
  Trash,
  Trash2,
  UserRound,
  ArrowUpRight,
} from 'lucide-react';

const ICONS = {
  'alert-circle': AlertCircle,
  'arrow-left': ArrowLeft,
  'arrow-up-right': ArrowUpRight,
  bookmark: Bookmark,
  'bookmark-check': BookmarkCheck,
  bot: Bot,
  briefcase: Briefcase,
  check: Check,
  'chevron-right': ChevronRight,
  compass: Compass,
  copy: Copy,
  eraser: Eraser,
  'file-check': FileCheck,
  'file-check-2': FileCheck2,
  'file-text': FileText,
  'file-up': FileUp,
  'file-user': FileUser,
  info: Info,
  kanban: Kanban,
  'layout-grid': LayoutGrid,
  loader: Loader,
  lock: Lock,
  menu: Menu,
  'pen-line': PenLine,
  play: Play,
  plug: Plug,
  'rotate-ccw': RotateCcw,
  save: Save,
  search: Search,
  'search-x': SearchX,
  server: Server,
  sparkles: Sparkles,
  trash: Trash,
  'trash-2': Trash2,
  'user-round': UserRound,
};

function Icon({ name, size = 16 }) {
  const IconComponent = ICONS[name] || CircleHelp;
  return <span className="ico" style={{ width: size, height: size }} aria-hidden="true"><IconComponent size={size} strokeWidth={1.75} /></span>;
}

function Btn({ children, kind = 'default', icon, onClick, disabled, small, type = 'button', title }) {
  return (
    <button type={type} title={title} className={`btn btn-${kind}${small ? ' btn-sm' : ''}`} onClick={onClick} disabled={disabled}>
      {icon && <Icon name={icon} size={small ? 14 : 15} />}{children}
    </button>
  );
}

function Tag({ children, tone = 'neutral', mono }) {
  return <span className={`tag tag-${tone}${mono ? ' mono' : ''}`}>{children}</span>;
}

function SampleBadge() {
  return <span className="sample-badge" title="Fictional record from the bundled demo dataset — not a live vacancy">SAMPLE DATA</span>;
}

function Card({ children, pad = true, className = '' }) {
  return <div className={`card ${pad ? 'card-pad' : ''} ${className}`}>{children}</div>;
}

function PageHead({ title, sub, right }) {
  return (
    <div className="pagehead">
      <div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
      {right && <div className="pagehead-right">{right}</div>}
    </div>
  );
}

function ScoreRing({ value, size = 44 }) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r, off = c * (1 - value / 100);
  const tone = value >= 75 ? 'var(--ok)' : value >= 50 ? 'var(--warn)' : 'var(--bad)';
  return (
    <div className="ring" style={{ width: size, height: size }} aria-label={`Estimated match ${value} of 100`}>
      <svg width={size} height={size}><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth="3" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} /></svg>
      <span className="mono" style={{ fontSize: size > 50 ? 18 : 13 }}>{value}</span>
    </div>
  );
}

function Empty({ icon, title, body, action }) {
  return (
    <div className="empty">
      <div className="empty-ico"><Icon name={icon} size={20} /></div>
      <h3>{title}</h3><p className="muted">{body}</p>{action}
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast" role="status"><Icon name="check" size={14} />{msg}</div>;
}

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-grid' },
  { id: 'discover', label: 'Discover', icon: 'compass' },
  { id: 'profile', label: 'Resume & Profile', icon: 'file-user' },
  { id: 'resume-builder', label: 'Create Resume', icon: 'file-text' },
  { id: 'studio', label: 'Application Studio', icon: 'pen-line' },
  { id: 'apply', label: 'Apply with AI', icon: 'file-check-2' },
  { id: 'tracker', label: 'Tracker', icon: 'kanban' },
  { id: 'assistant', label: 'AI Agent', icon: 'bot' },
  { id: 'settings', label: 'Settings & Integrations', icon: 'plug' },
];

function Shell({ route, go, children, appsCount, nebiusOk }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="shell">
      <aside className={`side ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="logo">IP</div>
          <div><div className="brand-name">InternPilot</div><div className="brand-sub mono">AI · v0.1</div></div>
        </div>
        <nav aria-label="Primary">
          {NAV.map((n) => (
            <button key={n.id} className={`nav ${route === n.id || (route === 'details' && n.id === 'discover') ? 'on' : ''}`} onClick={() => { go(n.id); setOpen(false); }}>
              <Icon name={n.icon} size={16} /><span>{n.label}</span>
              {n.id === 'tracker' && appsCount > 0 && <span className="nav-count mono">{appsCount}</span>}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div className="powered">
            <div className="mono tiny muted">INFERENCE</div>
            <div className="pw-row"><span className={`dot ${nebiusOk ? 'dot-ok' : 'dot-off'}`} />Nebius Token Factory</div>
            <div className="pw-row sub mono">NVIDIA Nemotron</div>
            <button className="linkish tiny" onClick={() => go('settings')}>{nebiusOk ? 'Configured' : 'Not configured — set up'}</button>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <button className="hamb" aria-label="Open navigation" onClick={() => setOpen(!open)}><Icon name="menu" size={18} /></button>
          <div className="crumb mono">{(NAV.find((n) => n.id === route) || { label: route === 'not-found' ? 'Page not found' : 'Internship details' }).label}</div>
          <div className="top-right">
            <span className="demo-pill mono"><span className="dot dot-warn" />DEMO MODE · sample data · no model calls</span>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
    </div>
  );
}

export { Icon, Btn, Tag, SampleBadge, Card, PageHead, ScoreRing, Empty, Toast, Shell, NAV };
