#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const RUNTIME_ROOTS = ['components', 'pages', 'lib'];
const TEXT_FILES = ['next.config.js', 'package.json', '.env.example'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build']);
const findings = [];

function walk(relative, output = []) {
  const absolute = path.join(ROOT, relative);
  if (!fs.existsSync(absolute)) return output;
  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    output.push(relative.split(path.sep).join('/'));
    return output;
  }
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    walk(path.join(relative, entry.name), output);
  }
  return output;
}

function report(file, rule, detail) {
  findings.push({ file, rule, detail });
}

const runtimeFiles = RUNTIME_ROOTS.flatMap((root) => walk(root));
const files = [...new Set([...runtimeFiles, ...TEXT_FILES.filter((file) => fs.existsSync(path.join(ROOT, file)))])];
const secretPatterns = [
  ['openai-like-token', /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{30,}\b/g],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
];

for (const file of files) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const [rule, pattern] of secretPatterns) {
    if (pattern.test(text)) report(file, rule, 'credential-shaped value found');
    pattern.lastIndex = 0;
  }
  if (/api\.ollama\.ai/i.test(text)) report(file, 'remote-ollama', 'unsupported hosted Ollama endpoint found');
  if (/dangerouslySetInnerHTML/.test(text)) report(file, 'unsafe-html', 'unsafe HTML rendering requires explicit review');
  if (/\beval\s*\(|new\s+Function\s*\(/.test(text)) report(file, 'dynamic-code', 'dynamic code execution found');
}

for (const file of runtimeFiles.filter((file) => file.startsWith('components/') || (file.startsWith('pages/') && !file.startsWith('pages/api/')))) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (/(?:localStorage|sessionStorage)[\s\S]{0,100}(?:api[_ -]?key|token|secret|credential)/i.test(text)) {
    report(file, 'browser-credential-storage', 'credentials must never be persisted in browser storage');
  }
  if (/https:\/\/(?:api\.anthropic\.com|api\.openai\.com|api\.groq\.com|api\.together\.xyz|generativelanguage\.googleapis\.com)/i.test(text)) {
    report(file, 'direct-browser-provider-call', 'provider APIs must be called only by the server gateway');
  }
}

for (const name of fs.readdirSync(ROOT)) {
  if (name.startsWith('.env') && name !== '.env.example') {
    report(name, 'populated-env-file', 'only .env.example may be tracked');
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
if (pkg.dependencies?.next !== '15.5.18') {
  report('package.json', 'next-version', 'expected reviewed Next.js version 15.5.18');
}
if (pkg.overrides?.postcss !== '8.5.10') {
  report('package.json', 'postcss-override', 'expected reviewed PostCSS override 8.5.10');
}

if (findings.length) {
  console.error(`Security check failed with ${findings.length} finding(s):`);
  for (const finding of findings) {
    console.error(`- ${finding.file} [${finding.rule}]: ${finding.detail}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Security check passed for ${files.length} active source/config files.`);
}
