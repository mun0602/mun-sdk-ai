import React from 'react';
import {
  Smartphone,
  Play,
  Settings,
  User,
  LogOut,
  Calendar,
  Layers,
  Film,
} from 'lucide-react';
import { useLicenseStore, useUIStore } from '../store';

function Sidebar({ isOpen, onClose }) {
  const { license, logout, getLicenseDisplayText } = useLicenseStore();
  const { activeTab, setActiveTab } = useUIStore();

  const navItems = [
    { id: 'devices', icon: Smartphone, label: 'Thiết bị' },
    { id: 'profiles', icon: User, label: 'Profiles' },
    { id: 'tasks', icon: Layers, label: 'Quản lý Task' },
    { id: 'macro', icon: Film, label: 'Quản lý Macro' },
    { id: 'scheduler', icon: Calendar, label: 'Lịch trình' },
    { id: 'execution', icon: Play, label: 'Thực thi' },
    { id: 'settings', icon: Settings, label: 'Cài đặt' },
  ];

  const licenseText = getLicenseDisplayText();
  const isExpiringSoon = licenseText.includes('⚠');

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
            <div className="sidebar-version">v3.7</div>
          </div>
        </div>

        {/* License Status */}
        <div className={`license-badge ${isExpiringSoon ? 'warning' : 'success'}`}>
          <span className="license-text">{licenseText}</span>
        </div>

        <nav className="flex-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <button className="nav-item logout-btn" onClick={logout}>
          <LogOut size={20} />
          Đăng xuất
        </button>
      </aside>
    </>
  );
}

export default Sidebar;
