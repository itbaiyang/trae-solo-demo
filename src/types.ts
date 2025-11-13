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
}

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
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
