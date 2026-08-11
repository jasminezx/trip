const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

const context = esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: true,
  outfile: 'dist/extension.js',
});

context.then(async (build) => {
  if (watch) {
    await build.watch();
    console.log('Watching extension sources');
  } else {
    await build.rebuild();
    await build.dispose();
  }
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
