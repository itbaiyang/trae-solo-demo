export const saveHighScore = (score: number): void => {
  try {
    const highScore = getHighScore();
    if (score > highScore) {
      localStorage.setItem('stackingGameHighScore', score.toString());
    }
  } catch (error) {
    console.warn('无法保存高分:', error);
  }
};

export const getHighScore = (): number => {
  try {
    const saved = localStorage.getItem('stackingGameHighScore');
    return saved ? parseInt(saved, 10) : 0;
  } catch (error) {
    console.warn('无法读取高分:', error);
    return 0;
  }
};

export const formatScore = (score: number): string => {
  return score.toString().padStart(3, '0');
};