import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,                  
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 2000, 
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error on idle client:', err);
});

export const db = {
  async query<T extends pg.QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<pg.QueryResult<T>> {
    const start = Date.now();
    try {
      const res = await pool.query<T>(text, params);
      const duration = Date.now() - start;
      
      if (env.NODE_ENV === 'development') {
        console.log(`[SQL Query] Executed in ${duration}ms | Rows: ${res.rowCount}`);
      }
      
      return res;
    } catch (error) {
      console.error(`❌ SQL Query Error: ${text}`);
      throw error;
    }
  },
  
  getPool() {
    return pool;
  }
};
