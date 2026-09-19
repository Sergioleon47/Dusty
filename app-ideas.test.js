// app-ideas.test.js
//
// Pruebas del TABLERO DE IDEAS (app-18): los ayudantes puros que deciden qué se
// muestra y en qué orden. Se corren con `node --test`. Mismo arnés mínimo que
// app-servicios.test.js: app-18 se carga en un vm con lo justo del navegador; las
// funciones que tocan Firestore o el DOM no se llaman acá.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function cargarIdeas(){
  const sandbox = { console, Math, Date, JSON, Array, Object, String, Number, Boolean, Set, Map, Promise, Error,
    localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
    document: { getElementById: () => null, querySelectorAll: () => [] },
    currentUser: null, isOffline: false, uiLang: 'es',
    firebase: undefined, render(){}, t: k => k, escapeHtml: s => String(s), timeAgo: () => '',
    svcSheet: () => '', svcShow: fn => fn(), showToast(){}, openAuthModal(){}, openUpgradeModal(){}, confirm: () => true };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'app-18-ideas.js'), 'utf8'), sandbox, { filename: 'app-18-ideas.js' });
  return sandbox;
}
const app = cargarIdeas();
const idea = (o) => Object.assign({ id: 'x', kind: 'idea', title: 't', body: '', uid: 'u1', voters: [], status: 'new', createdAt: '2026-09-19T10:00:00.000Z' }, o);

test('ideasSorted: "top" ordena por votos y desempata por la más nueva', () => {
  const list = [
    idea({ id: 'a', voters: ['1'], createdAt: '2026-09-18T00:00:00Z' }),
    idea({ id: 'b', voters: ['1', '2', '3'], createdAt: '2026-09-10T00:00:00Z' }),
    idea({ id: 'c', voters: ['1'], createdAt: '2026-09-19T00:00:00Z' }),
  ];
  assert.deepEqual(app.ideasSorted(list, 'top', 'all').map(i => i.id), ['b', 'c', 'a']);
  assert.deepEqual(app.ideasSorted(list, 'new', 'all').map(i => i.id), ['c', 'a', 'b']);
});

test('ideasSorted: "Todas" esconde las descartadas; el filtro de estado las muestra a propósito', () => {
  const list = [idea({ id: 'a' }), idea({ id: 'b', status: 'declined' }), idea({ id: 'c', status: 'done' })];
  assert.deepEqual(app.ideasSorted(list, 'new', 'all').map(i => i.id), ['a', 'c']);
  assert.deepEqual(app.ideasSorted(list, 'new', 'declined').map(i => i.id), ['b']);
  assert.deepEqual(app.ideasSorted(list, 'new', 'done').map(i => i.id), ['c']);
  assert.deepEqual(app.ideasSorted([null, undefined, idea({ id: 'z' })], 'new', 'all').map(i => i.id), ['z']);
});

test('ideasNewCount: cuenta lo de OTROS después de la última visita; sin visita previa, cero', () => {
  const list = [
    idea({ id: 'a', uid: 'me', createdAt: '2026-09-19T12:00:00Z' }),
    idea({ id: 'b', uid: 'otro', createdAt: '2026-09-19T12:00:00Z' }),
    idea({ id: 'c', uid: 'otro', createdAt: '2026-09-18T12:00:00Z' }),
  ];
  assert.equal(app.ideasNewCount(list, '2026-09-19T00:00:00Z', 'me'), 1);
  assert.equal(app.ideasNewCount(list, '', 'me'), 0);
  assert.equal(app.ideasNewCount(list, '2026-09-19T00:00:00Z', null), 2);
});

test('ideaAuthorName: displayName primero, si no lo de antes de la @, nunca el correo entero', () => {
  assert.equal(app.ideaAuthorName({ displayName: 'Luna', email: 'luna@x.com' }), 'Luna');
  assert.equal(app.ideaAuthorName({ displayName: '', email: 'marco.feliz@gmail.com' }), 'marco.feliz');
  assert.equal(app.ideaAuthorName(null), '');
  assert.equal(app.ideaAuthorName({ displayName: 'a'.repeat(80) }).length, 40);
});

test('ideasIsAdmin: solo el correo del dueño, con cuenta real', () => {
  assert.equal(app.ideasIsAdmin({ email: 'SergioLeon47@hotmail.com', isAnonymous: false }), true);
  assert.equal(app.ideasIsAdmin({ email: 'sergioleon47@hotmail.com', isAnonymous: true }), false);
  assert.equal(app.ideasIsAdmin({ email: 'otro@hotmail.com', isAnonymous: false }), false);
  assert.equal(app.ideasIsAdmin(null), false);
});

test('votos: conteo y "ya voté"', () => {
  const i = idea({ voters: ['a', 'b'] });
  assert.equal(app.ideaVoteCount(i), 2);
  assert.equal(app.ideaVotedBy(i, 'a'), true);
  assert.equal(app.ideaVotedBy(i, 'z'), false);
  assert.equal(app.ideaVoteCount({}), 0);
  assert.equal(app.ideaVotedBy({}, 'a'), false);
});
