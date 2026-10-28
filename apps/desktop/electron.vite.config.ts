import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
    main: { plugins: [externalizeDepsPlugin({ exclude: ['@farolprint/i18n'] })] },
    preload: { plugins: [externalizeDepsPlugin()] },
    renderer: {},
});
