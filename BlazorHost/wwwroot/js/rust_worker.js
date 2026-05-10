import init, { detect_outliers } from './rust_engine/rust_engine.js';

self.onmessage = async (e) => {
    const { action, data } = e.data;
    
    if (action === 'init') {
        await init();
        self.postMessage({ status: 'ready' });
    } else if (action === 'detect_outliers') {
        try {
            const result = detect_outliers(data);
            self.postMessage({ status: 'success', result });
        } catch (err) {
            self.postMessage({ status: 'error', error: err.toString() });
        }
    }
};
