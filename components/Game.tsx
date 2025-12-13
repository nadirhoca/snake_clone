import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameMode, Point, Particle, SnowFlake } from '../types';
import { Joystick } from './Joystick';

// --- Constants ---
const CELL_SIZE = 20;
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 400;
const COLS = CANVAS_WIDTH / CELL_SIZE;
const ROWS = CANVAS_HEIGHT / CELL_SIZE;

// --- Retro Palette (Slightly desaturated for "Handdrawn/Oldschool" feel) ---
const COLORS = {
    bg: '#050510',
    p1: '#63c74d', // PICO-8 Green
    p1Highlight: '#b4eeb4',
    p2: '#ff004d', // PICO-8 Red/Pink
    p2Highlight: '#ff99aa',
    pacman: '#ffec27', // PICO-8 Yellow
    food: '#ff77a8', // Peach/Pink
    snow: '#c2c3c7', // Light Gray
    text: '#29adff',
    wall: '#5f574f',
    grid: '#1d1d2b'
};

const Game: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // --- React State for UI ---
    const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
    const [mode, setMode] = useState<GameMode>(GameMode.PVC);
    const [scores, setScores] = useState({ p1: 0, p2: 0, best: 0, pacman: 0 });
    const [gameOverReason, setGameOverReason] = useState<string>('');
    const [isMuted, setIsMuted] = useState(false);

    // --- Game Logic State ---
    const frameId = useRef<number>(0);
    const lastTime = useRef<number>(0);
    const moveTimer = useRef<number>(0);
    const moveInterval = useRef<number>(100);
    const shakeOffset = useRef<{x:number, y:number}>({x:0, y:0});
    
    // Entities
    const snake1 = useRef<Point[]>([]);
    const dir1 = useRef<Point>({ x: 0, y: -1 });
    const nextDir1 = useRef<Point>({ x: 0, y: -1 });
    
    const snake2 = useRef<Point[]>([]);
    const dir2 = useRef<Point>({ x: 0, y: -1 });
    const nextDir2 = useRef<Point>({ x: 0, y: -1 });
    
    const food = useRef<Point>({ x: 0, y: 0 });
    const powerup = useRef<Point | null>(null);
    const pacman = useRef<Point | null>(null);
    const pacmanFrozen = useRef<number>(0);
    
    // Visuals
    const particles = useRef<Particle[]>([]);
    const snowflakes = useRef<SnowFlake[]>([]);
    const flashFrame = useRef<number>(0);
    const shakeFrame = useRef<number>(0);

    // Audio Context
    const audioCtx = useRef<AudioContext | null>(null);

    // --- Audio Functions ---
    const initAudio = () => {
        if (!audioCtx.current) {
            audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtx.current.state === 'suspended') {
            audioCtx.current.resume();
        }
    };

    const playSound = useCallback((type: 'move' | 'eat' | 'die' | 'powerup' | 'pacman' | 'warp') => {
        if (isMuted || !audioCtx.current) return;
        
        const ctx = audioCtx.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'eat') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'die') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.4);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (type === 'powerup') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.linearRampToValueAtTime(880, now + 0.1);
            osc.frequency.linearRampToValueAtTime(1760, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'warp') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'pacman') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(400, now + 0.1);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        }
    }, [isMuted]);

    // --- Helpers ---
    const spawnParticles = (x: number, y: number, color: string, count: number = 8) => {
        for (let i = 0; i < count; i++) {
            particles.current.push({
                x: x * CELL_SIZE + CELL_SIZE / 2,
                y: y * CELL_SIZE + CELL_SIZE / 2,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                life: 1.0,
                color,
                size: Math.random() * 4 + 2
            });
        }
    };

    const triggerShake = (amount: number) => {
        shakeFrame.current = amount;
    };

    const wrap = (val: number, max: number) => {
        if (val < 0) return max - 1;
        if (val >= max) return 0;
        return val;
    };

    const placeItem = (exclude: Point[]): Point => {
        let p: Point;
        let valid = false;
        while (!valid) {
            p = {
                x: Math.floor(Math.random() * COLS),
                y: Math.floor(Math.random() * ROWS)
            };
            valid = true;
            for (const s of exclude) if (s.x === p.x && s.y === p.y) valid = false;
        }
        return p!;
    };

    // --- Game Logic ---

    const resetGame = (newMode: GameMode) => {
        initAudio();
        setMode(newMode);
        setGameState('playing');
        setGameOverReason('');
        
        // Reset Stats
        setScores(prev => ({ ...prev, p1: 0, p2: 0, pacman: 0 }));
        moveInterval.current = 100;
        pacmanFrozen.current = 0;
        flashFrame.current = 0;
        shakeFrame.current = 0;
        particles.current = [];

        // P1 Setup
        const startX = newMode === GameMode.PVP ? Math.floor(COLS * 0.75) : Math.floor(COLS / 2);
        snake1.current = [{ x: startX, y: Math.floor(ROWS / 2) }];
        dir1.current = { x: 0, y: -1 };
        nextDir1.current = { x: 0, y: -1 };

        // P2 Setup
        if (newMode === GameMode.PVP) {
            snake2.current = [{ x: Math.floor(COLS * 0.25), y: Math.floor(ROWS / 2) }];
            dir2.current = { x: 0, y: -1 };
            nextDir2.current = { x: 0, y: -1 };
            pacman.current = null;
        } else {
            snake2.current = [];
            let px, py;
            do {
                px = Math.floor(Math.random() * COLS);
                py = Math.floor(Math.random() * ROWS);
            } while (Math.abs(px - startX) < 5);
            pacman.current = { x: px, y: py };
        }

        // Place Food
        const allSegments = [...snake1.current, ...(pacman.current ? [pacman.current] : [])];
        if (snake2.current.length) allSegments.push(...snake2.current);
        food.current = placeItem(allSegments);
        powerup.current = null; 
    };

    // Collision Check (No Wall Death - Wrapping applied in movement)
    const checkCollision = (head: Point, body: Point[]) => {
        for (const part of body) {
            if (head.x === part.x && head.y === part.y) return true;
        }
        return false;
    };

    const handleInput = useCallback((e: KeyboardEvent) => {
        const k = e.key.toLowerCase();
        
        // P1 Controls
        if (k === 'arrowup' && dir1.current.y === 0) nextDir1.current = { x: 0, y: -1 };
        if (k === 'arrowdown' && dir1.current.y === 0) nextDir1.current = { x: 0, y: 1 };
        if (k === 'arrowleft' && dir1.current.x === 0) nextDir1.current = { x: -1, y: 0 };
        if (k === 'arrowright' && dir1.current.x === 0) nextDir1.current = { x: 1, y: 0 };

        // P2 Controls
        if (mode === GameMode.PVP) {
            if (k === 'w' && dir2.current.y === 0) nextDir2.current = { x: 0, y: -1 };
            if (k === 's' && dir2.current.y === 0) nextDir2.current = { x: 0, y: 1 };
            if (k === 'a' && dir2.current.x === 0) nextDir2.current = { x: -1, y: 0 };
            if (k === 'd' && dir2.current.x === 0) nextDir2.current = { x: 1, y: 0 };
        }

        // Restart
        if (k === ' ' && gameState !== 'playing') {
            resetGame(mode);
        }
    }, [gameState, mode]);

    useEffect(() => {
        window.addEventListener('keydown', handleInput);
        return () => window.removeEventListener('keydown', handleInput);
    }, [handleInput]);

    // --- Main Game Loop ---
    const update = (dt: number) => {
        moveTimer.current += dt;

        if (moveTimer.current > moveInterval.current) {
            moveTimer.current = 0;
            
            dir1.current = nextDir1.current;
            if (mode === GameMode.PVP) dir2.current = nextDir2.current;

            let p1Dead = false;
            let p2Dead = false;

            // --- Move P1 (With Wrapping) ---
            const nextX1 = snake1.current[0].x + dir1.current.x;
            const nextY1 = snake1.current[0].y + dir1.current.y;
            
            // Detect warp sound
            if (nextX1 < 0 || nextX1 >= COLS || nextY1 < 0 || nextY1 >= ROWS) {
                // playSound('warp'); // Optional: sounds a bit chaotic if frequent
            }

            const head1 = {
                x: wrap(nextX1, COLS),
                y: wrap(nextY1, ROWS)
            };
            
            if (checkCollision(head1, snake1.current)) p1Dead = true;
            if (mode === GameMode.PVP && checkCollision(head1, snake2.current)) p1Dead = true;

            if (!p1Dead) {
                snake1.current.unshift(head1);
                
                if (head1.x === food.current.x && head1.y === food.current.y) {
                    setScores(s => ({ ...s, p1: s.p1 + 1 }));
                    playSound('eat');
                    spawnParticles(head1.x, head1.y, COLORS.p1);
                    triggerShake(3);
                    food.current = placeItem([...snake1.current, ...snake2.current]);
                    
                    if (!powerup.current && Math.random() < 0.2) {
                        powerup.current = placeItem([...snake1.current, ...snake2.current, food.current]);
                    }
                } 
                else if (powerup.current && head1.x === powerup.current.x && head1.y === powerup.current.y) {
                    setScores(s => ({ ...s, p1: s.p1 + 5 }));
                    playSound('powerup');
                    pacmanFrozen.current = 50;
                    powerup.current = null;
                    flashFrame.current = 10;
                    triggerShake(10);
                } 
                else {
                    snake1.current.pop();
                }
            }

            // --- Move P2 (With Wrapping) ---
            if (mode === GameMode.PVP) {
                const nextX2 = snake2.current[0].x + dir2.current.x;
                const nextY2 = snake2.current[0].y + dir2.current.y;
                const head2 = {
                    x: wrap(nextX2, COLS),
                    y: wrap(nextY2, ROWS)
                };
                
                if (checkCollision(head2, snake2.current)) p2Dead = true;
                if (checkCollision(head2, snake1.current)) p2Dead = true;
                if (head1.x === head2.x && head1.y === head2.y) { p1Dead = true; p2Dead = true; }

                if (!p2Dead) {
                    snake2.current.unshift(head2);
                    if (head2.x === food.current.x && head2.y === food.current.y) {
                        setScores(s => ({ ...s, p2: s.p2 + 1 }));
                        playSound('eat');
                        spawnParticles(head2.x, head2.y, COLORS.p2);
                        triggerShake(3);
                        food.current = placeItem([...snake1.current, ...snake2.current]);
                    } 
                    else if (powerup.current && head2.x === powerup.current.x && head2.y === powerup.current.y) {
                         setScores(s => ({ ...s, p2: s.p2 + 5 }));
                         playSound('powerup');
                         powerup.current = null;
                         flashFrame.current = 10;
                         triggerShake(10);
                    }
                    else {
                        snake2.current.pop();
                    }
                }
            }

            // --- Smart Pacman AI (With Wrapping Awareness) ---
            if (mode === GameMode.PVC && pacman.current) {
                if (pacmanFrozen.current > 0) {
                    pacmanFrozen.current--;
                } else {
                    let dx = food.current.x - pacman.current.x;
                    let dy = food.current.y - pacman.current.y;

                    // Smart Wrap Logic: If distance > half board, going the "other way" is shorter
                    if (Math.abs(dx) > COLS / 2) {
                        dx = dx > 0 ? dx - COLS : dx + COLS;
                    }
                    if (Math.abs(dy) > ROWS / 2) {
                        dy = dy > 0 ? dy - ROWS : dy + ROWS;
                    }
                    
                    let pDirX = 0;
                    let pDirY = 0;

                    if (Math.abs(dx) > Math.abs(dy)) {
                        pDirX = dx > 0 ? 1 : -1;
                    } else {
                        pDirY = dy > 0 ? 1 : -1;
                    }
                    
                    // Apply wrap to pacman movement
                    pacman.current.x = wrap(pacman.current.x + pDirX, COLS);
                    pacman.current.y = wrap(pacman.current.y + pDirY, ROWS);

                    if (pacman.current.x === food.current.x && pacman.current.y === food.current.y) {
                        setScores(s => ({ ...s, pacman: s.pacman + 1 }));
                        playSound('pacman');
                        food.current = placeItem([...snake1.current]);
                    }

                    if (powerup.current && pacman.current.x === powerup.current.x && pacman.current.y === powerup.current.y) {
                        powerup.current = null; // Pacman eats the powerup!
                        spawnParticles(pacman.current.x, pacman.current.y, COLORS.pacman);
                    }
                }
            }

            // --- Resolve Game Over ---
            if (p1Dead || p2Dead) {
                playSound('die');
                triggerShake(20);
                setGameState('gameover');
                if (mode === GameMode.PVP) {
                    if (p1Dead && p2Dead) setGameOverReason("DRAW!");
                    else if (p1Dead) setGameOverReason("PINK WINS!");
                    else setGameOverReason("GREEN WINS!");
                } else {
                    setGameOverReason("GAME OVER");
                    if (scores.p1 > scores.best) setScores(s => ({ ...s, best: s.p1 }));
                }
            }
        }
    };

    const draw = (ctx: CanvasRenderingContext2D) => {
        // --- Screen Shake Transform ---
        ctx.save();
        if (shakeFrame.current > 0) {
            const mag = shakeFrame.current * 1.5; // Magnitude
            const dx = (Math.random() - 0.5) * mag;
            const dy = (Math.random() - 0.5) * mag;
            ctx.translate(dx, dy);
            shakeFrame.current--;
        }

        // Clear
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20); // Oversize clear for shake

        // Draw Grid
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let x=0; x<=CANVAS_WIDTH; x+=CELL_SIZE) { ctx.moveTo(x,0); ctx.lineTo(x,CANVAS_HEIGHT); }
        for(let y=0; y<=CANVAS_HEIGHT; y+=CELL_SIZE) { ctx.moveTo(0,y); ctx.lineTo(CANVAS_WIDTH,y); }
        ctx.stroke();

        // Draw Snowflakes
        ctx.fillStyle = COLORS.snow;
        snowflakes.current.forEach(f => {
            f.y += f.speed;
            f.x += Math.sin(f.y * 0.05 + f.swayOffset) * 0.5;
            if (f.y > CANVAS_HEIGHT) f.y = 0;
            if (f.x > CANVAS_WIDTH) f.x = 0;
            if (f.x < 0) f.x = CANVAS_WIDTH;
            ctx.fillRect(Math.floor(f.x), Math.floor(f.y), Math.floor(f.size), Math.floor(f.size));
        });

        // Helper: Draw 8-bit Block with Eyes option
        const drawSnakeBlock = (x: number, y: number, color: string, highlight: string, isHead: boolean, direction?: Point) => {
            const px = x * CELL_SIZE;
            const py = y * CELL_SIZE;
            
            // Outline
            ctx.fillStyle = '#000';
            ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
            // Main
            ctx.fillStyle = color;
            ctx.fillRect(px + 2, py + 2, CELL_SIZE - 4, CELL_SIZE - 4);
            // Highlight
            ctx.fillStyle = highlight;
            ctx.fillRect(px + 2, py + 2, 4, 4);

            // Draw Eyes if Head
            if (isHead && direction) {
                ctx.fillStyle = '#fff';
                let lx=0, ly=0, rx=0, ry=0;
                // Determine eye position relative to block top-left
                if (direction.y === -1) { lx=4; ly=4; rx=12; ry=4; } // Up
                else if (direction.y === 1) { lx=4; ly=10; rx=12; ry=10; } // Down
                else if (direction.x === -1) { lx=4; ly=4; rx=4; ry=12; } // Left
                else { lx=10; ly=4; rx=10; ry=12; } // Right (default)

                ctx.fillRect(px + lx, py + ly, 4, 4); // Whites
                ctx.fillRect(px + rx, py + ry, 4, 4);
                
                ctx.fillStyle = '#000';
                // Pupils (simple 2x2 dot inside)
                if (direction.x === 1) { ctx.fillRect(px+lx+2, py+ly+1, 2, 2); ctx.fillRect(px+rx+2, py+ry+1, 2, 2); }
                else if (direction.x === -1) { ctx.fillRect(px+lx, py+ly+1, 2, 2); ctx.fillRect(px+rx, py+ry+1, 2, 2); }
                else if (direction.y === 1) { ctx.fillRect(px+lx+1, py+ly+2, 2, 2); ctx.fillRect(px+rx+1, py+ry+2, 2, 2); }
                else { ctx.fillRect(px+lx+1, py+ly, 2, 2); ctx.fillRect(px+rx+1, py+ry, 2, 2); }
            }
        };

        // Draw Food (Pulsing Apple)
        const fx = food.current.x * CELL_SIZE;
        const fy = food.current.y * CELL_SIZE;
        const pulse = Math.floor(Math.sin(Date.now()/150) * 2);
        ctx.fillStyle = COLORS.food;
        ctx.fillRect(fx + 4 - pulse/2, fy + 6 - pulse/2, 12 + pulse, 10 + pulse);
        ctx.fillStyle = '#44ee44';
        ctx.fillRect(fx + 8, fy + 2, 4, 4);

        // Draw Powerup
        if (powerup.current) {
            const px = powerup.current.x * CELL_SIZE;
            const py = powerup.current.y * CELL_SIZE;
            const floatY = Math.floor(Math.sin(Date.now() / 150) * 3);
            ctx.fillStyle = '#29adff';
            ctx.fillRect(px + 2, py + 4 + floatY, 16, 14);
            ctx.fillStyle = '#fff';
            ctx.fillRect(px + 8, py + 4 + floatY, 4, 14); 
            ctx.fillRect(px + 2, py + 10 + floatY, 16, 4);
        }

        // Draw Snakes
        snake1.current.forEach((p, i) => drawSnakeBlock(p.x, p.y, COLORS.p1, COLORS.p1Highlight, i===0, dir1.current));
        if (mode === GameMode.PVP) {
            snake2.current.forEach((p, i) => drawSnakeBlock(p.x, p.y, COLORS.p2, COLORS.p2Highlight, i===0, dir2.current));
        }

        // Draw Pacman
        if (pacman.current) {
            const px = pacman.current.x * CELL_SIZE;
            const py = pacman.current.y * CELL_SIZE;
            ctx.fillStyle = pacmanFrozen.current > 0 ? '#29adff' : COLORS.pacman;
            
            // Retro Ghost Shape if Frozen, Pacman if not
            if (pacmanFrozen.current > 0) {
                 ctx.fillRect(px + 4, py + 2, 12, 16);
                 ctx.fillRect(px + 2, py + 18, 4, 2);
                 ctx.fillRect(px + 14, py + 18, 4, 2);
            } else {
                 ctx.fillRect(px + 4, py, 12, 20); 
                 ctx.fillRect(px, py + 4, 20, 12);
                 ctx.fillRect(px + 2, py + 2, 16, 16);
                 ctx.fillStyle = 'black';
                 // Eye direction roughly based on movement? simplified to right for now
                 ctx.fillRect(px + 10, py + 4, 4, 4);
            }
        }

        // Draw Particles
        particles.current.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;
            if (p.life > 0) {
                ctx.globalAlpha = p.life;
                ctx.fillStyle = p.color;
                ctx.fillRect(Math.floor(p.x), Math.floor(p.y), Math.floor(p.size), Math.floor(p.size));
                ctx.globalAlpha = 1.0;
            }
        });
        particles.current = particles.current.filter(p => p.life > 0);

        // Flash Effect
        if (flashFrame.current > 0) {
            ctx.fillStyle = `rgba(255,255,255,${flashFrame.current * 0.1})`;
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            flashFrame.current--;
        }

        ctx.restore(); // End Shake
    };

    // --- Init Loop ---
    useEffect(() => {
        // Init Snow
        if(snowflakes.current.length === 0) {
            for(let i=0; i<60; i++) {
                snowflakes.current.push({
                    x: Math.random() * CANVAS_WIDTH,
                    y: Math.random() * CANVAS_HEIGHT,
                    speed: 0.5 + Math.random() * 1.5,
                    size: 2 + Math.random() * 2,
                    swayOffset: Math.random() * 10
                });
            }
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;

        const loop = (time: number) => {
            if (gameState === 'playing') {
                const dt = time - lastTime.current;
                update(dt);
            }
            draw(ctx);
            lastTime.current = time;
            frameId.current = requestAnimationFrame(loop);
        };
        frameId.current = requestAnimationFrame(loop);

        return () => cancelAnimationFrame(frameId.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState]);

    // --- Mobile Input Handler ---
    const handleJoystick = (dx: number, dy: number) => {
        if (dx !== 0 && dir1.current.x === 0) nextDir1.current = { x: dx, y: 0 };
        if (dy !== 0 && dir1.current.y === 0) nextDir1.current = { x: 0, y: dy };
    };

    return (
        <div className="relative border-4 border-[#aeeaff] rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.8)] bg-black p-1">
            <canvas 
                ref={canvasRef} 
                width={CANVAS_WIDTH} 
                height={CANVAS_HEIGHT}
                className="block max-w-full max-h-[70vh] cursor-none"
            />
            
            {/* Scoreboard */}
            <div className="absolute top-4 left-4 font-pixel text-[10px] leading-loose text-white bg-black/70 p-2 rounded border border-gray-700 pointer-events-none z-10">
                {mode === GameMode.PVC ? (
                    <>
                        <div className="text-[#63c74d]">SCORE: {scores.p1}</div>
                        <div className="text-[#ffec27]">PACMAN: {scores.pacman}</div>
                        <div className="text-[#29adff]">BEST: {scores.best}</div>
                    </>
                ) : (
                    <>
                        <div className="text-[#63c74d]">P1 (GREEN): {scores.p1}</div>
                        <div className="text-[#ff004d]">P2 (RED): {scores.p2}</div>
                    </>
                )}
            </div>

            {/* Mute Btn */}
            <button 
                className="absolute top-4 right-4 bg-black/80 text-white p-2 rounded border border-white hover:bg-white hover:text-black z-30 font-pixel text-[10px]"
                onClick={() => setIsMuted(!isMuted)}
            >
                {isMuted ? "🔇" : "🔊"}
            </button>

            {/* Menus */}
            {gameState !== 'playing' && (
                <div className="absolute inset-0 bg-[#050510]/95 flex flex-col items-center justify-center text-center p-8 z-20">
                    <h1 className="font-pixel text-2xl text-[#aeeaff] mb-6 shadow-black drop-shadow-md leading-relaxed animate-pulse">
                        {gameState === 'gameover' ? gameOverReason : <>SNOWFLAKE<br/>SNAKE 8-BIT</>}
                    </h1>
                    
                    {gameState === 'gameover' && (
                         <p className="font-pixel text-[10px] text-gray-400 mb-6">FINAL SCORE: {scores.p1}</p>
                    )}

                    <div className="flex gap-4 mb-8">
                        <button 
                            onClick={() => resetGame(GameMode.PVC)}
                            className="font-pixel text-[10px] bg-[#008800] hover:bg-[#00aa00] text-white py-3 px-4 rounded shadow-[0_4px_0_#005500] active:translate-y-1 active:shadow-none transition-all"
                        >
                            1 PLAYER<br/>(VS PACMAN)
                        </button>
                        <button 
                             onClick={() => resetGame(GameMode.PVP)}
                             className="font-pixel text-[10px] bg-[#0055aa] hover:bg-[#0066cc] text-white py-3 px-4 rounded shadow-[0_4px_0_#003366] active:translate-y-1 active:shadow-none transition-all"
                        >
                            2 PLAYERS<br/>(PVP)
                        </button>
                    </div>

                    <div className="font-pixel text-[8px] text-gray-500 leading-relaxed">
                        P1: ARROW KEYS<br/>
                        P2: WASD
                    </div>
                </div>
            )}
            
            {/* Mobile Controls Overlay */}
            <div className="lg:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-30 opacity-70">
                <Joystick onDirection={handleJoystick} />
            </div>
        </div>
    );
};

export default Game;