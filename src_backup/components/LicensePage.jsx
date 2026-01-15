import React, { useState } from 'react';
import { Play, AlertCircle } from 'lucide-react';
import { useLicenseStore } from '../store';

// License Page Component
function LicensePage() {
  const { activateLicense, isLoading, error } = useLicenseStore();
  const [licenseKey, setLicenseKey] = useState(() => {
    return localStorage.getItem('remembered_license_key') || '';
  });
  const [rememberLicense, setRememberLicense] = useState(() => {
    return localStorage.getItem('remember_license') === 'true';
  });
  const [localError, setLocalError] = useState('');

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setLocalError('Vui lòng nhập license key');
      return;
    }

    // Lưu hoặc xóa license key dựa trên checkbox
    if (rememberLicense) {
      localStorage.setItem('remembered_license_key', licenseKey.trim());
      localStorage.setItem('remember_license', 'true');
    } else {
      localStorage.removeItem('remembered_license_key');
      localStorage.setItem('remember_license', 'false');
    }

    try {
      await activateLicense(licenseKey.trim());
    } catch (e) {
      setLocalError(e.toString());
    }
  };

  return (
    <div className="license-page">
      <div className="license-card">
        <div className="license-logo"><Play size={28} fill="currentColor" /></div>
        <h1 className="license-title">MUN SDK AI</h1>
        <p className="license-subtitle">AI Android Controller</p>

        <div className="input-group">
          <input
            type="text"
            className="input w-full"
            placeholder="Nhập license key..."
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
          />
        </div>

        <label className="license-remember" style={{ marginBottom: 'var(--space-4)', fontSize: '0.875rem' }}>
          <input
            type="checkbox"
            checked={rememberLicense}
            onChange={(e) => setRememberLicense(e.target.checked)}
          />
          <span>Nhớ license key</span>
        </label>

        {(localError || error) && (
          <div className="badge badge-error mb-4 w-full justify-center">
            <AlertCircle size={14} />
            {localError || error}
          </div>
        )}

        <button
          className="btn btn-primary w-full"
          onClick={handleActivate}
          disabled={isLoading}
        >
          {isLoading ? <div className="spinner" /> : 'Kích hoạt License'}
        </button>
      </div>
    </div>
  );
}

export default LicensePage;
