import React from 'react';

interface JoystickProps {
    onDirection: (x: number, y: number) => void;
}

export const Joystick: React.FC<JoystickProps> = ({ onDirection }) => {
    const btnClass = "w-12 h-12 bg-white/10 border-2 border-white/30 rounded flex items-center justify-center text-white backdrop-blur-sm active:bg-green-500/50 touch-none select-none";
    
    return (
        <div className="grid grid-cols-3 gap-1">
            <div />
            <div 
                className={btnClass} 
                onMouseDown={() => onDirection(0, -1)}
                onTouchStart={(e) => { e.preventDefault(); onDirection(0, -1); }}
            >↑</div>
            <div />
            
            <div 
                className={btnClass} 
                onMouseDown={() => onDirection(-1, 0)}
                onTouchStart={(e) => { e.preventDefault(); onDirection(-1, 0); }}
            >←</div>
            <div className="w-12 h-12 flex items-center justify-center text-xl">❄️</div>
            <div 
                className={btnClass} 
                onMouseDown={() => onDirection(1, 0)}
                onTouchStart={(e) => { e.preventDefault(); onDirection(1, 0); }}
            >→</div>

            <div />
            <div 
                className={btnClass} 
                onMouseDown={() => onDirection(0, 1)}
                onTouchStart={(e) => { e.preventDefault(); onDirection(0, 1); }}
            >↓</div>
            <div />
        </div>
    );
};