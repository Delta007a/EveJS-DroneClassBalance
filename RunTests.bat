@echo off
setlocal
node --check loader.js || exit /b 1
node --check config.js || exit /b 1
node --check shipOverrides.js || exit /b 1
node --check lib\runtime.js || exit /b 1
node --check lib\shipGroups.js || exit /b 1
node --check lib\sourceTransforms.js || exit /b 1
node --check test\verify.js || exit /b 1
node test\verify.js || exit /b 1
