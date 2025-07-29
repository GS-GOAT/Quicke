require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Import route handlers
const streamRouteHandler = require('./routes/stream');
const summarizeRouteHandler = require('./routes/summarize');
const uploadRouteHandler = require('./routes/upload');
const authRequired = require('./middleware/authRequired');
const authOptional = require('./middleware/authOptional');

const app = express();
const port = process.env.PORT || 8080;

const normalizeUrl = (url) => (url && url.endsWith('/') ? url.slice(0, -1) : url);

const allowlist = [
  normalizeUrl('http://localhost:3000'),
  normalizeUrl('https://www.quicke.in'), 
  normalizeUrl('https://quicke-psi.vercel.app')     
].filter(Boolean); 

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    const normalizedOrigin = normalizeUrl(origin);
    if (allowlist.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Origin '${normalizedOrigin}' not allowed.`);
      callback(new Error(`Origin '${normalizedOrigin}' not allowed by CORS.`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Routes 
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'API Worker is healthy' });
});

// Apply JWT validation middleware to other protected routes
app.use('/api/stream', authOptional);
app.use('/api/summarize', authOptional);
app.use('/api/upload', authRequired);

// Mount route handlers
app.use('/api/stream', streamRouteHandler);
app.use('/api/summarize', summarizeRouteHandler);
app.use('/api/upload', uploadRouteHandler);

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err.message);
  if (err.message && err.message.includes("not allowed by CORS")) {
    return res.status(403).json({
      error: 'CORS Error',
      message: err.message,
    });
  }
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred on the server.',
  });
});

app.listen(port, () => {
  console.log(`API Worker listening on port ${port}`);
  const secretLoaded = !!process.env.NEXTAUTH_SECRET;
  if (!secretLoaded) {
      console.error("CRITICAL: NEXTAUTH_SECRET was NOT loaded at startup!");
  }
});