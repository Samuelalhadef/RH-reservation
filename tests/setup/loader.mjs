import path from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = path.join(root, 'src');
const mocks = path.join(root, 'tests', 'mocks');

const MOCKED = {
  'lib/auth': 'auth.mjs',
  'lib/email': 'email.mjs',
  'lib/pushNotifications': 'push.mjs',
  'lib/holidays': 'holidays.mjs',
};

function withExt(p) {
  if (existsSync(p) && statSync(p).isFile()) return p;
  if (existsSync(p + '.js')) return p + '.js';
  if (existsSync(path.join(p, 'index.js'))) return path.join(p, 'index.js');
  return p;
}

function mockFor(absPath) {
  const rel = path.relative(src, absPath).split(path.sep).join('/').replace(/\.js$/, '');
  return MOCKED[rel] ? path.join(mocks, MOCKED[rel]) : null;
}

export async function resolve(specifier, context, next) {
  if (specifier === 'next/server') return next('next/server.js', context);
  if (specifier === 'next/headers') return next('next/headers.js', context);

  let abs = null;
  if (specifier.startsWith('@/')) abs = path.join(src, specifier.slice(2));
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const parent = fileURLToPath(context.parentURL);
    if (parent.startsWith(src)) abs = path.resolve(path.dirname(parent), specifier);
  }
  if (abs) {
    const mock = mockFor(abs);
    const target = mock || withExt(abs);
    return { url: pathToFileURL(target).href, shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  // Le code de src/ est en ESM sans "type": "module" : on force le format
  if (url.startsWith('file:') && url.endsWith('.js') && fileURLToPath(url).startsWith(src)) {
    return next(url, { ...context, format: 'module' });
  }
  return next(url, context);
}
