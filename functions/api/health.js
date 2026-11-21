import {json} from '../_lib/core.js';

// Public read-only readiness signal: no account counts, schema details or secrets.
export async function onRequestGet(ctx) {
  try {
    if (!ctx.env?.DB) return json({ok:false,db_ready:false},503);
    await ctx.env.DB.prepare('SELECT id FROM users LIMIT 1').all();
    await ctx.env.DB.prepare('SELECT id FROM games LIMIT 1').all();
    return json({ok:true,db_ready:true});
  } catch {
    return json({ok:false,db_ready:false},503);
  }
}
