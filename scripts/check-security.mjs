// 发布前的安全检查：没有外部请求、没有密钥、没有危险写法、CSP 还在。
// 用法：node scripts/check-security.mjs    （tests/release.test.mjs 也会跑）

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SKIP_DIRS = new Set(['.git', 'node_modules', '.claude']);
const TEXT_EXT = new Set(['.js', '.mjs', '.html', '.css', '.json', '.webmanifest', '.svg', '.md', '.txt', '.yml', '.yaml']);

/** App 会被发布出去的文件 */
const SHIPPED_TOP = ['index.html', 'manifest.webmanifest', 'sw.js', 'src', 'styles', 'assets'];
const ALLOWED_URLS = ['http://www.w3.org/'];

const SECRET_PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, 'AWS 密钥'],
  [/\bsk-[A-Za-z0-9_-]{20,}/, 'API 密钥（sk-）'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API 密钥'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '私钥'],
];

const DANGEROUS_PATTERNS = [
  [/\beval\s*\(/, 'eval()'],
  [/\bnew\s+Function\s*\(/, 'new Function()'],
  [/document\.write\s*\(/, 'document.write()'],
  [/\sstyle\s*=\s*["']/, '行内 style 属性（会被 CSP 挡掉）'],
  [/<script(?![^>]*\bsrc=)[^>]*>/i, '行内 <script>'],
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (TEXT_EXT.has(path.extname(name))) out.push(full);
  }
  return out;
}

export function scanProject(root = ROOT) {
  const problems = [];
  const rel = (f) => path.relative(root, f).replaceAll('\\', '/');
  const self = fileURLToPath(import.meta.url);

  // 1. 整个代码库：不能有密钥
  for (const file of walk(root)) {
    if (file === self) continue;
    const text = readFileSync(file, 'utf8');
    for (const [re, label] of SECRET_PATTERNS) {
      if (re.test(text)) problems.push(`${rel(file)}：疑似${label}`);
    }
  }

  // 2. 发布的文件：不能连外部网址、不能有危险写法、不能有电子邮件
  const shipped = SHIPPED_TOP.flatMap((p) => {
    const full = path.join(root, p);
    if (!existsSync(full)) return [];
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
  for (const file of shipped) {
    const text = readFileSync(file, 'utf8');
    for (const url of text.match(/\bhttps?:\/\/[^\s"'`)<>]+/g) ?? []) {
      if (!ALLOWED_URLS.some((ok) => url.startsWith(ok))) problems.push(`${rel(file)}：外部网址 ${url}`);
    }
    for (const [re, label] of DANGEROUS_PATTERNS) {
      if (re.test(text)) problems.push(`${rel(file)}：${label}`);
    }
    if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) problems.push(`${rel(file)}：出现电子邮件地址`);
  }

  // 3. CSP 还在，而且只允许自己网域
  const index = readFileSync(path.join(root, 'index.html'), 'utf8');
  if (!/http-equiv="Content-Security-Policy"[^>]*default-src 'self'/.test(index)) {
    problems.push("index.html：缺少 CSP（default-src 'self'）");
  }

  // 4. 备份文件不能进 Git
  const gitignore = existsSync(path.join(root, '.gitignore')) ? readFileSync(path.join(root, '.gitignore'), 'utf8') : '';
  if (!gitignore.includes('*backup*.json')) problems.push('.gitignore：没有排除备份文件（*backup*.json）');

  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = scanProject();
  if (problems.length) {
    console.error(`安全检查没通过（${problems.length} 个问题）：`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('安全检查通过 ✓');
}
