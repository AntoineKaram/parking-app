// Long-running server entrypoint (Docker / local dev).
// On Vercel the same app is served by /api/index.js instead.
const app = require('./app');
const { init } = require('./db');

const PORT = process.env.PORT || 4000;

init()
  .then(() => {
    app.listen(PORT, () => console.log(`Parking API listening on :${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
