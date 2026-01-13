/**
 * © 2025 - Developed by Mahmoud Qattoush
 * Audio Service - Professional Sound System
 */

import { storage } from '@/services/storage';

type SoundType = 'success' | 'error' | 'warning' | 'info' | 'delete' | 'add' | 'save' | 'cancel' | 'confirm';

interface SoundConfig {
  volume: number;
  enabled: boolean;
}

const SOUND_CONFIG: Record<SoundType, string> = {
  success: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==',
  error: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==',
  warning: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==',
  info: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==',
  delete: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==',
  add: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==',
  save: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==',
  cancel: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA==',
  confirm: 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=='
};

class AudioService {
  private config: SoundConfig = {
    volume: 0.3,
    enabled: true,
  };

  private audioContexts: Map<SoundType, AudioContext> = new Map();
  private oscillators: Map<SoundType, OscillatorNode> = new Map();

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    const saved = localStorage.getItem('audioConfig');
    if (saved) {
      this.config = JSON.parse(saved);
    }
  }

  private saveConfig() {
    const serialized = JSON.stringify(this.config);
    void storage.setItem('audioConfig', serialized);
    localStorage.setItem('audioConfig', serialized);
  }

  setVolume(volume: number) {
    this.config.volume = Math.max(0, Math.min(1, volume));
    this.saveConfig();
  }

  setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
    this.saveConfig();
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getVolume(): number {
    return this.config.volume;
  }

  /**
   * Play synthesized sound based on type
   */
  playSound(input: SoundType | { type: SoundType }) {
    if (!this.config.enabled) return;

    const type: SoundType = typeof input === 'string' ? input : input.type;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioContext.currentTime;
      const duration = 0.2;

      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.connect(gain);
      gain.connect(audioContext.destination);

      // Set frequency and volume based on sound type
      const soundSettings = this.getSoundSettings(type);
      osc.frequency.setValueAtTime(soundSettings.frequency, now);
      gain.gain.setValueAtTime(this.config.volume * soundSettings.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      osc.start(now);
      osc.stop(now + duration);

      // Envelope for more realistic sound
      if (soundSettings.modulate) {
        osc.frequency.setValueAtTime(soundSettings.frequency, now);
        osc.frequency.exponentialRampToValueAtTime(soundSettings.frequency * 0.5, now + duration);
      }
    } catch (error) {
      console.warn('Audio playback failed:', error);
    }
  }

  private getSoundSettings(type: SoundType) {
    const settings: Record<SoundType, { frequency: number; volume: number; modulate: boolean }> = {
      success: { frequency: 800, volume: 0.8, modulate: true },
      error: { frequency: 300, volume: 0.9, modulate: true },
      warning: { frequency: 600, volume: 0.8, modulate: false },
      info: { frequency: 700, volume: 0.6, modulate: false },
      delete: { frequency: 250, volume: 0.85, modulate: true },
      add: { frequency: 900, volume: 0.7, modulate: false },
      save: { frequency: 750, volume: 0.75, modulate: true },
      cancel: { frequency: 400, volume: 0.7, modulate: false },
      confirm: { frequency: 650, volume: 0.75, modulate: true }
    };
    return settings[type];
  }
}

export const audioService = new AudioService();
