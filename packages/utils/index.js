// packages/utils/index.js
// CommonJS exports for all utility modules
module.exports = {
  ...require('./errorService'),
  contextTracker: require('./contextTracker'), // Now a direct require since we use module.exports = contextTracker
  ...require('./imageProcessor'),
  ...require('./contextManager'),
  ...require('./pdfProcessor'),
  ...require('./pptProcessor'),
  ...require('./textProcessor'),
  ...require('./streamUtils'),
  ...require('./formatMessages'),
  ...require('./parallelProcessor')
}; 