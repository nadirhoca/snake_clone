export type Point = {
    x: number;
    y: number;
};

export enum GameMode {
    PVC = 'pvc', // Player vs CPU (Pacman)
    PVP = 'pvp'  // Player vs Player
}

export type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    color: string;
    size: number;
};

export type SnowFlake = {
    x: number;
    y: number;
    speed: number;
    size: number;
    swayOffset: number;
};

export type HighScore = {
    name: string;
    score: number;
    date: string;
};