## 总览
- 在不破坏现有核心玩法的基础上，分阶段实现你列出的优化项：掉落节奏、视觉反馈、相机与 UI、物理与判定、关卡与模式。
- 每一项都给出具体落点、涉及文件、伪代码与验证点。你确认后我直接实现并验证。

## 掉落节奏
1) 动态难度（随分数调整尺寸与初始扰动）
- 文件：`src/App.tsx`
- 逻辑：将 `nextBoxWidth/Height` 由线性改为分段曲线；随 `score` 增大初始 `velocityX` 与 `rotationVelocity`。
- 伪代码：
  - `sizeFactor = clamp(1 - score*0.015, 0.35, 1)`
  - `nextBoxWidth = round(80 * sizeFactor)`，`nextBoxHeight = round(40 * (0.8 + 0.2*sizeFactor))`
  - `spawnVX = rand(-0.6,0.6) * (1 + score*0.02)`，`spawnRV = rand(-0.25,0.25) * (1 + score*0.02)`
- 验证：分数升高后明显更难，但不至于不可能。

2) 风力/随机扰动（缓慢变化的水平风）
- 文件：`src/App.tsx`, `src/PhysicsEngine.ts`
- 逻辑：新增 `windX`（一阶低通噪声），对移动箱子施加 `velocityX += windX*dtSec`。
- 伪代码：
  - `windX = lerp(windX, noise(t)*WMAX, 0.02)`；`WMAX` 难度随分数上升。
- 验证：风缓慢改变，玩家可适应。

## 视觉反馈
1) 精准度评分与粒子/音效
- 文件：`src/App.tsx`, `src/components/GameCanvas.tsx`, `src/utils/sound.ts`
- 逻辑：沿用已计算的水平重叠比例 `overlapRatio`，将得分改为 `base + bonus(overlapRatio)`，并触发不同颜色/强度的粒子与音效。
- 伪代码：
  - `bonus = floor(overlapRatio*10)`；`score += 1 + bonus`
  - `particles.add(count = 5 + bonus)`；`sound.playTier(bonus)`

2) 失稳预警（闪烁/微抖动）
- 文件：`src/PhysicsEngine.ts`, `src/components/GameCanvas.tsx`
- 逻辑：`analyzeStackStability` 返回“接近失稳”的程度；在渲染中对相应箱子画闪烁边框或小幅抖动（不改变物理）。
- 伪代码：
  - `warnLevel = normalize(|COM_x - pivot| / overlapW)`；>阈值时渲染闪烁

## 相机与 UI
1) 固定顶部位置与跟随速度设置
- 文件：`src/App.tsx`, `src/components/GameCanvas.tsx`
- 逻辑：添加简单 UI 控件（滑块/按钮）调整 `fixedTopY` 与 `followAlpha`（插值系数）。
- 伪代码：
  - `fixedTopY ∈ [80, 160]`；`followAlpha ∈ [0.05, 0.2]`

2) 精度条（顶部 HUD）
- 文件：`src/components/GameCanvas.tsx`
- 逻辑：在顶部画一条条形图显示当前投放与上一箱子可能形成的重叠比例（预览阶段用当前鼠标 X 与上一箱计算）。
- 伪代码：
  - `previewOverlap = computeOverlap(currentBoxX, nextBoxWidth, lastBox)`
  - 画绿色/黄色/红色条表示好/中/差，并显示百分比文本

## 物理与判定
1) 摩擦滑移判定（更真实的 slide vs tip）
- 文件：`src/PhysicsEngine.ts`, `src/types.ts`
- 逻辑：在 `analyzeStackStability` 加入摩擦门槛：`shearForce > MU * normalForce` 则更倾向滑移判定；`normalForce ~ 上方总质量`。
- 伪代码：
  - `shear ≈ (COM_x - pivotX)/overlapW * mSum * g`；若 `shear > MU*mSum*g` 则标记为 `slide-likely`

2) 以接触边为枢轴的倾倒（更自然旋转）
- 文件：`src/App.tsx`
- 逻辑：失稳触发时，对上层箱子设置旋转速度与水平速度基于枢轴（接触边中心）方向与距离。
- 伪代码：
  - `pivotX = (L+R)/2`；`dir = sign(COM_x - pivotX)`；`rotationVelocity += dir * kAngle`；`velocityX += dir * kSlide`

## 关卡与模式
1) 挑战模式
- 文件：`src/App.tsx`
- 逻辑：添加 `mode = 'classic'|'challenge'`；挑战模式下有倒计时与目标高度。
- 伪代码：
  - `timer--`；达成目标高度（最高箱顶 < 目标Y）加分或胜利

2) 道具与加成
- 文件：`src/App.tsx`
- 逻辑：随机或通过连击获得道具：如“加宽下一箱”、“锁定旋转 3 秒”、“风力减半”。
- 伪代码：
  - `powerups = { widenNext, lockRotation, reduceWind }`，消费后影响一次或短时段。

## 验证
- 针对每项加开本地交互验证：
  - 难度曲线随分数变化；风力可感知但不过度扰动
  - 精准度评分与粒子/音效与表现一致
  - 预警在接近失稳时明显；相机与 HUD 控件工作正常
  - 物理判定下，临界情况下更容易滑移或倾倒，观感更真实
  - 挑战模式计时与胜负逻辑正确，道具能正确生效

## 实施顺序（可分批提交）
1) 掉落节奏 + 风力
2) 精准度评分 + 粒子/音效
3) 预警闪烁 + 顶部精度条
4) 相机与 UI 调参控件
5) 物理滑移判定 + 枢轴倾倒
6) 模式与道具

确认后我将开始逐项实现并在每一步完成后展示效果。