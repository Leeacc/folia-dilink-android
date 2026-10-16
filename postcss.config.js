import webview95Transforms from './build/postcss-webview95.mjs';
import tailwind from '@tailwindcss/postcss';
import presetEnv from 'postcss-preset-env';
import autoprefixer from 'autoprefixer';

// Compile modern upstream CSS for the DiLink WebView without changing component markup.
const android = process.env.FOLIA_BUILD_TARGET === 'capacitor';
export default {
  plugins: [
    tailwind(),
    // Layers are flattened once after Vite combines all CSS, not once per imported file.
    ...(android ? [presetEnv({ browsers: 'Chrome >= 95', stage: 2, features: { 'nesting-rules': true, 'cascade-layers': false } }), webview95Transforms()] : []),
    autoprefixer(),
  ],
};
