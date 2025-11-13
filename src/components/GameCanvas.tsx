import React, { useRef, useEffect } from 'react';
import { Box, BOX_COLORS, GAME_WIDTH, GAME_HEIGHT, clamp } from '../types';
import { ParticleSystem } from '../utils/particles';

interface GameCanvasProps {
  boxes: Box[];
  fallingBox: Box | null;
  currentBoxX: number;
  nextBoxWidth: number;
  nextBoxHeight: number;
  gameOver: boolean;
  cameraY: number;
  score: number;
  highScore: number;
  onMouseMove: (x: number) => void;
  onClick: () => void;
  onBoxLanded?: (box: Box) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  boxes,
  fallingBox,
  currentBoxX,
  nextBoxWidth,
  nextBoxHeight,
  gameOver,
  cameraY,
  score,
  highScore,
  onMouseMove,
  onClick,
  onBoxLanded
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particleSystem = useRef(new ParticleSystem());
  const previousBoxesRef = useRef<Box[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // 检测新落地的箱子
      if (previousBoxesRef.current.length > 0 && boxes.length > previousBoxesRef.current.length) {
        const newBox = boxes[boxes.length - 1];
        const prevBox = previousBoxesRef.current[previousBoxesRef.current.length - 1];
        
        // 如果箱子从移动状态变为静止状态
        if (prevBox.isMoving && !newBox.isMoving) {
          const cnt = 6 + Math.floor(((newBox.precision ?? 0) * 10));
          particleSystem.current.addParticle(
            newBox.x + newBox.width / 2,
            newBox.y + newBox.height,
            newBox.color,
            cnt
          );
          
          if (onBoxLanded) {
            onBoxLanded(newBox);
          }
        }
      }
      
      previousBoxesRef.current = boxes;
      particleSystem.current.update();

      // 清空画布
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(0, cameraY);

      ctx.fillStyle = '#8B4513';
      ctx.fillRect(0, GAME_HEIGHT - 50, GAME_WIDTH, 50);

      // 绘制已放置的箱子：低层正常绘制，高层整体摇摆
      const SWAY_THRESHOLD = 5;
      const swaying = boxes.length >= SWAY_THRESHOLD;
      let pivotX = 0, pivotY = 0, swayX = 0, swayRad = 0;
      if (swaying) {
        const baseBox = boxes.reduce((acc, b) => (b.y > acc.y ? b : acc), boxes[0]);
        pivotX = baseBox.x + baseBox.width / 2;
        pivotY = baseBox.y + baseBox.height / 2;
        const tSec = performance.now() / 1000;
        const freq = 0.25;
        const levelFactor = Math.max(0, boxes.length - SWAY_THRESHOLD + 1);
        const ampX = Math.min(10, levelFactor * 0.6);
        const ampDeg = Math.min(2, levelFactor * 0.15);
        swayX = ampX * Math.sin(2 * Math.PI * freq * tSec);
        swayRad = (ampDeg * Math.sin(2 * Math.PI * freq * tSec + 0.4)) * Math.PI / 180;

        ctx.save();
        ctx.translate(pivotX, pivotY);
        ctx.rotate(swayRad);
        ctx.translate(-pivotX, -pivotY);
        ctx.translate(swayX, 0);

        boxes.forEach(box => {
          ctx.save();
          ctx.translate(box.x + box.width / 2, box.y + box.height / 2);
          ctx.rotate((box.rotation * Math.PI) / 180);
          if (box.warning) {
            const tSec = performance.now() / 1000;
            ctx.globalAlpha = 0.7 + 0.3 * Math.sin(tSec * 10);
          }
          ctx.fillStyle = box.color;
          ctx.fillRect(-box.width / 2, -box.height / 2, box.width, box.height);
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 2;
          ctx.strokeRect(-box.width / 2, -box.height / 2, box.width, box.height);
          ctx.restore();
        });

        ctx.restore();
      } else if (boxes.length > 0) {
        boxes.forEach(box => {
          ctx.save();
          ctx.translate(box.x + box.width / 2, box.y + box.height / 2);
          ctx.rotate((box.rotation * Math.PI) / 180);
          if (box.warning) {
            const tSec = performance.now() / 1000;
            ctx.globalAlpha = 0.7 + 0.3 * Math.sin(tSec * 10);
          }
          ctx.fillStyle = box.color;
          ctx.fillRect(-box.width / 2, -box.height / 2, box.width, box.height);
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 2;
          ctx.strokeRect(-box.width / 2, -box.height / 2, box.width, box.height);
          ctx.restore();
        });
      }

      // 绘制当前控制的箱子（如果游戏没结束）
      if (!gameOver) {
        // 如果有正在掉落的箱子，绘制它
        if (fallingBox) {
          // 绘制掉落轨迹
          ctx.strokeStyle = fallingBox.color;
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.moveTo(fallingBox.x + fallingBox.width / 2, -cameraY + 50);
          ctx.lineTo(fallingBox.x + fallingBox.width / 2, fallingBox.y + fallingBox.height / 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
          
          ctx.save();
          ctx.translate(fallingBox.x + fallingBox.width / 2, fallingBox.y + fallingBox.height / 2);
          ctx.rotate((fallingBox.rotation * Math.PI) / 180);
          
          ctx.fillStyle = fallingBox.color;
          ctx.globalAlpha = 0.9;
          ctx.fillRect(-fallingBox.width / 2, -fallingBox.height / 2, fallingBox.width, fallingBox.height);
          
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 2;
          ctx.strokeRect(-fallingBox.width / 2, -fallingBox.height / 2, fallingBox.width, fallingBox.height);
          
          ctx.restore();
        } else if (boxes.length > 0) {
          const previewY = -cameraY + 10;
          // 绘制预览箱子
          ctx.fillStyle = BOX_COLORS[boxes.length % BOX_COLORS.length];
          ctx.globalAlpha = 0.7;
          ctx.fillRect(currentBoxX, previewY, nextBoxWidth, nextBoxHeight);
          ctx.globalAlpha = 1;
          
          // 绘制预览线
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(currentBoxX + nextBoxWidth / 2, previewY);
          ctx.lineTo(currentBoxX + nextBoxWidth / 2, GAME_HEIGHT);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      particleSystem.current.render(ctx);

      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = '18px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`得分: ${score}  最高分: ${highScore}`, 12, 24);

      const latest = boxes.length > 1 ? boxes[boxes.length - 1] : null;
      const r = latest?.precision ?? 0;
      const barX = 12;
      const barY = 32;
      const barW = clamp(Math.floor(GAME_WIDTH * 0.6), 160, GAME_WIDTH - 24);
      const barH = 12;
      ctx.fillStyle = '#222';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = r > 0.8 ? '#4caf50' : r > 0.6 ? '#ff9800' : '#f44336';
      ctx.fillRect(barX, barY, barW * Math.max(0, Math.min(1, r)), barH);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);

      const basePanelW = clamp(Math.floor(GAME_WIDTH * 0.25), 140, 240);
      const panelW = Math.floor(basePanelW * 0.75);
      const panelX = GAME_WIDTH - panelW - 10;
     
      const panelH = Math.floor((GAME_HEIGHT - 20) * 0.5);
       const panelY = 10 + panelH;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(panelX, panelY, panelW, panelH);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(panelX, panelY, panelW, panelH);
      const headerLineY = panelY + 20;
      ctx.beginPath();
      ctx.moveTo(panelX + 1, headerLineY);
      ctx.lineTo(panelX + panelW - 1, headerLineY);
      ctx.stroke();
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const addBounds = (b: Box) => {
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      };
      boxes.forEach(addBounds);
      if (fallingBox) addBounds(fallingBox);
      minX = Math.min(minX, 0);
      maxX = Math.max(maxX, GAME_WIDTH);
      minY = Math.min(minY, GAME_HEIGHT - 50);
      maxY = Math.max(maxY, GAME_HEIGHT);
      if (!isFinite(minX) || !isFinite(minY)) {
        minX = 0; minY = GAME_HEIGHT - 50; maxX = GAME_WIDTH; maxY = GAME_HEIGHT;
      }
      const pad = 6;
      const spanX = Math.max(1, maxX - minX);
      const spanY = Math.max(1, maxY - minY);
      const contentH = panelH - (headerLineY - panelY) - pad * 2;
      let s = Math.min((panelW - pad * 2) / spanX, contentH / spanY);
      s = Math.min(1, s);
      const tallest = Math.max(50, ...boxes.map(b => b.height), fallingBox ? fallingBox.height : 0);
      while (tallest * s > contentH) {
        s *= 0.9;
      }
      const ox = panelX + pad - minX * s;
      const oy = panelY + panelH - pad - maxY * s;
      ctx.fillStyle = '#8B4513';
      ctx.globalAlpha = 0.8;
      ctx.fillRect(0 * s + ox, (GAME_HEIGHT - 50) * s + oy, GAME_WIDTH * s, 50 * s);
      ctx.globalAlpha = 1;
      boxes.forEach(b => {
        ctx.save();
        ctx.translate((b.x + b.width / 2) * s + ox, (b.y + b.height / 2) * s + oy);
        ctx.rotate((b.rotation * Math.PI) / 180);
        ctx.fillStyle = b.color;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(-b.width * s / 2, -b.height * s / 2, b.width * s, b.height * s);
        ctx.restore();
      });
      if (fallingBox) {
        const fb = fallingBox;
        ctx.save();
        ctx.translate((fb.x + fb.width / 2) * s + ox, (fb.y + fb.height / 2) * s + oy);
        ctx.rotate((fb.rotation * Math.PI) / 180);
        ctx.fillStyle = fb.color;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(-fb.width * s / 2, -fb.height * s / 2, fb.width * s, fb.height * s);
        ctx.restore();
      }

      if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#fff';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('游戏结束!', GAME_WIDTH / 2, GAME_HEIGHT / 2);
        ctx.font = '24px Arial';
        ctx.fillText('点击重新开始', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [boxes, currentBoxX, nextBoxWidth, nextBoxHeight, gameOver, cameraY]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const xCss = e.clientX - rect.left;
    const x = (xCss / rect.width) * GAME_WIDTH;
    onMouseMove(x);
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (e.touches.length > 0) {
      const rect = canvas.getBoundingClientRect();
      const t = e.touches[0];
      const xCss = t.clientX - rect.left;
      const x = (xCss / rect.width) * GAME_WIDTH;
      onMouseMove(x);
    }
  };
  const handleTouchEnd = () => {
    onClick();
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const xCss = e.clientX - rect.left;
    const x = (xCss / rect.width) * GAME_WIDTH;
    onMouseMove(x);
  };
  const handlePointerUp = () => {
    onClick();
  };

  return (
    <canvas
      ref={canvasRef}
      width={GAME_WIDTH}
      height={GAME_HEIGHT}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={onClick}
      style={{
        border: '2px solid #333',
        cursor: gameOver ? 'pointer' : 'crosshair',
        display: 'block',
        margin: '0 auto',
        width: '100%',
        height: 'auto',
        maxHeight: '100vh',
        touchAction: 'none'
      }}
    />
  );
};

export default GameCanvas;
