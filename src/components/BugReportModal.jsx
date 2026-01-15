// BugReportModal - Cho phép người dùng báo lỗi
import React, { useState } from 'react';
import { X, Bug, Send, AlertTriangle } from 'lucide-react';
import { useLicenseStore, useSettingsStore } from '../store';

const COMPONENTS = [
  { id: 'workflow', label: 'Workflow / Tạo task' },
  { id: 'execution', label: 'Thực thi / Chat' },
  { id: 'profile', label: 'Profile / AI Settings' },
  { id: 'device', label: 'Thiết bị / Kết nối' },
  { id: 'scheduler', label: 'Lịch trình' },
  { id: 'skills', label: 'Skills' },
  { id: 'macro', label: 'Macro / Replay' },
  { id: 'license', label: 'License / Đăng nhập' },
  { id: 'ui', label: 'Giao diện / UI' },
  { id: 'other', label: 'Khác' },
];

const SEVERITY_LEVELS = [
  { id: 'low', label: 'Thấp - Không ảnh hưởng nhiều', color: '#22c55e' },
  { id: 'medium', label: 'Trung bình - Gây khó chịu', color: '#f59e0b' },
  { id: 'high', label: 'Cao - Không thể sử dụng tính năng', color: '#ef4444' },
  { id: 'critical', label: 'Nghiêm trọng - App crash/không hoạt động', color: '#dc2626' },
];

export default function BugReportModal({ isOpen, onClose }) {
  const { license } = useLicenseStore();
  const { settings } = useSettingsStore();
  
  const [formData, setFormData] = useState({
    component: '',
    severity: 'medium',
    title: '',
    description: '',
    steps: '',
    expected: '',
    actual: '',
    email: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.component || !formData.title || !formData.description) {
      setSubmitResult({ success: false, message: 'Vui lòng điền đầy đủ thông tin bắt buộc' });
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      // Collect system info
      const systemInfo = {
        appVersion: '3.20',
        osInfo: navigator.userAgent,
        deviceInfo: `${navigator.platform} - ${window.screen.width}x${window.screen.height}`,
      };

      const payload = {
        ...formData,
        licenseKey: license?.key || null,
        ...systemInfo,
      };

      const response = await fetch(`${settings?.apiBaseUrl || 'https://munsdk.io'}/api/bug-reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitResult({ success: true, message: 'Cảm ơn bạn đã báo lỗi! Chúng tôi sẽ xem xét sớm nhất.' });
        // Reset form after success
        setTimeout(() => {
          setFormData({
            component: '',
            severity: 'medium',
            title: '',
            description: '',
            steps: '',
            expected: '',
            actual: '',
            email: '',
          });
        }, 2000);
      } else {
        setSubmitResult({ success: false, message: result.error || 'Có lỗi xảy ra, vui lòng thử lại' });
      }
    } catch (error) {
      setSubmitResult({ success: false, message: 'Không thể kết nối server, vui lòng thử lại sau' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal bug-report-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><Bug size={20} /> Báo lỗi</h2>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* Component Selection */}
          <div className="input-group">
            <label className="input-label">
              Phần gây lỗi <span className="required">*</span>
            </label>
            <select
              className="input"
              value={formData.component}
              onChange={e => setFormData({ ...formData, component: e.target.value })}
              required
            >
              <option value="">-- Chọn phần bị lỗi --</option>
              {COMPONENTS.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div className="input-group">
            <label className="input-label">Mức độ nghiêm trọng</label>
            <div className="severity-options">
              {SEVERITY_LEVELS.map(s => (
                <label
                  key={s.id}
                  className={`severity-option ${formData.severity === s.id ? 'active' : ''}`}
                  style={{ '--severity-color': s.color }}
                >
                  <input
                    type="radio"
                    name="severity"
                    value={s.id}
                    checked={formData.severity === s.id}
                    onChange={e => setFormData({ ...formData, severity: e.target.value })}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="input-group">
            <label className="input-label">
              Tiêu đề ngắn gọn <span className="required">*</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="Ví dụ: Không thể tạo workflow mới"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              required
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div className="input-group">
            <label className="input-label">
              Mô tả chi tiết <span className="required">*</span>
            </label>
            <textarea
              className="input"
              placeholder="Mô tả lỗi bạn gặp phải..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              required
              rows={4}
            />
          </div>

          {/* Steps to reproduce */}
          <div className="input-group">
            <label className="input-label">Các bước tái tạo lỗi (tùy chọn)</label>
            <textarea
              className="input"
              placeholder="1. Mở workflow&#10;2. Nhấn nút tạo mới&#10;3. ..."
              value={formData.steps}
              onChange={e => setFormData({ ...formData, steps: e.target.value })}
              rows={3}
            />
          </div>

          {/* Expected vs Actual */}
          <div className="input-row">
            <div className="input-group">
              <label className="input-label">Mong đợi</label>
              <textarea
                className="input"
                placeholder="Điều gì nên xảy ra?"
                value={formData.expected}
                onChange={e => setFormData({ ...formData, expected: e.target.value })}
                rows={2}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Thực tế</label>
              <textarea
                className="input"
                placeholder="Điều gì đã xảy ra?"
                value={formData.actual}
                onChange={e => setFormData({ ...formData, actual: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          {/* Email */}
          <div className="input-group">
            <label className="input-label">Email liên hệ (tùy chọn)</label>
            <input
              type="email"
              className="input"
              placeholder="email@example.com"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
            />
            <small className="input-hint">Để chúng tôi có thể liên hệ khi cần thêm thông tin</small>
          </div>

          {/* Result message */}
          {submitResult && (
            <div className={`alert ${submitResult.success ? 'alert--success' : 'alert--error'}`}>
              {submitResult.success ? '✅' : '❌'} {submitResult.message}
            </div>
          )}

          {/* Submit */}
          <div className="modal-footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>Đang gửi...</>
              ) : (
                <><Send size={16} /> Gửi báo cáo</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
