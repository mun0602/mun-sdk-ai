import React, { useState, useEffect } from 'react';
import { Cpu, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useLicenseStore } from '../store';

function LicensePage() {
  const { activateLicense, isLoading, error } = useLicenseStore();
  const [licenseKey, setLicenseKey] = useState(() => {
    return localStorage.getItem('remembered_license_key') || '';
  });
  const [rememberLicense, setRememberLicense] = useState(() => {
    return localStorage.getItem('remember_license') === 'true';
  });
  const [localError, setLocalError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Stagger animation on mount
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setLocalError('Vui lòng nhập license key');
      return;
    }

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
    <div className="license-page-premium">
      {/* Ambient background effects */}
      <div className="license-ambient">
        <div className="license-glow license-glow-1" />
        <div className="license-glow license-glow-2" />
        <div className="license-grid-pattern" />
      </div>

      {/* Floating particles */}
      <div className="license-particles">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`license-particle license-particle-${i + 1}`} />
        ))}
      </div>

      <div className={`license-card-premium ${isVisible ? 'is-visible' : ''}`}>
        {/* Logo with animated ring */}
        <div className="license-logo-container">
          <div className="license-logo-ring" />
          <div className="license-logo-inner">
            <Cpu size={32} strokeWidth={1.5} />
          </div>
          <Sparkles className="license-sparkle" size={16} />
        </div>

        {/* Brand */}
        <div className="license-brand">
          <h1 className="license-title-premium">MUN SDK</h1>
          <span className="license-badge-ai">AI</span>
        </div>
        <p className="license-tagline">Intelligent Android Automation</p>

        {/* Divider */}
        <div className="license-divider">
          <span />
        </div>

        {/* Input field */}
        <div className={`license-input-wrapper ${isFocused ? 'is-focused' : ''} ${licenseKey ? 'has-value' : ''}`}>
          <label className="license-input-label">License Key</label>
          <input
            type="text"
            className="license-input-field"
            placeholder="XXXX-XXXX-XXXX-XXXX"
            value={licenseKey}
            onChange={(e) => {
              setLicenseKey(e.target.value);
              setLocalError('');
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
            spellCheck={false}
            autoComplete="off"
          />
          <div className="license-input-glow" />
        </div>

        {/* Remember checkbox */}
        <label className="license-remember-premium">
          <input
            type="checkbox"
            checked={rememberLicense}
            onChange={(e) => setRememberLicense(e.target.checked)}
          />
          <span className="license-checkbox-custom" />
          <span className="license-remember-text">Lưu license key</span>
        </label>

        {/* Error message */}
        {(localError || error) && (
          <div className="license-error-premium">
            <AlertCircle size={14} />
            <span>{localError || error}</span>
          </div>
        )}

        {/* Submit button */}
        <button
          className="license-btn-premium"
          onClick={handleActivate}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="license-btn-loader" />
          ) : (
            <>
              <span>Kích hoạt</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>

        {/* Footer */}
        <div className="license-footer">
          <span>Powered by Advanced AI</span>
        </div>
      </div>
    </div>
  );
}

export default LicensePage;
