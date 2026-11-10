const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const authRoutes = require('./routes/auth');
const requestsRoutes = require('./routes/requests');
const ccmRoutes = require('./routes/ccm');
const rcmRoutes = require('./routes/rcm');
const capsRoutes = require('./routes/caps');
const analyticsRoutes = require('./routes/analytics');
const auditRoutes = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middlewares
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/ccm', ccmRoutes);
app.use('/api/rcm', rcmRoutes);
app.use('/api/caps', capsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit', auditRoutes);

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'ICS ControlHub Backend API',
    market: 'American Express International Card Services - Japan (ICS-J)',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static files if built
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// Catch-all for SPA fallback (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) {
    return next();
  }
  const indexHtml = path.join(clientDist, 'index.html');
  if (require('fs').existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.status(404).send('ICS ControlHub: Client not yet built. Please run in dev mode or run npm run build.');
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[ICS ControlHub Error]', err);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred in the control engine.'
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(`  🏛️  ICS ControlHub - Internal Control & Operational Risk Portal`);
    console.log(`  🇯🇵  Market: Amex International Card Services (Japan - Tokyo)`);
    console.log(`  🚀  Server running at: http://localhost:${PORT}`);
    console.log(`================================================================`);
  });
}

module.exports = app;
