export interface Box {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  isMoving: boolean;
  velocityX: number;
  velocityY: number;
  rotation: number;
  rotationVelocity: number;
  warning?: boolean;
  precision?: number;
}

export interface GameState {
  boxes: Box[];
  score: number;
  gameOver: boolean;
  isDropping: boolean;
  currentBoxX: number;
  nextBoxWidth: number;
  nextBoxHeight: number;
  fallingBox: Box | null; // 正在掉落的箱子
  lastOverlapRatio?: number;
  settings?: {
    cameraFollowSpeed: number;
    windStrength: number;
    windRotationStrength: number;
  };
  mode?: 'classic' | 'timed' | 'limited';
  timeLeft?: number;
  maxBoxes?: number;
  nextPowerup?: 'wider' | 'lockRotation' | null;
}

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;
export const GROUND_HEIGHT = 50;
export const GRAVITY = 800;
export const FRICTION = 0.98;
export const BOX_COLORS = [
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', 
  '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'
];
export const MU = 0.4;
export const MIN_OVERLAP_RATIO = 0.6;
export const TIP_MARGIN_PX = 6;

export type DifficultyLevel = 'normal' | 'hard';

export interface DifficultyConfig {
  widthRangeForLevel: (level: number) => [number, number];
  heightRangeForLevel: (level: number) => [number, number];
  spawnHeightOffset: (level: number) => number;
  wobbleAmplitude: (level: number) => { vx: number; rotVel: number };
  wobbleFrequency: (level: number) => { vxHz: number; rotHz: number };
  minOverlapRatio: (level: number) => number;
  widthShrinkPerLevel?: number;
  initialRotationPerLevel?: number;
}

export const DIFFICULTY: Record<DifficultyLevel, DifficultyConfig> = {
  normal: {
    widthRangeForLevel: (level: number) => {
      const l = Math.max(0, Math.min(10, level));
      const maxW = 90 - l * 3;
      const minW = 60 - l * 2;
      return [Math.max(40, minW), Math.max(50, maxW)];
    },
    heightRangeForLevel: (level: number) => {
      const l = Math.max(0, Math.min(10, level));
      const maxH = 45 - l * 2;
      const minH = 30 - l * 1.5;
      return [Math.max(22, minH), Math.max(28, maxH)];
    },
    spawnHeightOffset: (level: number) => 10 + Math.max(0, level) * 15,
    wobbleAmplitude: (level: number) => {
      const l = Math.max(0, level);
      return { vx: Math.min(15, 5 + l * 1.2), rotVel: Math.min(6, 2 + l * 0.5) };
    },
    wobbleFrequency: () => ({ vxHz: 0.8, rotHz: 0.9 }),
    minOverlapRatio: (level: number) => 0.6 + Math.min(0.1, level * 0.01),
    widthShrinkPerLevel: 1.5,
    initialRotationPerLevel: 0.2
  },
  hard: {
    widthRangeForLevel: (level: number) => {
      const l = Math.max(0, Math.min(12, level));
      const maxW = 80 - l * 4;
      const minW = 55 - l * 2.5;
      return [Math.max(38, minW), Math.max(45, maxW)];
    },
    heightRangeForLevel: (level: number) => {
      const l = Math.max(0, Math.min(12, level));
      const maxH = 40 - l * 2.5;
      const minH = 28 - l * 2;
      return [Math.max(20, minH), Math.max(26, maxH)];
    },
    spawnHeightOffset: (level: number) => 20 + Math.max(0, level) * 18,
    wobbleAmplitude: (level: number) => {
      const l = Math.max(0, level);
      return { vx: Math.min(18, 8 + l * 1.5), rotVel: Math.min(8, 3 + l * 0.7) };
    },
    wobbleFrequency: () => ({ vxHz: 1.0, rotHz: 1.1 }),
    minOverlapRatio: (level: number) => 0.65 + Math.min(0.1, level * 0.015),
    widthShrinkPerLevel: 2,
    initialRotationPerLevel: 0.3
  }
};

export function randomBetween(min: number, max: number): number {
  return min + Math.random() * Math.max(0, max - min);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
