import { cp, mkdir, rm, readFile } from 'node:fs/promises';
await readFile('index.html');
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'styles.css', 'src', 'sw.js', 'manifest.webmanifest', 'icon.svg']) await cp(file, `dist/${file}`, { recursive: true });
console.log('Built static, self-contained app in dist/');
