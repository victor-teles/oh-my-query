// electrobun/bun re-exports `three` from its index.ts but doesn't ship types
// for it. We don't use three.js directly; this stub silences TS7016 from
// electrobun's transitive declaration.
declare module "three";
