// 打包脚本：生成可部署到任意静态站点的 dist/ 目录（零依赖、无构建步骤）。
// 用法：npm run build   （或 ./npm run build）
//
// 说明：本游戏是纯前端项目，部署只需静态托管（Nginx / GitHub Pages / Netlify /
// Vercel / 对象存储等），不需要 Node 服务器。dist/ 只包含运行必需的文件：
//   dist/index.html  dist/styles.css  dist/src/**
// 所有引用路径均为相对路径（./ 与 ../），因此可以部署在根目录或任意子路径下。
import { mkdirSync, rmSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const INCLUDE = ['index.html', 'styles.css', 'src'];

/** 递归复制（支持文件或目录），跳过隐藏文件（.DS_Store 等） */
function copyTree(from, to) {
  const st = statSync(from);
  if (st.isFile()) {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
    return;
  }
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const src = join(from, name);
    const dst = join(to, name);
    const child = statSync(src);
    if (child.isDirectory()) copyTree(src, dst);
    else copyFileSync(src, dst);
  }
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
for (const item of INCLUDE) copyTree(join(ROOT, item), join(DIST, item));

const files = walk(DIST).map((p) => relative(DIST, p)).sort();
console.log(`构建完成：dist/ 共 ${files.length} 个文件\n`);
for (const f of files) console.log('  ' + f);

// 校验关键入口，缺失则报错（非零退出码）
const required = ['index.html', 'styles.css', 'src/main.js'];
const missing = required.filter((f) => !files.includes(f));
if (missing.length) {
  console.error('\n[build] 缺少关键文件：' + missing.join(', '));
  process.exit(1);
}
console.log('\n[build] 校验通过。将 dist/ 目录内容上传到静态托管即可。');
