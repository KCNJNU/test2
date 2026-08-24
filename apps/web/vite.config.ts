import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const path = id.replaceAll('\\', '/');
          if (path.includes('/node_modules/react/') || path.includes('/node_modules/react-dom/') || path.includes('/node_modules/scheduler/')) return 'react-vendor';
          if (path.includes('/node_modules/react-router') || path.includes('/node_modules/@remix-run/')) return 'router-vendor';
          if (path.includes('/node_modules/@tanstack/')) return 'query-vendor';
          if (path.includes('/node_modules/@ant-design/icons')) return 'antd-icons';
          if (path.includes('/node_modules/@ant-design/colors') || path.includes('/node_modules/@ant-design/fast-color')) return 'antd-color';
          if (path.includes('/node_modules/dayjs/')) return 'date-vendor';
          if (path.includes('/node_modules/hash-wasm/') || path.includes('/node_modules/idb/')) return 'upload-vendor';
          const rcPackage = /\/node_modules\/(rc-[^/]+)/.exec(path)?.[1];
          if (rcPackage === 'rc-picker') return 'antd-picker-engine';
          if (rcPackage || path.includes('/node_modules/@ant-design/cssinjs')) return 'antd-engine';
        },
      },
    },
  },
});
