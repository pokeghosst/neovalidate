import { nodeResolve } from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'

export default [
  {
    input: 'src/validator.js',
    output: {
      file: 'dist/neovalidate.min.js',
      format: 'umd',
      name: 'Validator',
      sourcemap: true
    },
    plugins: [
      nodeResolve(),
      terser({
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.warn']
        },
        mangle: {
          properties: {
            regex: /^#/
          }
        }
      })
    ]
  },
  {
    input: 'src/validator.js',
    output: {
      file: 'dist/neovalidate.esm.min.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      nodeResolve(),
      terser({
        compress: {
          drop_console: true,
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.warn']
        },
        mangle: {
          properties: {
            regex: /^#/
          }
        }
      })
    ]
  }
]
