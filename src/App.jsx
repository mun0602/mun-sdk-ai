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
  Monitor,
} from 'lucide-react';

// Import components
import LicensePage from './components/LicensePage';
import Sidebar from './components/Sidebar';
import DevicePanel from './components/DevicePanel';
import ProfilePanel from './components/ProfilePanel';
import TaskManagementPanel from './components/TaskManagementPanel';
import SchedulerPanel from './components/SchedulerPanel';
import ExecutionPanel from './components/ExecutionPanel';
import SettingsPanel from './components/SettingsPanel';
import DocsPanel from './components/DocsPanel';
import ChatExecutionPanel from './components/ChatExecutionPanel';
import SkillsPanel from './components/SkillsPanel';
import WorkflowPanel from './components/WorkflowPanel';

// Main App Component
function MainApp() {
  const { activeTab } = useUIStore();
  const { theme, setTheme, saveSettings } = useSettingsStore();
  const { startScheduler, stopScheduler } = useSchedulerStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Get effective theme (resolve 'system' to actual theme)
  const getEffectiveTheme = () => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };

  // Apply theme on mount and when theme changes
  useEffect(() => {
    const applyTheme = () => {
      const effectiveTheme = getEffectiveTheme();
      document.documentElement.setAttribute('data-theme', effectiveTheme);
    };

    applyTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Start scheduler on mount
  useEffect(() => {
    startScheduler();
    return () => stopScheduler();
  }, []);

  const toggleTheme = () => {
    // Cycle: system -> light -> dark -> system
    const nextTheme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(nextTheme);
    // Save settings after theme change
    setTimeout(() => saveSettings(), 100);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'devices':
        return <DevicePanel />;
      case 'profiles':
        return <ProfilePanel />;
      case 'skills':
        return <SkillsPanel />;
      case 'workflow':
        return <WorkflowPanel />;
      case 'tasks':
        return <TaskManagementPanel />;
      case 'scheduler':
        return <SchedulerPanel />;
      case 'chat':
        return <ChatExecutionPanel />;
      case 'execution':
        return <ExecutionPanel />;
      case 'docs':
        return <DocsPanel />;
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
      skills: 'Skills',
      workflow: 'Workflow & Macro',
      tasks: 'Task Templates',
      scheduler: 'Lịch trình Task',
      chat: 'Chat Agent',
      execution: 'Thực thi Task',
      docs: 'Tài liệu',
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
              title={theme === 'system' ? 'Theo hệ thống (nhấn để chuyển Light)' : theme === 'light' ? 'Light Mode (nhấn để chuyển Dark)' : 'Dark Mode (nhấn để chuyển System)'}
            >
              {theme === 'system' ? <Monitor size={20} /> : theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
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
