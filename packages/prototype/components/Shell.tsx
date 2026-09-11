'use client';

import {
  ChevronDown,
  Help,
  Lock,
  NewChat,
  Search,
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
        <button className="icon-btn" aria-label="New chat">
          <NewChat />
        </button>
      </div>

      <div className="side-row">
        <NewChat size={17} />
        New chat
      </div>
      <div className="side-row">
        <Search size={17} />
        Search chats
      </div>

      <div className="side-section">Chats</div>
      {[0, 1, 2, 3].map((i) => (
        <div className="side-ghost" key={i}>
          <Lock />
          <span className="ghost-bar" style={{ maxWidth: 150 - i * 22 }} />
        </div>
      ))}

      <div className="side-foot">
        <p>Save your chart, memories, and the threads Pinch is following.</p>
        <button className="btn-primary" style={{ width: '100%' }} onClick={onSignup}>
          Keep my chart
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
          Keep my chart
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
