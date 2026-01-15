import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { invoke } from '../tauri-mock';

// Enhance Prompt Button Component - Reusable across panels
function EnhancePromptButton({ prompt, onEnhanced, profile, disabled }) {
  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleEnhance = async () => {
    if (!prompt?.trim() || !profile) return;
    
    setIsEnhancing(true);
    try {
      const enhanced = await invoke('enhance_prompt', {
        provider: profile.provider?.name || profile.provider,
        apiKey: profile.provider?.api_key || profile.api_key,
        model: profile.provider?.model || profile.model,
        prompt: prompt.trim(),
        baseUrl: profile.provider?.base_url || profile.base_url || null,
      });
      // Only update if we got a valid response
      if (enhanced && enhanced.trim()) {
        onEnhanced(enhanced);
      } else {
        alert('Không nhận được phản hồi từ AI');
      }
    } catch (e) {
      console.error('Failed to enhance prompt:', e);
      alert(`Lỗi nâng cao prompt: ${e}`);
      // Don't clear the prompt on error - keep original
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={handleEnhance}
      disabled={disabled || isEnhancing || !prompt?.trim() || !profile}
      title="Nâng cao lời nhắc - Sử dụng AI để biến prompt đơn giản thành chi tiết, rõ ràng từng bước"
      style={{ minWidth: '36px' }}
    >
      {isEnhancing ? (
        <div className="spinner" style={{ width: '14px', height: '14px' }} />
      ) : (
        <Sparkles size={14} />
      )}
    </button>
  );
}

export default EnhancePromptButton;
