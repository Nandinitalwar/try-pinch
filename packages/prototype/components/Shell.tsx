'use client';

import {
  ChevronDown,
  Help,
  SidebarIcon,
} from './icons';

export function Sidebar({
  collapsed,
  onToggle,
  onSignup,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onSignup: () => void;
}) {
  return (
    <aside className="sidebar" data-collapsed={collapsed}>
      <div className="side-head">
        <button className="icon-btn" onClick={onToggle} aria-label="Close sidebar">
          <SidebarIcon />
        </button>
        <span className="context-kicker">context</span>
      </div>

      <div className="context-title">your constellation</div>
      <div className="context-subtitle">what Pinch is holding in mind</div>
      <div className="context-graph" role="img" aria-label="Context graph showing your chart, people, places, plans, and patterns">
        <svg viewBox="0 0 240 300" aria-hidden="true">
          <g className="graph-lines"><path d="M120 148 L64 76 M120 148 L180 72 M120 148 L54 210 M120 148 L188 216 M120 148 L120 264" /><path d="M64 76 L180 72 M54 210 L188 216" opacity=".4" /></g>
          <g className="graph-node graph-node-core"><circle cx="120" cy="148" r="27" /><text x="120" y="152">you</text></g>
          <g className="graph-node graph-node-chart"><circle cx="64" cy="76" r="19" /><text x="64" y="80">sky</text></g>
          <g className="graph-node graph-node-people"><circle cx="180" cy="72" r="19" /><text x="180" y="76">people</text></g>
          <g className="graph-node graph-node-places"><circle cx="54" cy="210" r="19" /><text x="54" y="214">places</text></g>
          <g className="graph-node graph-node-plans"><circle cx="188" cy="216" r="19" /><text x="188" y="220">plans</text></g>
          <g className="graph-node graph-node-patterns"><circle cx="120" cy="264" r="19" /><text x="120" y="268">patterns</text></g>
        </svg>
      </div>
      <div className="context-facts"><div><span className="fact-dot fact-dot-sky" />your chart</div><div><span className="fact-dot fact-dot-people" />the people you mention</div><div><span className="fact-dot fact-dot-plans" />what is coming up</div></div>

      <div className="side-foot">
        <p>Text Pinch a thought, a link, or a voice note. It becomes part of the picture.</p>
        <button className="btn-primary" style={{ width: '100%' }} onClick={onSignup}>
          Text Pinch
        </button>
      </div>
    </aside>
  );
}

export function TopBar({
  sidebarCollapsed,
  onToggleSidebar,
  onSignup,
}: {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onSignup: () => void;
}) {
  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {sidebarCollapsed && (
          <button className="icon-btn" onClick={onToggleSidebar} aria-label="Open sidebar">
            <SidebarIcon />
          </button>
        )}
        <button className="brand-pill">
        Pinch <span className="brand-sub">your personal astrologer</span><span className="chev"><ChevronDown /></span>
        </button>
      </div>
      <div className="topbar-right">
        <button className="btn-primary" onClick={onSignup}>
          Log in
        </button>
        <button className="btn-ghost" onClick={onSignup}>
          Text Pinch
        </button>
        <button className="icon-btn" aria-label="Help">
          <Help />
        </button>
      </div>
    </header>
  );
}

export function Avatar() {
  return (
    <div className="avatar" aria-label="Pinch">
      <span aria-hidden>✦</span>
    </div>
  );
}
