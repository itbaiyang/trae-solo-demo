export const playSound = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    console.warn('音频播放失败:', error);
  }
};

export const playDropSound = () => {
  playSound(200, 0.2, 'square');
};

export const playGameOverSound = () => {
  playSound(150, 0.5, 'sawtooth');
};

export const playSuccessSound = () => {
  playSound(400, 0.1, 'sine');
  setTimeout(() => playSound(600, 0.1, 'sine'), 100);
};