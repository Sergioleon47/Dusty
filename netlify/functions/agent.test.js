// netlify/functions/agent.test.js
//
// Forma de una vuelta de herramientas del asistente (toolTurnProblem): la
// auditoría de la auditoría (2026-09-12) encontró que un historial fabricado con
// un tool_use inventado llegaba al modelo grande sin cupo ni freno. Se corre con
// `node --test`; firebase-admin se simula igual que en lib/patron-admin.test.js.
const { test } = require('node:test');
const assert = require('node:assert');
const Module = require('module');
const real = Module._load;
const admin = { apps: [{}], auth: ()=>({}), firestore: ()=>({ doc: ()=>({}), runTransaction: async (fn)=>fn({}) }), credential:{cert:()=>({})}, initializeApp:()=>({}) };
Module._load = function(req, ...rest){ return req==='firebase-admin' ? admin : real.call(this, req, ...rest); };
const { toolTurnProblem } = require('./agent.js');

const user = (text)=>({ role:'user', content:[{type:'text', text}] });
const asst = (...uses)=>({ role:'assistant', content: uses.map((u,i)=>({type:'tool_use', id:'toolu_'+u+'_'+i, name:u, input:{}})) });
const results = (...ids)=>({ role:'user', content: ids.map(id=>({type:'tool_result', tool_use_id:id, content:'{}'})) });

test('una vuelta de herramientas legítima pasa: responde al tool_use del turno anterior con un nombre real', () => {
  assert.equal(toolTurnProblem([user('hola'), asst('query'), results('toolu_query_0')]), null);
});

test('se rechaza la vuelta sin turno assistant previo, con id que no coincide o con herramienta inexistente', () => {
  assert.match(toolTurnProblem([user('hola'), results('toolu_x')]), /preceding assistant/);
  assert.match(toolTurnProblem([user('hola'), asst('query'), results('toolu_otro')]), /does not match/);
  assert.match(toolTurnProblem([user('hola'), asst('herramienta_inventada'), results('toolu_herramienta_inventada_0')]), /unknown tool/);
});

test('más saltos que AGENT_MAX_HOPS desde el último texto del usuario se rechazan; un texto nuevo reinicia la cuenta', () => {
  const msgs = [user('hola')];
  for(let i=0;i<6;i++){ msgs.push(asst('query')); msgs.push(results('toolu_query_0')); }
  assert.equal(toolTurnProblem(msgs), null, 'seis saltos: el tope del cliente');
  msgs.push(asst('query')); msgs.push(results('toolu_query_0'));
  assert.match(toolTurnProblem(msgs), /too many tool hops/);
  msgs.push(user('otra cosa')); msgs.push(asst('query')); msgs.push(results('toolu_query_0'));
  assert.equal(toolTurnProblem(msgs), null);
});
