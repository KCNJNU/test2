import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { connectAsync } from 'mqtt';

const manifest = JSON.parse(await readFile(process.argv[2], 'utf8'));
const identities = manifest.identities.slice(0, Number(process.env.RECONNECT_CLIENTS ?? 100));
assert.equal(identities.length, Number(process.env.RECONNECT_CLIENTS ?? 100), 'certificate manifest does not contain the requested client count');
const ca = await readFile(manifest.caFile); const started=Date.now();
const results=await Promise.all(identities.map(async(identity,index)=>{
  await new Promise((resolve)=>setTimeout(resolve,Math.floor(index/10)*200+Math.random()*250));
  try{const client=await connectAsync(manifest.broker,{clientId:identity.id,ca,cert:await readFile(identity.certFile),key:await readFile(identity.keyFile),servername:manifest.serverName,rejectUnauthorized:true,reconnectPeriod:0,connectTimeout:10_000});await client.endAsync(true);return true;}catch{return false;}
}));
const succeeded=results.filter(Boolean).length;const ratio=succeeded/results.length;
process.stdout.write(JSON.stringify({clients:results.length,succeeded,ratio,durationMs:Date.now()-started})+'\n');
assert.ok(ratio>=0.99,'fewer than 99% of clients connected');
