import init, { detect_outliers, say_hello } from './rust_engine/rust_engine.js';

self.onmessage = async (e) => {
    const { action, data } = e.data;
    
    if (action === 'init') {
        await init();
        self.postMessage({ status: 'ready' });
    } else if (action === 'detect_outliers') {
        try {
            const result = detect_outliers(new Float64Array(data));
            self.postMessage({ status: 'success', result });
        } catch (err) {
            self.postMessage({ status: 'error', error: err.toString() });
        }
    } else if (action === 'say_hello') {
        try {
            const result = say_hello(data);
            self.postMessage({ status: 'success', result });
        } catch (err) {
            self.postMessage({ status: 'error', error: err.toString() });
        }
    }
};
