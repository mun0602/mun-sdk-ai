// MUN SDK AI - Main App Component
import React, { useEffect, useState } from 'react';
import {
  useLicenseStore,
  useSettingsStore,
  useUIStore,
  useSchedulerStore,
} from './store';
import {
  Sun,
  Moon,
  Menu,
} from 'lucide-react';

// Import components
import LicensePage from './components/LicensePage';
import Sidebar from './components/Sidebar';
import DevicePanel from './components/DevicePanel';
import ProfilePanel from './components/ProfilePanel';
import TaskManagementPanel from './components/TaskManagementPanel';
import MacroPanel from './components/MacroPanel';
import SchedulerPanel from './components/SchedulerPanel';
import ExecutionPanel from './components/ExecutionPanel';
import SettingsPanel from './components/SettingsPanel';

// Main App Component
function MainApp() {
  const { activeTab } = useUIStore();
  const { theme, setTheme } = useSettingsStore();
  const { startScheduler, stopScheduler } = useSchedulerStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Start scheduler on mount
  useEffect(() => {
    startScheduler();
    return () => stopScheduler();
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'devices':
        return <DevicePanel />;
      case 'profiles':
        return <ProfilePanel />;
      case 'tasks':
        return <TaskManagementPanel />;
      case 'macro':
        return <MacroPanel />;
      case 'scheduler':
        return <SchedulerPanel />;
      case 'execution':
        return <ExecutionPanel />;
      case 'settings':
        return <SettingsPanel />;
      default:
        return <DevicePanel />;
    }
  };

  const getTitle = () => {
    const titles = {
      devices: 'Quản lý thiết bị',
      profiles: 'Quản lý Profiles',
      tasks: 'Quản lý Task',
      macro: 'Macro - Ghi & Phát lại',
      scheduler: 'Lịch trình Task',
      execution: 'Thực thi Task',
      settings: 'Cài đặt',
    };
    return titles[activeTab] || 'MUN SDK AI';
  };

  return (
    <div className="app-container">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content">
        <header className="header">
          <div className="flex items-center gap-3">
            <button
              className="mobile-menu-toggle"
              onClick={() => setSidebarOpen(true)}
              title="Mở menu"
            >
              <Menu size={20} />
            </button>
            <h1 className="header-title">{getTitle()}</h1>
          </div>
          <div className="header-actions">
            <button
              className="btn btn-icon btn-secondary"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Chuyển sang Light Mode' : 'Chuyển sang Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>
        <div className="content-area">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

// Root App Component
function App() {
  const { license, isLoading, checkLicense } = useLicenseStore();
  const { theme, loadSettings } = useSettingsStore();

  useEffect(() => {
    checkLicense();
    loadSettings();
  }, []);

  // Apply theme on load
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  if (isLoading) {
    return (
      <div className="license-page">
        <div className="spinner" />
      </div>
    );
  }

  if (!license?.is_valid) {
    return <LicensePage />;
  }

  return <MainApp />;
}

export default App;
