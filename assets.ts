// Pixel art style SVG Banner converted to Data URI
const svgBanner = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="150" viewBox="0 0 600 150">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&amp;display=swap');
      .txt { font-family: 'Press Start 2P', monospace; text-anchor: middle; dominant-baseline: middle; }
      .glow { filter: drop-shadow(0 0 4px rgba(255,255,255,0.5)); }
    </style>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1d1d2b" stroke-width="1"/>
    </pattern>
  </defs>
  
  <!-- Background -->
  <rect width="100%" height="100%" fill="#050510"/>
  <rect width="100%" height="100%" fill="url(#grid)"/>
  
  <!-- Border -->
  <rect x="5" y="5" width="590" height="140" fill="none" stroke="#29adff" stroke-width="4" rx="10"/>
  
  <!-- Snake Text -->
  <text x="50%" y="35%" font-size="48" fill="#ff004d" class="txt glow" stroke="#fff" stroke-width="2">SNAKE</text>
  <text x="50%" y="35%" font-size="48" fill="#ff004d" class="txt">SNAKE</text>
  
  <!-- VS Text -->
  <text x="50%" y="55%" font-size="20" fill="#fff" class="txt">VS</text>
  
  <!-- Pacman Text -->
  <text x="50%" y="78%" font-size="48" fill="#ffec27" class="txt glow" stroke="#b87333" stroke-width="2">PACMAN</text>
  <text x="50%" y="78%" font-size="48" fill="#ffec27" class="txt">PACMAN</text>

  <!-- Decor: Pacman -->
  <circle cx="50" cy="75" r="25" fill="#ffec27" />
  <path d="M 50 75 L 80 60 L 80 90 Z" fill="#050510" />

  <!-- Decor: Snake Head -->
  <rect x="520" y="50" width="30" height="30" fill="#63c74d" />
  <rect x="535" y="50" width="10" height="10" fill="#fff" /> <!-- Eye -->
  <rect x="540" y="52" width="4" height="4" fill="#000" /> <!-- Pupil -->
  <rect x="520" y="80" width="30" height="10" fill="#b4eeb4" />
  <rect x="520" y="90" width="20" height="10" fill="#63c74d" />
</svg>
`;

// Encode SVG to Data URI
export const BANNER_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgBanner.trim())}`;
