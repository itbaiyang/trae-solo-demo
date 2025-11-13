import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import { Box, GameState, GAME_WIDTH, GAME_HEIGHT, GROUND_HEIGHT, BOX_COLORS, DIFFICULTY, DifficultyLevel, randomBetween, clamp, MU, GRAVITY, TIP_MARGIN_PX } from './types';
import { PhysicsEngine, analyzeStackStability } from './PhysicsEngine';
import { playDropSound, playGameOverSound, playSuccessSound } from './utils/sound';
import { saveHighScore, getHighScore } from './utils/score';

const StackingGame: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    boxes: [],
    score: 0,
    gameOver: false,
    isDropping: false,
    currentBoxX: GAME_WIDTH / 2,
    nextBoxWidth: 80,
    nextBoxHeight: 40,
    fallingBox: null,
    settings: {
      cameraFollowSpeed: 0.1,
      windStrength: 0,
      windRotationStrength: 0
    },
    mode: 'classic',
    nextPowerup: null
  });
  const [cameraY, setCameraY] = useState(0);
  const fixedTopY = 580;
  
  const [highScore, setHighScore] = useState(() => getHighScore());

  const difficulty: DifficultyLevel = 'normal';

  const gameLoopRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // 初始化第一个箱子
  useEffect(() => {
    const initialBox: Box = {
      id: 0,
      x: GAME_WIDTH / 2 - 40,
      y: GAME_HEIGHT - GROUND_HEIGHT - 40,
      width: 120,
      height: 60,
      color: BOX_COLORS[0],
      isMoving: false,
      velocityX: 0,
      velocityY: 0,
      rotation: 0,
      rotationVelocity: 0,
      warning: false,
      precision: 1
    };

    setGameState(prev => ({
      ...prev,
      boxes: [initialBox],
      score: 1,
      currentBoxX: GAME_WIDTH / 2 - 40 // 设置初始位置
    }));
  }, []);

  // 游戏循环
  const gameLoop = useCallback((currentTime: number) => {
    const deltaTime = currentTime - lastTimeRef.current;
    lastTimeRef.current = currentTime;

    setGameState(prevState => {
      if (prevState.gameOver) return prevState;

      let newBoxes = [...prevState.boxes];
      let newFallingBox = prevState.fallingBox;
      let placementFailed = false;
      let addedScoreBonus = 0;
      let lastOverlapRatioLocal: number | undefined = undefined;
      
      // 更新掉落箱子的物理
      if (newFallingBox) {
        newFallingBox = PhysicsEngine.updateBox(newFallingBox, deltaTime);
        const tSec = currentTime / 1000;
        if (newFallingBox.isMoving) {
          const windVX = Math.sin(tSec * 0.8 + 1.3) * (prevState.settings?.windStrength || 0);
          const windRot = Math.sin(tSec * 1.1 + 0.7) * (prevState.settings?.windRotationStrength || 0);
          newFallingBox.velocityX += windVX * (deltaTime / 1000);
          newFallingBox.rotationVelocity += windRot * (deltaTime / 1000);
        }

        const lastBox = newBoxes.length > 0 ? newBoxes[newBoxes.length - 1] : null;
        // 计算与渲染一致的整体摇摆的水平偏移，仅用于碰撞与落顶判定
        const SWAY_THRESHOLD = 5;
        let swayX = 0;
        if (newBoxes.length >= SWAY_THRESHOLD) {
          const tSec = currentTime / 1000;
          const freq = 0.25;
          const levelFactor = Math.max(0, newBoxes.length - SWAY_THRESHOLD + 1);
          const ampX = Math.min(10, levelFactor * 0.6);
          swayX = ampX * Math.sin(2 * Math.PI * freq * tSec);
        }
        let hasCollisionWithLast = false;

        // 与地面碰撞视为失败
        if (newFallingBox.y + newFallingBox.height >= GAME_HEIGHT - GROUND_HEIGHT) {
          placementFailed = true;
        }

        // 仅允许与上一个箱子碰撞
        const adjustedLast = lastBox ? { ...lastBox, x: lastBox.x + swayX } : null;
        if (adjustedLast && PhysicsEngine.checkCollision(newFallingBox, adjustedLast)) {
          hasCollisionWithLast = true;
          newFallingBox = PhysicsEngine.resolveCollision(newFallingBox, adjustedLast);
        }

        // 与除上一个以外的任何箱子碰撞均失败
        if (!placementFailed && newBoxes.length > 1) {
          for (let i = 0; i < newBoxes.length - 1; i++) {
            const box = newBoxes[i];
            if (PhysicsEngine.checkCollision(newFallingBox, box)) {
              placementFailed = true;
              break;
            }
          }
        }

        // 如果合法地与上一个箱子接触且速度很小，则判定是否落在其顶部
        if (!placementFailed && hasCollisionWithLast && Math.abs(newFallingBox.velocityY) < 0.5) {
          const leftA = newFallingBox.x;
          const rightA = newFallingBox.x + newFallingBox.width;
          const leftB = (adjustedLast as Box).x;
          const rightB = (adjustedLast as Box).x + (adjustedLast as Box).width;
          const overlap = Math.min(rightA, rightB) - Math.max(leftA, leftB);
          const overlapRatio = Math.max(0, overlap) / Math.min(newFallingBox.width, (adjustedLast as Box).width);

          if (overlapRatio >= 0.5 && newFallingBox.y <= lastBox!.y - newFallingBox.height + 0.5) {
            // 为避免加入塔体后出现位置“闪动”，在加入前对其坐标做整体摇摆的逆变换
            const SWAY_THRESHOLD = 5;
            const prospectiveCount = newBoxes.length + 1; // 加入后用于渲染的层数
            if (prospectiveCount >= SWAY_THRESHOLD) {
              const baseBox = newBoxes.reduce((acc, b) => (b.y > acc.y ? b : acc), newBoxes[0]);
              const pivotX = baseBox.x + baseBox.width / 2;
              const pivotY = baseBox.y + baseBox.height / 2;
              const tSec = currentTime / 1000;
              const freq = 0.25;
              const levelFactor = Math.max(0, prospectiveCount - SWAY_THRESHOLD + 1);
              const ampX = Math.min(10, levelFactor * 0.6);
              const ampDeg = Math.min(2, levelFactor * 0.15);
              const swayXPlace = ampX * Math.sin(2 * Math.PI * freq * tSec);
              const swayRadPlace = (ampDeg * Math.sin(2 * Math.PI * freq * tSec + 0.4)) * Math.PI / 180;
              const cosT = Math.cos(-swayRadPlace);
              const sinT = Math.sin(-swayRadPlace);
              const cx = newFallingBox.x + newFallingBox.width / 2;
              const cy = newFallingBox.y + newFallingBox.height / 2;
              const vx = cx - swayXPlace - pivotX;
              const vy = cy - pivotY;
              const rx = cosT * vx - sinT * vy;
              const ry = sinT * vx + cosT * vy;
              const placedCx = rx + pivotX;
              const placedCy = ry + pivotY;
              newFallingBox.x = placedCx - newFallingBox.width / 2;
              newFallingBox.y = placedCy - newFallingBox.height / 2;
            }
            newFallingBox.isMoving = false;
            newFallingBox.velocityX = 0;
            newFallingBox.velocityY = 0;
            newFallingBox.rotationVelocity = 0;
            newFallingBox.precision = overlapRatio;
            newBoxes.push(newFallingBox);
            newFallingBox = null;
            addedScoreBonus += Math.round(overlapRatio * 5);
            lastOverlapRatioLocal = overlapRatio;
            playSuccessSound();
          } else {
            placementFailed = true;
          }
        }
      }
      
      // 整体摇摆改为渲染层实现，逻辑层不注入摇摆

      newBoxes = newBoxes.map(box => PhysicsEngine.updateBox(box, deltaTime));

      const analysis = analyzeStackStability(newBoxes);
      if (analysis.range && analysis.comX !== undefined && newBoxes.length > 0) {
        const [L, R] = analysis.range;
        const nearEdge = Math.min(Math.abs((analysis.comX as number) - L), Math.abs((analysis.comX as number) - R)) < TIP_MARGIN_PX;
        const ti = newBoxes.length - 1;
        newBoxes[ti] = { ...newBoxes[ti], warning: nearEdge };
      }
      if (!analysis.stable && analysis.failingIndex !== undefined) {
        const range = analysis.range || [0, 0];
        const pivotX = (range[0] + range[1]) / 2;
        const dir = analysis.comX !== undefined ? Math.sign((analysis.comX as number) - pivotX) || 1 : 1;
        for (let j = analysis.failingIndex + 1; j < newBoxes.length; j++) {
          const b = { ...newBoxes[j] };
          b.isMoving = true;
          const m = b.width * b.height;
          const N = m * GRAVITY;
          const dx = Math.abs((analysis.comX as number) - (dir > 0 ? range[1] : range[0]));
          const Freq = m * GRAVITY * (dx / Math.max(1, b.height));
          const Fmax = MU * N;
          if (Freq > Fmax) {
            b.velocityX += dir * 30;
          } else {
            const I = (1 / 3) * m * b.width * b.width;
            const tau = m * GRAVITY * dx;
            const alpha = tau / Math.max(1, I);
            b.rotationVelocity += dir * alpha * (deltaTime / 1000);
          }
          b.velocityY += 50;
          newBoxes[j] = b;
        }
      }
      
      // 检查塔稳定性
      const isStable = !placementFailed && PhysicsEngine.checkTowerStability(newBoxes);
      
      // 如果游戏结束，播放音效并保存高分
      if (!isStable && !prevState.gameOver) {
        playGameOverSound();
        saveHighScore(prevState.score);
        setHighScore(getHighScore());
      }
      
      if (!isStable) {
        setCameraY(0);
      } else {
        if (newBoxes.length <= 8) {
          setCameraY(prev => prev + (0 - prev) * 0.3);
        } else {
          const topBox = newBoxes.reduce((acc, b) => (b.y < acc.y ? b : acc), newBoxes[0]);
          const desiredCameraY = fixedTopY - topBox.y;
          setCameraY(prev => prev + (desiredCameraY - prev) * ((gameState.settings?.cameraFollowSpeed) || 0.1));
        }
      }

      const timeLeftNext = prevState.mode === 'timed' ? Math.max(0, (prevState.timeLeft || 30) - deltaTime / 1000) : prevState.timeLeft;
      const limitedFail = prevState.mode === 'limited' && prevState.maxBoxes !== undefined && newBoxes.length >= (prevState.maxBoxes as number);
      const timedFail = prevState.mode === 'timed' && (timeLeftNext as number) <= 0;
      return {
        ...prevState,
        boxes: newBoxes,
        fallingBox: newFallingBox,
        gameOver: !isStable || limitedFail || timedFail,
        score: prevState.score + addedScoreBonus,
        lastOverlapRatio: lastOverlapRatioLocal ?? prevState.lastOverlapRatio,
        timeLeft: timeLeftNext,
        nextPowerup: lastOverlapRatioLocal !== undefined && lastOverlapRatioLocal >= 0.9 ? 'wider' : prevState.nextPowerup
      };
    });

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, []);

  // 开始游戏循环
  useEffect(() => {
    if (!gameState.gameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameLoop, gameState.gameOver]);

  // 鼠标移动控制 - 只在水平方向移动，垂直位置固定在上一个箱子上面
  const handleMouseMove = useCallback((x: number) => {
    if (gameState.gameOver || gameState.fallingBox) return;
    
    setGameState(prev => ({
      ...prev,
      currentBoxX: Math.max(0, Math.min(GAME_WIDTH - prev.nextBoxWidth, x - prev.nextBoxWidth / 2))
    }));
  }, [gameState.gameOver, gameState.fallingBox]);

  // 点击投放箱子
  const handleClick = useCallback(() => {
    if (gameState.gameOver) {
      // 重新开始游戏
      setGameState({
        boxes: [],
        score: 0,
        gameOver: false,
        isDropping: false,
        currentBoxX: GAME_WIDTH / 2,
        nextBoxWidth: 80,
        nextBoxHeight: 40,
        fallingBox: null,
        settings: {
          cameraFollowSpeed: 0.1,
          windStrength: 0,
          windRotationStrength: 0
        },
        mode: 'classic',
        nextPowerup: null
      });
      
      // 重新初始化第一个箱子
      setTimeout(() => {
        const initialBox: Box = {
          id: 0,
          x: GAME_WIDTH / 2 - 40,
          y: GAME_HEIGHT - GROUND_HEIGHT - 40,
        width: 120,
        height: 60,
          color: BOX_COLORS[0],
          isMoving: false,
          velocityX: 0,
          velocityY: 0,
          rotation: 0,
          rotationVelocity: 0,
          warning: false,
          precision: 1
        };

        setGameState(prev => ({
          ...prev,
          boxes: [initialBox],
          score: 1,
          currentBoxX: GAME_WIDTH / 2 - 40
        }));
      }, 100);
      
      return;
    }

    if (gameState.isDropping || gameState.fallingBox) return;

    // 播放投放音效
    playDropSound();

    // 始终让新箱子出现在屏幕顶部
    let newX = gameState.currentBoxX;
    const level = Math.max(0, Math.floor(gameState.boxes.length / 3));
    const spawnOffset = DIFFICULTY[difficulty].spawnHeightOffset(level);
    let newY = -cameraY - spawnOffset;

    // 创建掉落箱子，添加轻微的随机摆动
    const levelForParams = Math.max(0, Math.floor(gameState.boxes.length / 3));
    const wobble = DIFFICULTY[difficulty].wobbleAmplitude(levelForParams);
    const rotBase = (DIFFICULTY[difficulty].initialRotationPerLevel || 0) * levelForParams;
    const fallingBox: Box = {
      id: gameState.boxes.length,
      x: newX,
      y: newY,
      width: gameState.nextBoxWidth,
      height: gameState.nextBoxHeight,
      color: BOX_COLORS[gameState.boxes.length % BOX_COLORS.length],
      isMoving: true,
      velocityX: (Math.random() - 0.5) * wobble.vx,
      velocityY: 0,
      rotation: (Math.random() - 0.5) * (5 + rotBase * 10),
      rotationVelocity: (Math.random() - 0.5) * Math.max(0.2, wobble.rotVel)
    };
    if (gameState.nextPowerup === 'wider') {
      fallingBox.width = Math.floor(fallingBox.width * 1.25);
    } else if (gameState.nextPowerup === 'lockRotation') {
      fallingBox.rotationVelocity = 0;
    }

    setGameState(prev => ({
      ...prev,
      fallingBox: fallingBox,
      score: prev.score + 1,
      isDropping: true,
      nextBoxWidth: (() => {
        const level = Math.max(0, Math.floor(prev.boxes.length / 3));
        const [minW, maxW] = DIFFICULTY[difficulty].widthRangeForLevel(level);
        const shrink = (DIFFICULTY[difficulty].widthShrinkPerLevel || 0) * level;
        const base = randomBetween(Math.max(30, minW - shrink), Math.max(31, maxW - shrink));
        return clamp(base * 1.5, 30, GAME_WIDTH / 3);
      })(),
      nextBoxHeight: (() => {
        const level = Math.max(0, Math.floor(prev.boxes.length / 3));
        const [minH, maxH] = DIFFICULTY[difficulty].heightRangeForLevel(level);
        const base = randomBetween(minH, maxH);
        return clamp(base * 1.5, 20, GAME_HEIGHT / 10);
      })(),
      nextPowerup: null
    }));

    // 重置投放状态
    setTimeout(() => {
      setGameState(prev => ({ ...prev, isDropping: false }));
    }, 500);
  }, [gameState, cameraY]);

  return (
    <div style={{ textAlign: 'center', padding: 0, margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      
      <GameCanvas
        boxes={gameState.boxes}
        fallingBox={gameState.fallingBox}
        currentBoxX={gameState.currentBoxX}
        nextBoxWidth={gameState.nextBoxWidth}
        nextBoxHeight={gameState.nextBoxHeight}
        gameOver={gameState.gameOver}
        cameraY={cameraY}
        score={gameState.score}
        highScore={highScore}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onBoxLanded={(box) => {
          // 可以在这里添加额外的逻辑
          console.log('箱子落地:', box.id);
        }}
      />
      
    </div>
  );
};

export default StackingGame;
