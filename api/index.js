// Vercel serverless entrypoint: wraps the same Express app used in Docker.
// Schema creation/seeding runs once per cold start (memoized), then requests
// are handed straight to Express.
const app = require('../backend/src/app');
const { init } = require('../backend/src/db');

let ready;

module.exports = async (req, res) => {
  try {
    ready = ready || init();
    await ready;
  } catch (err) {
    ready = null; // retry on the next invocation
    console.error('Database initialisation failed:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Database initialisation failed' }));
  }
  return app(req, res);
};
