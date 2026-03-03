import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './App.css';

const SHAPES = {
  I: { shape: [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]], color: '#00f0f0', wallKick: [[0,0],[-1,0],[2,0],[-1,2],[2,1]] },
  O: { shape: [[1,1], [1,1]], color: '#f0f000', wallKick: [[0,0]] },
  T: { shape: [[0,1,0], [1,1,1], [0,0,0]], color: '#a000f0', wallKick: [[0,0],[-1,0],[1,0],[0,-1],[-1,1],[1,-1]] },
  S: { shape: [[0,1,1], [1,1,0], [0,0,0]], color: '#00f000', wallKick: [[0,0],[-1,0],[1,0],[0,-1],[-1,-1],[1,1]] },
  Z: { shape: [[1,1,0], [0,1,1], [0,0,0]], color: '#f00000', wallKick: [[0,0],[-1,0],[1,0],[0,-1],[-1,-1],[1,1]] },
  J: { shape: [[1,0,0], [1,1,1], [0,0,0]], color: '#0000f0', wallKick: [[0,0],[-1,0],[1,0],[0,-1],[-1,-1],[1,1]] },
  L: { shape: [[0,0,1], [1,1,1], [0,0,0]], color: '#f0a000', wallKick: [[0,0],[-1,0],[1,0],[0,-1],[-1,1],[1,-1]] },
};

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

const createEmptyBoard = () => Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(null));
const SHAPE_KEYS = Object.keys(SHAPES);

const TetrisGame = () => {
  const [board, setBoard] = useState(createEmptyBoard());
  const [currentPiece, setCurrentPiece] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [holdPiece, setHoldPiece] = useState(null);
  const [canHold, setCanHold] = useState(true);
  const [nextPieces, setNextPieces] = useState([]);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [combo, setCombo] = useState(0);
  const [lastCleared, setLastCleared] = useState([]);
  const [gameMode, setGameMode] = useState('marathon');
  const [targetLines, setTargetLines] = useState(40);
  const [elapsedTime, setElapsedTime] = useState(0);
  const gameLoopRef = useRef(null);

  const getRandomPiece = useCallback(() => {
    const key = SHAPE_KEYS[Math.floor(Math.random() * SHAPE_KEYS.length)];
    return { ...SHAPES[key], key };
  }, []);

  const initNextPieces = useCallback(() => {
    const pieces = [];
    for (let i = 0; i < 5; i++) pieces.push(getRandomPiece());
    return pieces;
  }, [getRandomPiece]);

  const checkCollision = useCallback((piece, pos, boardState) => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const newX = pos.x + x;
          const newY = pos.y + y;
          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT || (boardState[newY] && boardState[newY][newX] !== null)) {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  const mergeBoard = useCallback(() => {
    const newBoard = board.map(row => [...row]);
    if (currentPiece) {
      currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value) {
            const newY = position.y + y;
            const newX = position.x + x;
            if (newY >= 0 && newY < BOARD_HEIGHT && newX >= 0 && newX < BOARD_WIDTH) {
              newBoard[newY][newX] = currentPiece.color;
            }
          }
        });
      });
    }
    return newBoard;
  }, [board, currentPiece, position]);

  const ghostPosition = useMemo(() => {
    if (!currentPiece) return position;
    let ghostY = position.y;
    while (!checkCollision(currentPiece, { x: position.x, y: ghostY + 1 }, board)) ghostY++;
    return { x: position.x, y: ghostY };
  }, [currentPiece, position, board, checkCollision]);

  const clearLines = useCallback((boardState) => {
    let clearedLines = [];
    const newBoard = boardState.filter((row, y) => {
      const isFull = row.every(cell => cell !== null);
      if (isFull) clearedLines.push(y);
      return !isFull;
    });
    while (newBoard.length < BOARD_HEIGHT) newBoard.unshift(Array(BOARD_WIDTH).fill(null));
    
    if (clearedLines.length > 0) {
      setLastCleared(clearedLines);
      setTimeout(() => setLastCleared([]), 300);
      const lineScores = [0, 100, 300, 500, 800, 1200];
      const baseScore = lineScores[clearedLines.length] || 1200;
      setScore(prev => prev + (baseScore + combo * 50) * level);
      setLines(prev => prev + clearedLines.length);
      setCombo(prev => prev + 1);
      setLevel(Math.floor((lines + clearedLines.length) / 10) + 1);
    } else {
      setCombo(0);
    }
    return newBoard;
  }, [combo, level, lines]);

  const spawnPiece = useCallback(() => {
    const newNextPieces = [...nextPieces];
    const newPiece = newNextPieces.shift();
    newNextPieces.push(getRandomPiece());
    setNextPieces(newNextPieces);
    const startPos = { x: Math.floor((BOARD_WIDTH - newPiece.shape[0].length) / 2), y: newPiece.key === 'I' ? -1 : 0 };
    if (checkCollision(newPiece, startPos, board)) {
      setGameOver(true);
      setIsPlaying(false);
      return;
    }
    setCurrentPiece(newPiece);
    setPosition(startPos);
    setCanHold(true);
  }, [nextPieces, board, getRandomPiece, checkCollision]);

  const movePiece = useCallback((dx, dy) => {
    if (!currentPiece || isPaused || gameOver || !isPlaying) return;
    const newPos = { x: position.x + dx, y: position.y + dy };
    if (!checkCollision(currentPiece, newPos, board)) {
      setPosition(newPos);
    } else if (dy > 0) {
      const newBoard = mergeBoard();
      const clearedBoard = clearLines(newBoard);
      setBoard(clearedBoard);
      spawnPiece();
    }
  }, [currentPiece, position, board, isPaused, gameOver, isPlaying, checkCollision, mergeBoard, clearLines, spawnPiece]);

  const rotatePiece = useCallback(() => {
    if (!currentPiece || isPaused || gameOver || !isPlaying || currentPiece.key === 'O') return;
    const rotated = { ...currentPiece, shape: currentPiece.shape[0].map((_, i) => currentPiece.shape.map(row => row[i]).reverse()) };
    const kicks = currentPiece.wallKick || [[0,0]];
    for (const [dx, dy] of kicks) {
      const newPos = { x: position.x + dx, y: position.y + dy };
      if (!checkCollision(rotated, newPos, board)) {
        setCurrentPiece(rotated);
        setPosition(newPos);
        return;
      }
    }
  }, [currentPiece, position, board, isPaused, gameOver, isPlaying, checkCollision]);


  const holdCurrentPiece = useCallback(() => {
    if (!canHold || !currentPiece || isPaused || gameOver || !isPlaying) return;
    if (holdPiece) {
      const temp = { ...currentPiece, shape: SHAPES[currentPiece.key].shape };
      setCurrentPiece({ ...holdPiece, shape: SHAPES[holdPiece.key].shape });
      setPosition({ x: Math.floor((BOARD_WIDTH - holdPiece.shape[0].length) / 2), y: holdPiece.key === 'I' ? -1 : 0 });
      setHoldPiece(temp);
    } else {
      setHoldPiece({ ...currentPiece, shape: SHAPES[currentPiece.key].shape });
      spawnPiece();
    }
    setCanHold(false);
  }, [canHold, currentPiece, holdPiece, isPaused, gameOver, isPlaying, spawnPiece]);

  useEffect(() => {
    if (!isPlaying || isPaused || gameOver) return;
    const interval = Math.max(50, 1000 - (level - 1) * 80);
    gameLoopRef.current = setInterval(() => movePiece(0, 1), interval);
    return () => clearInterval(gameLoopRef.current);
  }, [movePiece, level, isPlaying, isPaused, gameOver]);

  useEffect(() => {
    if (!isPlaying || isPaused) return;
    const timer = setInterval(() => setElapsedTime(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isPlaying, isPaused]);

  const startGame = useCallback(() => {
    setBoard(createEmptyBoard());
    setScore(0);
    setLevel(1);
    setLines(0);
    setCombo(0);
    setGameOver(false);
    setIsPaused(false);
    setIsPlaying(true);
    setHoldPiece(null);
    setCanHold(true);
    setElapsedTime(0);
    setNextPieces(initNextPieces());
    const firstPiece = getRandomPiece();
    setCurrentPiece(firstPiece);
    setPosition({ x: Math.floor((BOARD_WIDTH - firstPiece.shape[0].length) / 2), y: firstPiece.key === 'I' ? -1 : 0 });
  }, [initNextPieces, getRandomPiece]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameOver && e.key !== 'Enter') return;
      if (!isPlaying && e.key !== 'Enter' && e.key !== ' ') return;
      switch (e.key) {
        case 'ArrowLeft': movePiece(-1, 0); break;
        case 'ArrowRight': movePiece(1, 0); break;
        case 'ArrowDown': movePiece(0, 1); break;
        case 'ArrowUp':
        case 'x': rotatePiece(); break;
        case ' ': if (!isPlaying) startGame(); else setIsPaused(prev => !prev); break;
        case 'c':
        case 'Shift': holdCurrentPiece(); break;
        case 'Enter': if (gameOver) startGame(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movePiece, rotatePiece, holdCurrentPiece, gameOver, isPlaying, startGame]);

  const formatTime = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const displayBoard = mergeBoard();

  return (
    <div className="tetris-container">
      <div className="game-header">
        <div className="game-title">俄羅斯方塊 <span className="pro">PRO</span></div>
        <div className="mode-selector">
          <button className={gameMode === 'marathon' ? 'active' : ''} onClick={() => { setGameMode('marathon'); setTargetLines(100); }}>馬拉松</button>
          <button className={gameMode === 'sprint' ? 'active' : ''} onClick={() => { setGameMode('sprint'); setTargetLines(40); }}>Sprint</button>
        </div>
      </div>
      <div className="game-wrapper">
        <div className="panel hold-panel">
          <div className="panel-title">HOLD</div>
          <div className="preview-box">
            {holdPiece ? (
              <div className="preview-grid" style={{ gridTemplateColumns: `repeat(${holdPiece.shape[0].length}, 24px)` }}>
                {holdPiece.shape.map((row, y) => row.map((cell, x) => <div key={`${y}-${x}`} className={`preview-cell ${cell ? 'filled' : ''}`} style={cell ? { backgroundColor: holdPiece.color } : {}} />))}
              </div>
            ) : <div className="preview-empty">按 C 鍵</div>}
          </div>
        </div>
        <div className="game-board-wrapper">
          <div className="game-board">
            {displayBoard.map((row, y) => row.map((cell, x) => <div key={`${y}-${x}`} className={`cell ${cell ? 'filled' : ''} ${lastCleared.includes(y) ? 'cleared' : ''}`} style={cell ? { backgroundColor: cell, boxShadow: `inset 0 0 8px ${cell}80, 0 0 4px ${cell}` } : {}} />))}
            {currentPiece && isPlaying && !gameOver && !isPaused && currentPiece.key !== 'O' && (
              <div className="ghost-piece">
                {currentPiece.shape.map((row, y) => row.map((cell, x) => {
                  if (!cell) return null;
                  const gx = ghostPosition.x + x;
                  const gy = ghostPosition.y + y;
                  if (gx < 0 || gx >= BOARD_WIDTH || gy < 0 || gy >= BOARD_HEIGHT) return null;
                  return <div key={`ghost-${y}-${x}`} className="cell ghost" style={{ left: gx * 31, top: gy * 31, backgroundColor: `${currentPiece.color}40` }} />;
                }))}
              </div>
            )}
            {gameOver && <div className="game-over-overlay"><div className="game-over-text">GAME OVER</div><div className="final-score">最終分數: {score}</div><button onClick={startGame} className="restart-btn">重新開始</button></div>}
            {!isPlaying && !gameOver && <div className="start-overlay"><button onClick={startGame} className="start-btn">開始遊戲</button></div>}
            {isPaused && !gameOver && <div className="pause-overlay"><div className="pause-text">PAUSED</div></div>}
          </div>
        </div>
        <div className="panel next-panel">
          <div className="panel-title">NEXT</div>
          <div className="preview-box">
            {nextPieces.slice(0, 1).map((piece, idx) => (
              <div key={idx} className="preview-grid" style={{ gridTemplateColumns: `repeat(${piece.shape[0].length}, 24px)` }}>
                {piece.shape.map((row, y) => row.map((cell, x) => <div key={`${y}-${x}`} className={`preview-cell ${cell ? 'filled' : ''}`} style={cell ? { backgroundColor: piece.color } : {}} />))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="info-bar">
        <div className="info-item"><span className="info-label">分數</span><span className="info-value score">{score.toLocaleString()}</span></div>
        <div className="info-item"><span className="info-label">等級</span><span className="info-value level">{level}</span></div>
        <div className="info-item"><span className="info-label">行數</span><span className="info-value lines">{lines}/{targetLines}</span></div>
        <div className="info-item"><span className="info-label">時間</span><span className="info-value time">{formatTime(elapsedTime)}</span></div>
        {combo > 0 && <div className="combo-display">{combo} COMBO!</div>}
      </div>
      <div className="controls-guide">
        <span>←→ 移動</span><span>↑ 旋轉</span><span>↓ 軟降</span><span>Space 硬降/暫停</span><span>C Hold</span>
      </div>
    </div>
  );
};

export default TetrisGame;
