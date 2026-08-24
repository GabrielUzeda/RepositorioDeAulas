declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// Vite-specific module declarations for imports not covered by vue-tsc by default.
// Used by MarpEditorModal.vue to import the canonical marp theme CSS as a raw string.
declare module '*.css?inline' {
  const css: string;
  export default css;
}
