export class ChunkRenderer {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 100;
    this.typingSpeed = options.typingSpeed || 30;
    this.maxTypingSpeed = options.maxTypingSpeed || 5;
    this.longResponseThreshold = options.longResponseThreshold || 1000;
    
    this.onChunk = options.onChunk || (() => {});
    this.onComplete = options.onComplete || (() => {});
    
    this.isRendering = false;
    this.queue = [];
    this.currentText = '';
  }

  addText(text, isComplete = false) {
    if (!text) return;

    try {
      // More robust text comparison
      if (text.includes(this.currentText)) {
        const newPortion = text.slice(this.currentText.length);
        if (newPortion.length > 0) {
          this.queue.push(newPortion);
        }
      } else {
        // Reset if text is completely different
        this.queue = [text];
        this.currentText = '';
      }
      
      if (!this.isRendering) {
        this.startRendering(isComplete);
      }
    } catch (error) {
      console.error('ChunkRenderer error:', error);
      // Fallback to immediate display
      this.currentText = text;
      this.onChunk(text);
      if (isComplete) {
        this.onComplete(text);
      }
    }
  }

  startRendering(isComplete = false) {
    if (this.queue.length === 0) {
      this.isRendering = false;
      if (isComplete) {
        this.onComplete(this.currentText);
      }
      return;
    }

    this.isRendering = true;
    const textToProcess = this.queue.shift();
    this.renderTextWithTypingEffect(textToProcess, isComplete);
  }

  renderTextWithTypingEffect(text, isComplete) {
    const isLongResponse = text.length > this.longResponseThreshold;
    const speed = isLongResponse ? this.maxTypingSpeed : this.typingSpeed;
    
    // Optimize chunking for different text lengths
    const chunkSize = isLongResponse ? this.chunkSize * 2 : this.chunkSize;
    
    const chunks = text.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || [];
    this.renderChunks(chunks, 0, speed, isComplete);
  }

  renderChunks(chunks, index, typingSpeed, isComplete) {
    if (index >= chunks.length) {
      setTimeout(() => this.startRendering(isComplete), 10);
      return;
    }
    
    const chunk = chunks[index];
    this.currentText += chunk;
    this.onChunk(this.currentText);
    
    setTimeout(
      () => this.renderChunks(chunks, index + 1, typingSpeed, isComplete),
      chunk.length * typingSpeed / this.chunkSize
    );
  }

  reset() {
    this.queue = [];
    this.currentText = '';
    this.isRendering = false;
  }
}
