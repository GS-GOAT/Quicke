export class ParallelRequestProcessor {
  constructor(options = {}) {
    this.maxConcurrentRequests = options.maxConcurrentRequests || 5;
    this.retryCount = options.retryCount || 2;
    this.retryDelay = options.retryDelay || 1000; // ms
    this.queue = [];
    this.activeRequests = 0;
  }

  async processRequests(requests, metadata = {}) {
    const results = {};
    
    const promises = Object.entries(requests).map(([modelId, requestFn]) => 
      this.enqueueRequest(modelId, requestFn, metadata)
        .then(response => {
          results[modelId] = { text: response };
          return { modelId, success: true };
        })
        .catch(error => {
          console.error(`Error with ${modelId}:`, error);
          results[modelId] = { error: error.message || 'Request failed' };
          return { modelId, success: false };
        })
    );
    
    await Promise.all(promises);
    return results;
  }

  enqueueRequest(modelId, requestFn, metadata) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        modelId,
        execute: requestFn,
        metadata,
        resolve,
        reject,
        retries: 0
      });
      
      this.processQueue();
    });
  }

  processQueue() {
    if (this.activeRequests >= this.maxConcurrentRequests || this.queue.length === 0) {
      return;
    }

    while (this.activeRequests < this.maxConcurrentRequests && this.queue.length > 0) {
      const request = this.queue.shift();
      this.executeRequest(request);
    }
  }

  executeRequest(request) {
    this.activeRequests++;

    request.execute()
      .then(response => {
        this.activeRequests--;
        request.resolve(response);
        this.processQueue();
      })
      .catch(error => {
        this.activeRequests--;
        
        if (request.retries < this.retryCount) {
          request.retries++;
          const delay = this.retryDelay * Math.pow(2, request.retries - 1);
          
          console.log(`Request to ${request.modelId} failed, retrying (${request.retries}/${this.retryCount}) after ${delay}ms`);
          
          setTimeout(() => {
            this.queue.unshift(request);
            this.processQueue();
          }, delay);
        } else {
          request.reject(error);
          this.processQueue();
        }
      });
  }
}
