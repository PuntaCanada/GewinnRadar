import {json,viewer} from '../_lib/core.js';
export async function onRequestGet(ctx){const u=await viewer(ctx);return json({user:u||null})}
