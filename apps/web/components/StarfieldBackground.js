import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';

class Star {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.init();
    this.layerSpeedFactor = 1;
  }

  init() {
    // Initialize star at a random position
    this.x = Math.random() * this.canvas.width;
    this.y = Math.random() * this.canvas.height;
    this.z = Math.random() * 1500; // Increased depth for smoother perspective
    this.size = 2;
    
    // Change to pure white color with varying opacity
    const brightness = 255; // Pure white
    this.color = `rgba(${brightness}, ${brightness}, ${brightness}, ${0.7 + Math.random() * 0.3})`; // White with random opacity
  }

  update(speed) {
    // Move star closer to viewer
    this.z = this.z - speed;
    
    // If star is too close, reset it to the back
    if (this.z <= 0) {
      this.init();
      this.z = 1500;
    }
    
    // Calculate perspective
    let scale = 1500 / (this.z);
    
    // Calculate position with perspective
    let x2d = (this.x - this.canvas.width / 2) * scale + this.canvas.width / 2;
    let y2d = (this.y - this.canvas.height / 2) * scale + this.canvas.height / 2;
    
    // Only draw if star is on screen
    if (x2d >= 0 && x2d < this.canvas.width && y2d >= 0 && y2d < this.canvas.height) {
      let size = (1 - this.z / 1500) * this.size;
      this.draw(x2d, y2d, size);
    }
  }

  draw(x, y, size) {
    this.ctx.beginPath();
    this.ctx.fillStyle = this.color;
    this.ctx.arc(x, y, size, 0, Math.PI * 2);
    this.ctx.fill();
  }
}

class Universe {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.speed = 2; // Reduced base speed for smoother movement
    this.targetSpeed = 2;
    this.isActive = true;
    this.easing = 0.02; // Smoother speed transitions
    
    // Create more stars with different speeds
    this.starLayers = [
      { stars: [], count: 400, speedFactor: 0.3 }, // Distant stars (slow)
      { stars: [], count: 300, speedFactor: 0.5 }, // Medium stars
      { stars: [], count: 200, speedFactor: 0.8 }  // Close stars (fast)
    ];
    
    this.resizeCanvas();
    this.initStarLayers();
    
    this.handleResize = this.resizeCanvas.bind(this);
    window.addEventListener('resize', this.handleResize);
    this.animate();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
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

  stopAnimation() {
    this.isActive = false;
    this.targetSpeed = 0;
  }

  // start animation method
  startAnimation() {
    this.isActive = true;
    this.targetSpeed = 2;
    
    // Re-initialize star positions to create a fresh field
    this.initStarLayers();
  }

  destroy() {
    this.isActive = false;
    window.removeEventListener('resize', this.handleResize);
  }

  animate() {
    if (!this.canvas) return;
    requestAnimationFrame(() => this.animate());
    
    // Create subtle trail effect
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (this.speed !== this.targetSpeed) {
      this.speed += (this.targetSpeed - this.speed) * this.easing;
      if (this.targetSpeed === 0 && this.speed < 0.1) {
        this.speed = 0;
      }
    }
    
    // Update and draw stars
    this.starLayers.forEach(layer => {
      layer.stars.forEach(star => {
        star.update(this.speed * star.layerSpeedFactor);
      });
    });
  }
}

const StarfieldBackground = forwardRef((props, ref) => {
  const canvasRef = useRef(null);
  const universeRef = useRef(null);
  const frameRef = useRef();
  const starsRef = useRef([]);

  const generateStars = useCallback((count) => {
    // Get actual canvas dimensions
    const canvas = canvasRef.current;
    const width = canvas.width;
    const height = canvas.height;

    // Calculate star count based on screen size and device
    const isMobile = window.innerWidth <= 768;
    const density = isMobile ? 0.00015 : 0.00020; // Lower density for mobile
    const baseCount = width * height * density;
    const finalCount = Math.min(Math.max(baseCount, 50), 400); // Ensure minimum and maximum

    const stars = [];
    for (let i = 0; i < finalCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.5 + 0.1,
        brightness: Math.random() * 0.5 + 0.5
      });
    }
    return stars;
  }, []);

  useImperativeHandle(ref, () => ({
    stopAnimation: () => {
      if (universeRef.current) {
        universeRef.current.stopAnimation();
      }
    },
    startAnimation: () => {
      if (universeRef.current) {
        universeRef.current.startAnimation();
      }
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const universe = new Universe(canvas);
    universeRef.current = universe;

    return () => {
      universe.destroy();
    };
  }, []);

  // resize handler
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current) return;
      
      const canvas = canvasRef.current;
      const { innerWidth, innerHeight } = window;
      
      // Update canvas size
      canvas.width = innerWidth * window.devicePixelRatio;
      canvas.height = innerHeight * window.devicePixelRatio;
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      
      // Regenerate stars for new dimensions
      starsRef.current = generateStars();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [generateStars]);

  return (
    <canvas 
      ref={canvasRef} 
      className="universe-canvas fixed inset-0 w-full h-full"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        background: '#000',
        pointerEvents: 'none'
      }}
    />
  );
});

StarfieldBackground.displayName = 'StarfieldBackground';
export default StarfieldBackground;
