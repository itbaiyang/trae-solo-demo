import React, { useRef, useEffect } from 'react';
import { Box, BOX_COLORS } from '../types';
import { ParticleSystem } from '../utils/particles';

interface GameCanvasProps {
  boxes: Box[];
  fallingBox: Box | null; // 正在掉落的箱子
  currentBoxX: number;
  nextBoxWidth: number;
  nextBoxHeight: number;
  gameOver: boolean;
  cameraY: number;
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
          particleSystem.current.addParticle(
            newBox.x + newBox.width / 2,
            newBox.y + newBox.height,
            newBox.color,
            8
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
      ctx.fillRect(0, canvas.height - 50, canvas.width, 50);

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
          ctx.lineTo(currentBoxX + nextBoxWidth / 2, canvas.height);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      particleSystem.current.render(ctx);

      ctx.restore();

      if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = '48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('游戏结束!', canvas.width / 2, canvas.height / 2);
        ctx.font = '24px Arial';
        ctx.fillText('点击重新开始', canvas.width / 2, canvas.height / 2 + 50);
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
    const x = e.clientX - rect.left;
    onMouseMove(x);
  };

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      style={{
        border: '2px solid #333',
        cursor: gameOver ? 'pointer' : 'crosshair',
        display: 'block',
        margin: '0 auto'
      }}
    />
  );
};

export default GameCanvas;
