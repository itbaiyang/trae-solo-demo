import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import { Box, GameState, GAME_WIDTH, GAME_HEIGHT, GROUND_HEIGHT, BOX_COLORS } from './types';
import { PhysicsEngine, analyzeStackStability } from './PhysicsEngine';
import { playDropSound, playGameOverSound } from './utils/sound';
import { saveHighScore, getHighScore, formatScore } from './utils/score';

const StackingGame: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    boxes: [],
    score: 0,
    gameOver: false,
    isDropping: false,
    currentBoxX: GAME_WIDTH / 2,
    nextBoxWidth: 80,
    nextBoxHeight: 40,
    fallingBox: null
  });
  const [cameraY, setCameraY] = useState(0);
  const fixedTopY = 400;
  
  const [highScore, setHighScore] = useState(() => getHighScore());

  const gameLoopRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // 初始化第一个箱子
  useEffect(() => {
    const initialBox: Box = {
      id: 0,
      x: GAME_WIDTH / 2 - 40,
      y: GAME_HEIGHT - GROUND_HEIGHT - 40,
      width: 80,
      height: 40,
      color: BOX_COLORS[0],
      isMoving: false,
      velocityX: 0,
      velocityY: 0,
      rotation: 0,
      rotationVelocity: 0
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
      
      // 更新掉落箱子的物理
      if (newFallingBox) {
        newFallingBox = PhysicsEngine.updateBox(newFallingBox, deltaTime);

        const lastBox = newBoxes.length > 0 ? newBoxes[newBoxes.length - 1] : null;
        let hasCollisionWithLast = false;

        // 与地面碰撞视为失败
        if (newFallingBox.y + newFallingBox.height >= GAME_HEIGHT - GROUND_HEIGHT) {
          placementFailed = true;
        }

        // 仅允许与上一个箱子碰撞
        if (lastBox && PhysicsEngine.checkCollision(newFallingBox, lastBox)) {
          hasCollisionWithLast = true;
          newFallingBox = PhysicsEngine.resolveCollision(newFallingBox, lastBox);
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
          const leftB = lastBox!.x;
          const rightB = lastBox!.x + lastBox!.width;
          const overlap = Math.min(rightA, rightB) - Math.max(leftA, leftB);
          const overlapRatio = overlap / newFallingBox.width;

          if (overlapRatio >= 0.5 && newFallingBox.y <= lastBox!.y - newFallingBox.height + 0.5) {
            newFallingBox.isMoving = false;
            newFallingBox.velocityX = 0;
            newFallingBox.velocityY = 0;
            newFallingBox.rotationVelocity = 0;
            newBoxes.push(newFallingBox);
            newFallingBox = null;
          } else {
            placementFailed = true;
          }
        }
      }
      
      newBoxes = newBoxes.map(box => PhysicsEngine.updateBox(box, deltaTime));

      const analysis = analyzeStackStability(newBoxes);
      if (!analysis.stable && analysis.failingIndex !== undefined) {
        const range = analysis.range || [0, 0];
        const pivotX = (range[0] + range[1]) / 2;
        const dir = analysis.comX !== undefined ? Math.sign((analysis.comX as number) - pivotX) || 1 : 1;
        for (let j = analysis.failingIndex + 1; j < newBoxes.length; j++) {
          const b = { ...newBoxes[j] };
          b.isMoving = true;
          b.velocityY += 50;
          b.velocityX += dir * 30;
          b.rotationVelocity += dir * 30;
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
        if (newBoxes.length <= 4) {
          setCameraY(prev => prev + (0 - prev) * 0.3);
        } else {
          const topBox = newBoxes.reduce((acc, b) => (b.y < acc.y ? b : acc), newBoxes[0]);
          const desiredCameraY = fixedTopY - topBox.y;    
          console.log(1111111,desiredCameraY, topBox.y, fixedTopY)
          setCameraY(prev => prev + (desiredCameraY - prev) * 0.1);
        }
      }

      return {
        ...prevState,
        boxes: newBoxes,
        fallingBox: newFallingBox,
        gameOver: !isStable
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
        fallingBox: null
      });
      
      // 重新初始化第一个箱子
      setTimeout(() => {
        const initialBox: Box = {
          id: 0,
          x: GAME_WIDTH / 2 - 40,
          y: GAME_HEIGHT - GROUND_HEIGHT - 40,
          width: 80,
          height: 40,
          color: BOX_COLORS[0],
          isMoving: false,
          velocityX: 0,
          velocityY: 0,
          rotation: 0,
          rotationVelocity: 0
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
    let newY = -cameraY + 10;

    // 创建掉落箱子，添加轻微的随机摆动
    const fallingBox: Box = {
      id: gameState.boxes.length,
      x: newX,
      y: newY,
      width: gameState.nextBoxWidth,
      height: gameState.nextBoxHeight,
      color: BOX_COLORS[gameState.boxes.length % BOX_COLORS.length],
      isMoving: true,
      velocityX: (Math.random() - 0.5) * 0.5, // 轻微的随机水平速度
      velocityY: 0,
      rotation: (Math.random() - 0.5) * 5, // 轻微的初始旋转
      rotationVelocity: (Math.random() - 0.5) * 0.2 // 轻微的旋转速度
    };

    setGameState(prev => ({
      ...prev,
      fallingBox: fallingBox,
      score: prev.score + 1,
      isDropping: true,
      nextBoxWidth: Math.max(40, 80 - prev.score * 2), // 箱子逐渐变小
      nextBoxHeight: Math.max(30, 40 - prev.score) // 箱子逐渐变矮
    }));

    // 重置投放状态
    setTimeout(() => {
      setGameState(prev => ({ ...prev, isDropping: false }));
    }, 500);
  }, [gameState, cameraY]);

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1 style={{ color: '#333', marginBottom: '20px' }}>叠箱子游戏</h1>
      <div style={{ marginBottom: '10px', fontSize: '18px', color: '#666' }}>
        得分: {formatScore(gameState.score)} | 最高分: {formatScore(highScore)}
      </div>
      <GameCanvas
        boxes={gameState.boxes}
        fallingBox={gameState.fallingBox}
        currentBoxX={gameState.currentBoxX}
        nextBoxWidth={gameState.nextBoxWidth}
        nextBoxHeight={gameState.nextBoxHeight}
        gameOver={gameState.gameOver}
        cameraY={cameraY}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onBoxLanded={(box) => {
          // 可以在这里添加额外的逻辑
          console.log('箱子落地:', box.id);
        }}
      />
      <div style={{ marginTop: '20px', color: '#888' }}>
        {!gameState.gameOver && '移动鼠标控制箱子位置，点击投放箱子'}
        {gameState.gameOver && (
          <div style={{ fontSize: '14px', marginTop: '-230px' }}>
            <p>游戏说明：</p>
            <p>• 移动鼠标控制箱子位置</p>
            <p>• 点击投放箱子</p>
            <p>• 保持箱子平衡，不要让塔倒塌</p>
            <p>• 随着得分增加，箱子会越来越小</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StackingGame;
