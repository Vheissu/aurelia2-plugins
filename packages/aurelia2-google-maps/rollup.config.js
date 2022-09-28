import typescript from '@rollup/plugin-typescript';
import pkg from './package.json';
import { terser } from 'rollup-plugin-terser';
import postcss from 'rollup-plugin-postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import postcssUrl from 'postcss-url';
import html from "rollup-plugin-html";
import replace from '@rollup/plugin-replace';
import copy from 'rollup-plugin-copy';

const tsPluginConfig = typescript({
    tsconfig: 'tsconfig.json',
    sourceMap: true,
    include: ['src/**/*.ts'],
    noEmitOnError: false,
});

const replacePluginCfg = replace({
    values: {
      __DEV__: String(false)
    },
    preventAssignment: true,
});

const terserPluginCfg = terser({
    compress: {
      defaults: false,
    },
    mangle: {
      properties: {
        regex: /^_/
      }
    },
    format: {
      beautify: true,
    },
    keep_classnames: true,
});

export default {
    input: 'src/index.ts',
    output: [
        {
          file: `dist/index.esm.js`,
          format: 'es',
          sourcemap: true,
          plugins: [terserPluginCfg]
        },
        {
          file: `dist/index.cjs.js`,
          format: 'cjs',
          sourcemap: true,
          plugins: [terserPluginCfg]
        },
      ],
    external: Object.keys(pkg.dependencies),
    plugins: [
        tsPluginConfig,
        replacePluginCfg,
        postcss({
            inject: false,
            extract: false,
            plugins: [
                autoprefixer(),
                postcssUrl({ url: 'inline', encodeType: 'base64' }),
                cssnano()
            ]
        }),
        html(),
        copy({
            targets: [
                { src: 'src/**/*.html', dest: 'dist' },
                { src: 'src/**/*.css', dest: 'dist' },
            ]
        })
    ].filter(Boolean)
}