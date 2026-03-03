import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

// 方塊形狀定義
const SHAPES = {
  I: { shape: [[1, 1, 1, 1]], color: '#00f0f0' },
  O: { shape: [[1, 1], [1, 1]], color: '#f0f000' },
  T: { shape: [[0, 1, 0], [1, 1, 1]], color: '#a000f0' },
  S: { shape: [[0, 1, 1], [1, 1, 0]], color: '#00f000' },
  Z: { shape: [[1, 1, 0], [0, 1, 1]], color: '#f00000' },
  J: { shape: [[1, 0, 0], [1, 1, 1]], color: '#0000f0' },
  L: { shape: [[0, 0, 1], [1, 1, 1]], color: '#f0a000' },
};

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

const createEmptyBoard = () => 
  Array(BOARD_HEIGHT).fill(null).map(() => Array(BOARD_WIDTH).fill(0));

const getRandomShape = () => {
  const keys = Object.keys(SHAPES);
  const key = keys[Math.floor(Math.random() * keys.length)];
  return { ...SHAPES[key], key };
};

const TetrisGame = () => {
  const [board, setBoard] = useState(createEmptyBoard());
  const [currentPiece, setCurrentPiece] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const gameLoopRef = useRef(null);

  const checkCollision = useCallback((piece, pos, boardState) => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x]) {
          const newX = pos.x + x;
          const newY = pos.y + y;
          if (
            newX < 0 || 
            newX >= BOARD_WIDTH || 
            newY >= BOARD_HEIGHT ||
            (boardState[newY] && boardState[newY][newX])
          ) {
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

  const clearLines = useCallback((boardState) => {
    let clearedLines = 0;
    const newBoard = boardState.filter(row => {
      const isFull = row.every(cell => cell !== 0);
      if (!isFull) clearedLines++;
      return !isFull;
    });
    
    while (newBoard.length < BOARD_HEIGHT) {
      newBoard.unshift(Array(BOARD_WIDTH).fill(0));
    }
    
    if (clearedLines > 0) {
      const points = [0, 100, 300, 500, 800];
      setScore(prev => prev + points[clearedLines] * level);
      setLines(prev => prev + clearedLines);
      setLevel(prev => Math.floor(lines / 10) + 1);
    }
    
    return newBoard;
  }, [level, lines]);

  const spawnPiece = useCallback(() => {
    const newPiece = getRandomShape();
    const startPos = { 
      x: Math.floor((BOARD_WIDTH - newPiece.shape[0].length) / 2), 
      y: 0 
    };
    
    if (checkCollision(newPiece, startPos, board)) {
      setGameOver(true);
      setIsPlaying(false);
      return;
    }
    
    setCurrentPiece(newPiece);
    setPosition(startPos);
  }, [board, checkCollision]);

  const movePiece = useCallback((dx, dy) => {
    if (!currentPiece || isPaused || gameOver || !isPlaying) return;
    
    const newPos = { x: position.x + dx, y: position.y + dy };
    
    if (!checkCollision(currentPiece, newPos, board)) {
      setPosition(newPos);
    } else if (dy > 0) {
      // 落地了
      const newBoard = mergeBoard();
      const clearedBoard = clearLines(newBoard);
      setBoard(clearedBoard);
      spawnPiece();
    }
  }, [currentPiece, position, board, isPaused, gameOver, isPlaying, checkCollision, mergeBoard, clearLines, spawnPiece]);

  const rotatePiece = useCallback(() => {
    if (!currentPiece || isPaused || gameOver || !isPlaying) return;
    
    const rotated = {
      ...currentPiece,
      shape: currentPiece.shape[0].map((_, i) => 
        currentPiece.shape.map(row => row[i]).reverse()
      )
    };
    
    if (!checkCollision(rotated, position, board)) {
      setCurrentPiece(rotated);
    } else {
      // 嘗試左右偏移
      if (!checkCollision(rotated, { x: position.x - 1, y: position.y }, board)) {
        setCurrentPiece(rotated);
        setPosition({ ...position, x: position.x - 1 });
      } else if (!checkCollision(rotated, { x: position.x + 1, y: position.y }, board)) {
        setCurrentPiece(rotated);
        setPosition({ ...position, x: position.x + 1 });
      }
    }
  }, [currentPiece, position, board, isPaused, gameOver, isPlaying, checkCollision]);

  const drop = useCallback(() => {
    movePiece(0, 1);
  }, [movePiece]);

  useEffect(() => {
    if (!isPlaying || isPaused || gameOver) return;
    
    const interval = Math.max(100, 1000 - (level - 1) * 100);
    gameLoopRef.current = setInterval(drop, interval);
    
    return () => clearInterval(gameLoopRef.current);
  }, [drop, level, isPlaying, isPaused, gameOver]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (gameOver || !isPlaying) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          movePiece(-1, 0);
          break;
        case 'ArrowRight':
          movePiece(1, 0);
          break;
        case 'ArrowDown':
          movePiece(0, 1);
          break;
        case 'ArrowUp':
          rotatePiece();
          break;
        case ' ':
          setIsPaused(prev => !prev);
          break;
        default:
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movePiece, rotatePiece, gameOver, isPlaying]);

  const startGame = () => {
    setBoard(createEmptyBoard());
    setScore(0);
    setLevel(1);
    setLines(0);
    setGameOver(false);
    setIsPaused(false);
    setIsPlaying(true);
    spawnPiece();
  };

  const displayBoard = mergeBoard();

  return (
    <div className="tetris-container">
      <div className="game-title">俄羅斯方塊</div>
      
      <div className="game-wrapper">
        <div className="game-board">
          {displayBoard.map((row, y) => (
            row.map((cell, x) => (
              <div 
                key={`${y}-${x}`} 
                className={`cell ${cell ? 'filled' : ''}`}
                style={cell ? { backgroundColor: cell, boxShadow: `inset 0 0 10px ${cell}80` } : {}}
              />
            ))
          ))}
          
          {gameOver && (
            <div className="game-over-overlay">
              <div className="game-over-text">遊戲結束</div>
              <button onClick={startGame} className="restart-btn">重新開始</button>
            </div>
          )}
          
          {!isPlaying && !gameOver && (
            <div className="start-overlay">
              <button onClick={startGame} className="start-btn">開始遊戲</button>
            </div>
          )}
          
          {isPaused && !gameOver && (
            <div className="pause-overlay">
              <div className="pause-text">暫停</div>
            </div>
          )}
        </div>
        
        <div className="info-panel">
          <div className="info-box">
            <div className="info-label">分數</div>
            <div className="info-value">{score}</div>
          </div>
          <div className="info-box">
            <div className="info-label">等級</div>
            <div className="info-value">{level}</div>
          </div>
          <div className="info-box">
            <div className="info-label">行數</div>
            <div className="info-value">{lines}</div>
          </div>
          
          <div className="controls-info">
            <div className="controls-title">操作說明</div>
            <div className="control-item">← → 移動</div>
            <div className="control-item">↑ 旋轉</div>
            <div className="control-item">↓ 加速</div>
            <div className="control-item">空白鍵 暫停</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TetrisGame;
