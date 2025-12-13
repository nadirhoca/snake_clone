import React, { useState } from 'react';
import Game from './components/Game';

const App: React.FC = () => {
  const [crtEnabled, setCrtEnabled] = useState(true);

  return (
    <div className="relative w-screen h-screen flex items-center justify-center bg-[#050510] text-white overflow-hidden">
      {/* Visual Effects Layer */}
      {crtEnabled && (
        <>
          <div className="scanlines" />
          <div className="vignette" />
        </>
      )}

      {/* Game Container */}
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        <Game />
      </div>

      {/* Footer / Toggle */}
      <div className="absolute bottom-2 right-2 z-50 opacity-50 hover:opacity-100 transition-opacity">
        <button 
          onClick={() => setCrtEnabled(!crtEnabled)}
          className="font-pixel text-[8px] text-white bg-gray-800 p-2 rounded border border-gray-600"
        >
          CRT: {crtEnabled ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
};

export default App;