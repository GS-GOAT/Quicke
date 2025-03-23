To implement a continuous animation of moving through the universe with stars in the background that smoothly stops when the first prompt is sent, you'll need to combine HTML5 Canvas for the star field animation with JavaScript event handling. Here's a comprehensive implementation approach:

Creating the Star Field Animation
First, set up the HTML structure with a canvas element that will serve as your universe background:

xml
<div class="universe-container">
  <canvas id="universe" class="universe-canvas"></canvas>
  <div class="content-overlay">
    <!-- Your landing page content goes here -->
    <h1>Welcome to My App</h1>
    <div class="prompt-container">
      <input type="text" id="prompt-input" placeholder="Enter your prompt...">
      <button id="prompt-button">Send</button>
    </div>
  </div>
</div>
Next, add the CSS to position the canvas as a full-screen background:

css
.universe-container {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.universe-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #000;
}

.content-overlay {
  position: relative;
  z-index: 10;
  color: white;
  text-align: center;
  padding-top: 20vh;
}

.prompt-container {
  margin-top: 2rem;
}

#prompt-input {
  padding: 10px 15px;
  width: 300px;
  border-radius: 20px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  backdrop-filter: blur(5px);
}

#prompt-button {
  padding: 10px 20px;
  margin-left: 10px;
  border-radius: 20px;
  border: none;
  background: rgba(100, 100, 255, 0.5);
  color: white;
  cursor: pointer;
  transition: background 0.3s;
}

#prompt-button:hover {
  background: rgba(120, 120, 255, 0.7);
}
Now, implement the JavaScript for the star field animation:

javascript
class Star {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.z = Math.random() * canvas.width;
    
    this.radius = 0.5;
    this.color = "#ffffff";
  }
  
  draw() {
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = this.color;
    this.ctx.fill();
  }
  
  update(speed) {
    // Move the star toward the viewer (z decreases)
    this.z = this.z - speed;
    
    // If the star is now behind us, reset it to far away
    if (this.z <= 0) {
      this.z = this.canvas.width;
      this.x = Math.random() * this.canvas.width;
      this.y = Math.random() * this.canvas.height;
    }
    
    // Calculate how the star's position changes as it moves closer
    // This creates the illusion of moving through space
    let factor = this.z / this.canvas.width;
    this.radius = 0.1 + (1 - factor) * 2;
    
    // Stars appear to move outward from the center as they get closer
    this.x = (this.x - this.canvas.width / 2) * (1 / factor) + this.canvas.width / 2;
    this.y = (this.y - this.canvas.height / 2) * (1 / factor) + this.canvas.height / 2;
    
    // Make stars brighter as they get closer
    const brightness = Math.min(255, Math.floor(255 * (1 - factor)));
    this.color = `rgb(${brightness}, ${brightness}, ${brightness})`;
    
    // If star moves off screen, reset it
    if (this.x < 0 || this.x > this.canvas.width || 
        this.y < 0 || this.y > this.canvas.height) {
      this.z = this.canvas.width;
      this.x = Math.random() * this.canvas.width;
      this.y = Math.random() * this.canvas.height;
    }
  }
}

class Universe {
  constructor() {
    this.canvas = document.getElementById('universe');
    this.ctx = this.canvas.getContext('2d');
    this.stars = [];
    this.speed = 5;
    this.targetSpeed = 5;
    this.isActive = true;
    
    this.resizeCanvas();
    this.initStars(500); // Create 500 stars
    
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // Start the animation
    this.animate();
    
    // Set up event listeners for prompt input
    const promptInput = document.getElementById('prompt-input');
    const promptButton = document.getElementById('prompt-button');
    
    const handlePrompt = () => {
      if (promptInput.value.trim() !== '') {
        this.stopAnimation();
      }
    };
    
    promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handlePrompt();
      }
    });
    
    promptButton.addEventListener('click', handlePrompt);
  }
  
  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  
  initStars(count) {
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push(new Star(this.canvas));
    }
  }
  
  stopAnimation() {
    // Gradually slow down the animation
    this.isActive = false;
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Clear the canvas
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // If animation is stopping, gradually reduce speed
    if (!this.isActive && this.speed > 0) {
      this.speed = Math.max(0, this.speed - 0.1);
    }
    
    // Update and draw stars
    for (const star of this.stars) {
      star.update(this.speed);
      star.draw();
    }
  }
}

// Initialize the universe when the page loads
window.addEventListener('DOMContentLoaded', () => {
  const universe = new Universe();
});
Adding Advanced Effects
To enhance the visual appeal, you can add these additional features:

1. Parallax Star Layers
Create multiple layers of stars moving at different speeds for a parallax effect:

javascript
class Universe {
  constructor() {
    // ... existing code ...
    
    // Create three layers of stars with different speeds
    this.starLayers = [
      { stars: [], count: 200, speedFactor: 0.5 },  // Distant stars (slow)
      { stars: [], count: 200, speedFactor: 1.0 },  // Medium stars
      { stars: [], count: 100, speedFactor: 1.5 }   // Close stars (fast)
    ];
    
    this.initStarLayers();
  }
  
  initStarLayers() {
    this.starLayers.forEach(layer => {
      layer.stars = [];
      for (let i = 0; i < layer.count; i++) {
        const star = new Star(this.canvas);
        star.layerSpeedFactor = layer.speedFactor;
        layer.stars.push(star);
      }
    });
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Clear the canvas
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // If animation is stopping, gradually reduce speed
    if (!this.isActive && this.speed > 0) {
      this.speed = Math.max(0, this.speed - 0.1);
    }
    
    // Update and draw all star layers
    this.starLayers.forEach(layer => {
      layer.stars.forEach(star => {
        star.update(this.speed * star.layerSpeedFactor);
        star.draw();
      });
    });
  }
}
2. Nebula Background Effect
Add a colorful nebula effect in the background:

javascript
class Universe {
  constructor() {
    // ... existing code ...
    this.createNebulaBackground();
  }
  
  createNebulaBackground() {
    // Create an off-screen canvas for the nebula
    this.nebulaCanvas = document.createElement('canvas');
    this.nebulaCanvas.width = this.canvas.width;
    this.nebulaCanvas.height = this.canvas.height;
    const nebulaCtx = this.nebulaCanvas.getContext('2d');
    
    // Create a gradient background
    const gradient = nebulaCtx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    gradient.addColorStop(0, 'rgba(25, 0, 50, 0.3)');
    gradient.addColorStop(0.5, 'rgba(10, 10, 40, 0.3)');
    gradient.addColorStop(1, 'rgba(5, 0, 20, 0.3)');
    
    nebulaCtx.fillStyle = gradient;
    nebulaCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Add some nebula clouds
    for (let i = 0; i < 5; i++) {
      const x = Math.random() * this.canvas.width;
      const y = Math.random() * this.canvas.height;
      const radius = Math.random() * 200 + 100;
      
      const colors = [
        'rgba(100, 50, 255, 0.03)',
        'rgba(50, 100, 255, 0.03)',
        'rgba(255, 50, 100, 0.03)',
        'rgba(50, 255, 100, 0.03)'
      ];
      
      for (let j = 0; j < 10; j++) {
        nebulaCtx.beginPath();
        nebulaCtx.arc(
          x + Math.random() * 100 - 50,
          y + Math.random() * 100 - 50,
          radius * (Math.random() * 0.5 + 0.5),
          0,
          Math.PI * 2
        );
        nebulaCtx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        nebulaCtx.fill();
      }
    }
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Clear the canvas
    this.ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw the nebula background
    this.ctx.drawImage(this.nebulaCanvas, 0, 0);
    
    // ... rest of the animation code ...
  }
}
3. Smooth Transition When Stopping
Improve the stopping animation with a smooth transition:

javascript
class Universe {
  constructor() {
    // ... existing code ...
    this.speed = 5;
    this.targetSpeed = 5;
    this.isActive = true;
    this.easing = 0.05; // Controls how quickly the animation slows down
  }
  
  stopAnimation() {
    this.isActive = false;
    this.targetSpeed = 0;
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Clear the canvas
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Smoothly adjust speed toward target
    if (this.speed !== this.targetSpeed) {
      this.speed += (this.targetSpeed - this.speed) * this.easing;
      
      // If we're very close to zero, just set to zero
      if (this.targetSpeed === 0 && this.speed < 0.1) {
        this.speed = 0;
      }
    }
    
    // ... rest of the animation code ...
  }
}
Integrating with Your Web App
To integrate this animation with your existing web app:

Place the canvas element at the top of your DOM structure so it appears behind everything else

Make sure your app's content has a higher z-index than the canvas

Connect the animation stopping to your app's prompt input logic

Here's how to integrate it with a typical React app:

jsx
import { useEffect, useRef, useState } from 'react';

function StarfieldBackground({ onFirstPrompt }) {
  const canvasRef = useRef(null);
  const universeRef = useRef(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Initialize universe with the canvas
    const universe = new Universe(canvas);
    universeRef.current = universe;
    
    // Clean up on component unmount
    return () => {
      universe.destroy();
    };
  }, []);
  
  return (
    <canvas 
      ref={canvasRef} 
      className="universe-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        background: '#000'
      }}
    />
  );
}

function App() {
  const [hasInteracted, setHasInteracted] = useState(false);
  const universeRef = useRef(null);
  
  const handleFirstPrompt = () => {
    setHasInteracted(true);
    if (universeRef.current) {
      universeRef.current.stopAnimation();
    }
  };
  
  return (
    <div className="app">
      <StarfieldBackground ref={universeRef} />
      
      <main className="content">
        <h1>Welcome to My Futuristic App</h1>
        
        <div className="prompt-section">
          <input 
            type="text" 
            placeholder="Ask me anything..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !hasInteracted) {
                handleFirstPrompt();
              }
            }}
          />
          <button 
            onClick={() => {
              if (!hasInteracted) {
                handleFirstPrompt();
              }
            }}
          >
            Send
          </button>
        </div>
      </main>
    </div>
  );
}
This implementation creates an immersive, animated universe background that smoothly transitions to a static state when the user sends their first prompt, giving your web app a futuristic and engaging feel.