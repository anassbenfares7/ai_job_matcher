import app from './app.js';
import { env } from './config/env.js';

const PORT = env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Production-grade server engine humming on port ${PORT}`);
  console.log(`🌍 Active Mode: ${env.NODE_ENV}`);
});
