module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  plugins: [],
  env: {
    node: true,
    es6: true
  },
  root: true, 
  settings: {
    'import/resolver': {
      node: {
        paths: ['src'],
        extensions: ['.js', '.ts']
      }
    }
  },
  rules: {
    // awaits in loops are allowed
    'no-await-in-loop': 0,
    // explicit any's are allowed to allow for external module compatibility
    '@typescript-eslint/no-explicit-any': 0,
    // require semi colons for line endings
    'semi': 1,
    // never allow spaces between function names and argument list
    'space-before-function-paren': 0,
  }
}