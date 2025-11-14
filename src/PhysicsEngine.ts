import { Box, GAME_WIDTH, GAME_HEIGHT, GROUND_HEIGHT, GRAVITY, FRICTION, MIN_OVERLAP_RATIO, TIP_MARGIN_PX } from './types';

const DEBUG = true;
const log = (event: string, data: any) => {
  if (DEBUG) console.log('[STACK]', event, data);
};

export class PhysicsEngine {
  static updateBox(box: Box, deltaTime: number): Box {
    const newBox = { ...box };
    const dtSec = deltaTime / 1000;
    const frameFactor = deltaTime / (1000 / 60);
    if (newBox.isTipping && newBox.pivotX !== undefined && newBox.pivotY !== undefined) {
      const m = newBox.width * newBox.height;
      const I = (1 / 12) * m * (newBox.width * newBox.width + newBox.height * newBox.height);
      const comX = newBox.x + newBox.width / 2;
      const dx = Math.abs(comX - (newBox.pivotX as number));
      const dir = comX >= (newBox.pivotX as number) ? 1 : -1;
      const tau = m * GRAVITY * dx;
      const alphaRad = tau / Math.max(1, I);
      const alphaDeg = alphaRad * (180 / Math.PI);
      newBox.rotationVelocity += dir * alphaDeg * dtSec;
      const rotDeltaDeg = newBox.rotationVelocity * dtSec;
      const rotDeltaRad = rotDeltaDeg * Math.PI / 180;
      const cx = newBox.x + newBox.width / 2;
      const cy = newBox.y + newBox.height / 2;
      const vx = cx - (newBox.pivotX as number);
      const vy = cy - (newBox.pivotY as number);
      const rx = Math.cos(rotDeltaRad) * vx - Math.sin(rotDeltaRad) * vy;
      const ry = Math.sin(rotDeltaRad) * vx + Math.cos(rotDeltaRad) * vy;
      const nx = (newBox.pivotX as number) + rx;
      const ny = (newBox.pivotY as number) + ry;
      newBox.rotation += rotDeltaDeg;
      newBox.x = nx - newBox.width / 2;
      newBox.y = ny - newBox.height / 2;
      newBox.rotationVelocity *= Math.pow(FRICTION, frameFactor);
      log('tipping_update', { id: newBox.id, alphaDeg, rotationVelocity: newBox.rotationVelocity, rotation: newBox.rotation });
      if (Math.abs(newBox.rotation) > 85) {
        newBox.isTipping = false;
        newBox.pivotX = undefined;
        newBox.pivotY = undefined;
        newBox.isMoving = true;
        log('tipping_release', { id: newBox.id });
      }
    }
    
    // 应用重力
    if (box.isMoving) {
      newBox.velocityY += GRAVITY * dtSec;
      newBox.velocityX *= Math.pow(FRICTION, frameFactor);
      newBox.rotationVelocity *= Math.pow(FRICTION, frameFactor);
      newBox.x += newBox.velocityX * dtSec;
      newBox.y += newBox.velocityY * dtSec;
      newBox.rotation += newBox.rotationVelocity * dtSec;
      
      // 地面碰撞检测
      if (newBox.y + newBox.height >= GAME_HEIGHT - GROUND_HEIGHT) {
        newBox.y = GAME_HEIGHT - GROUND_HEIGHT - newBox.height;
        newBox.velocityY = 0;
        newBox.velocityX *= 0.8; // 减少水平速度
        newBox.rotationVelocity *= 0.7; // 减少旋转速度
        log('physics_ground_snap', { id: newBox.id, y: newBox.y, height: newBox.height });
        
        // 如果速度很小，停止移动
        if (Math.abs(newBox.velocityX) < 0.1 && Math.abs(newBox.rotationVelocity) < 0.1) {
          newBox.isMoving = false;
          newBox.velocityX = 0;
          newBox.rotationVelocity = 0;
        }
      }
      
      // 边界检测
      if (newBox.x < 0) {
        newBox.x = 0;
        newBox.velocityX = -newBox.velocityX * 0.5;
      } else if (newBox.x + newBox.width > GAME_WIDTH) {
        newBox.x = GAME_WIDTH - newBox.width;
        newBox.velocityX = -newBox.velocityX * 0.5;
      }
    }
    
    return newBox;
  }
  
  static checkCollision(box1: Box, box2: Box): boolean {
    return (
      box1.x < box2.x + box2.width &&
      box1.x + box1.width > box2.x &&
      box1.y < box2.y + box2.height &&
      box1.y + box1.height > box2.y
    );
  }
  
  static resolveCollision(movingBox: Box, staticBox: Box): Box {
    const newBox = { ...movingBox };
    
    // 计算重叠
    const overlapX = Math.min(
      movingBox.x + movingBox.width - staticBox.x,
      staticBox.x + staticBox.width - movingBox.x
    );
    const overlapY = Math.min(
      movingBox.y + movingBox.height - staticBox.y,
      staticBox.y + staticBox.height - movingBox.y
    );
    
    // 对于掉落箱子，优先从上方解决碰撞
    if (movingBox.velocityY >= 0 && movingBox.y < staticBox.y) {
      // 从上方掉落的情况
      newBox.y = staticBox.y - movingBox.height;
      newBox.velocityY = 0;
      newBox.velocityX *= 0.8; // 减少水平速度
      return newBox;
    }
    
    // 选择较小的重叠方向来解决
    if (overlapX < overlapY) {
      // 水平方向解决
      if (movingBox.x < staticBox.x) {
        newBox.x = staticBox.x - movingBox.width;
      } else {
        newBox.x = staticBox.x + staticBox.width;
      }
      newBox.velocityX = -newBox.velocityX * 0.5;
    } else {
      // 垂直方向解决
      if (movingBox.y < staticBox.y) {
        newBox.y = staticBox.y - movingBox.height;
        newBox.velocityY = 0;
      } else {
        newBox.y = staticBox.y + staticBox.height;
        newBox.velocityY = -newBox.velocityY * 0.3;
      }
    }
    
    return newBox;
  }
  
  static checkTowerStability(boxes: Box[]): boolean {
    // 检查是否有箱子倾斜角度过大
    for (const box of boxes) {
      if (Math.abs(box.rotation) > 30) { // 30度阈值
        log('unstable_rotation', { id: box.id, rotation: box.rotation });
        return false;
      }
    }
    
    // 检查是否有箱子掉落
    const supportedBoxes = new Set<number>();
    
    // 找到与地面接触的箱子
    boxes.forEach((box, index) => {
      if (box.y + box.height >= GAME_HEIGHT - GROUND_HEIGHT - 1) {
        supportedBoxes.add(index);
      }
    });
    
    // 检查每个箱子是否被支撑
    for (let i = 0; i < boxes.length; i++) {
      if (supportedBoxes.has(i)) continue;
      
      let isSupported = false;
      for (let j = 0; j < boxes.length; j++) {
        if (i === j) continue;
        
        // 检查箱子i是否在箱子j上方并且有足够的接触
        if (boxes[i].y + boxes[i].height <= boxes[j].y + 5 && // 稍微在上方
            boxes[i].x < boxes[j].x + boxes[j].width - 10 && // 有足够的水平接触
            boxes[i].x + boxes[i].width > boxes[j].x + 10) {
          isSupported = true;
          break;
        }
      }
      
      if (!isSupported) {
        log('unstable_support', { id: boxes[i].id });
        return false;
      }
    }
    
    return true;
  }

}

export function analyzeStackStability(boxes: Box[]): { stable: boolean; failingIndex?: number; reason?: 'slide' | 'tip'; comX?: number; range?: [number, number] } {
  if (boxes.length < 2) return { stable: true };
  const centerX = (b: Box) => b.x + b.width / 2;
  const mass = (b: Box) => b.width * b.height;

  for (let i = 0; i < boxes.length - 1; i++) {
    const support = boxes[i];
    const above = boxes.slice(i + 1);
    const top = boxes[i + 1];

    const L = Math.max(support.x, top.x);
    const R = Math.min(support.x + support.width, top.x + top.width);
    const overlapW = R - L;
    if (overlapW <= 0) {
      log('analysis_slide_no_overlap', { failingIndex: i, range: [L, R] });
      return { stable: false, failingIndex: i, reason: 'slide', range: [L, R] };
    }

    let mSum = 0;
    let mxSum = 0;
    for (const b of above) {
      const m = mass(b);
      mSum += m;
      mxSum += m * centerX(b);
    }
    const COM_x = mxSum / mSum;
    if (COM_x < L - TIP_MARGIN_PX || COM_x > R + TIP_MARGIN_PX) {
      log('analysis_tip_com_outside', { failingIndex: i, comX: COM_x, range: [L, R], TIP_MARGIN_PX });
      return { stable: false, failingIndex: i, reason: 'tip', comX: COM_x, range: [L, R] };
    }
    if (overlapW / top.width < MIN_OVERLAP_RATIO) {
      log('analysis_slide_overlap_ratio_too_low', { failingIndex: i, overlapW, topWidth: top.width, MIN_OVERLAP_RATIO });
      return { stable: false, failingIndex: i, reason: 'slide', comX: COM_x, range: [L, R] };
    }
  }
  return { stable: true };
}
