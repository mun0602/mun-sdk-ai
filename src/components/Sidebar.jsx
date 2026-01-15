import React, { useState } from 'react';
import {
  Smartphone,
  Play,
  Settings,
  User,
  LogOut,
  Calendar,
  Layers,
  Sparkles,
  Zap,
  Bug,
} from 'lucide-react';
import { useLicenseStore, useUIStore } from '../store';
import BugReportModal from './BugReportModal';

function Sidebar({ isOpen, onClose }) {
  const { license, logout, getLicenseDisplayText, getAiRequestsDisplayText, canUseAiRequest } = useLicenseStore();
  const { activeTab, setActiveTab } = useUIStore();
  const [showBugReport, setShowBugReport] = useState(false);

  const navItems = [
    { id: 'devices', icon: Smartphone, label: 'Thiết bị' },
    { id: 'profiles', icon: User, label: 'Profiles' },
    { id: 'skills', icon: Sparkles, label: 'Skills' },
    { id: 'workflow', icon: Zap, label: 'Workflow', highlight: true },
    { id: 'tasks', icon: Layers, label: 'Task Templates' },
    { id: 'scheduler', icon: Calendar, label: 'Lịch trình' },
    { id: 'execution', icon: Play, label: 'Thực thi' },
    { id: 'settings', icon: Settings, label: 'Cài đặt' },
  ];

  const licenseText = getLicenseDisplayText();
  const aiRequestsText = getAiRequestsDisplayText();
  const isExpiringSoon = licenseText.includes('⚠');
  const isAiLow = aiRequestsText.includes('⚠');

  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && <div className="sidebar-overlay active" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo"><Play size={18} fill="currentColor" /></div>
          <div>
            <div className="sidebar-title">MUN SDK AI</div>
            <div className="sidebar-version">v3.21</div>
          </div>
        </div>

        {/* License Status */}
        <div className={`license-badge ${isExpiringSoon ? 'warning' : 'success'}`}>
          <span className="license-text">{licenseText}</span>
        </div>

        {/* AI Requests Status */}
        {aiRequestsText && (
          <div className={`license-badge ${isAiLow ? 'warning' : 'info'}`} style={{ marginTop: '4px', fontSize: '12px' }}>
            <span className="license-text">{aiRequestsText}</span>
          </div>
        )}

        <nav className="flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''} ${item.highlight ? 'nav-item--highlight' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <item.icon size={20} />
              {item.label}
              {item.highlight && <span className="nav-item__new">NEW</span>}
            </button>
          ))}
        </nav>

        <button className="nav-item bug-report-btn" onClick={() => setShowBugReport(true)}>
          <Bug size={20} />
          Báo lỗi
        </button>

        <button className="nav-item logout-btn" onClick={logout}>
          <LogOut size={20} />
          Đăng xuất
        </button>
      </aside>

      <BugReportModal isOpen={showBugReport} onClose={() => setShowBugReport(false)} />
    </>
  );
}

export default Sidebar;
