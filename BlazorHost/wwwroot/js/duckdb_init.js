/**
 * DALA DuckDB Integration (Real Wasm Version)
 */
import * as duckdb from './duckdb/duckdb-browser.mjs';

const MANUAL_BUNDLES = {
    mvp: {
        mainModule: 'js/duckdb/duckdb-mvp.wasm',
        mainWorker: 'js/duckdb/duckdb-browser-mvp.worker.js',
    },
    eh: {
        mainModule: 'js/duckdb/duckdb-eh.wasm',
        mainWorker: 'js/duckdb/duckdb-browser-eh.worker.js',
    },
};

let db = null;

export async function initDuckDB() {
    if (db) return { status: "ready" };
    
    try {
        console.log("Initializing Real DuckDB-Wasm...");
        const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
        const worker = new Worker(bundle.mainWorker);
        const logger = new duckdb.ConsoleLogger();
        db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule);
        console.log("DuckDB-Wasm instantiated successfully.");
        return { status: "ready" };
    } catch (err) {
        console.error("DuckDB initialization failed:", err);
        throw err;
    }
}

export async function runTestQuery() {
    await initDuckDB();
    const conn = await db.connect();
    try {
        const result = await conn.query(`SELECT 'Hello from DuckDB' as greeting`);
        const rows = result.toArray();
        return rows[0].greeting;
    } finally {
        await conn.close();
    }
}

export async function imputeMissingValues(data, method) {
    await initDuckDB();
    const conn = await db.connect();
    
    try {
        await conn.query(`CREATE TABLE dataset (val DOUBLE)`);
        
        // Insert data using a simpler approach for the demo
        // For larger datasets, we would use conn.insert
        for (const val of data) {
            await conn.query(`INSERT INTO dataset VALUES (${val === null ? 'NULL' : val})`);
        }
        
        let sql = "";
        if (method === 'mean') {
            sql = "SELECT val as original, COALESCE(val, AVG(val) OVER()) as imputed FROM dataset";
        } else {
            sql = "SELECT val as original, COALESCE(val, median(val) OVER()) as imputed FROM dataset";
        }
        
        const result = await conn.query(sql);
        const rows = result.toArray().map((r, i) => ({
            index: i,
            original: r.original,
            imputed: r.imputed
        }));
        
        return JSON.stringify(rows);
    } finally {
        await conn.query(`DROP TABLE dataset`);
        await conn.close();
    }
}
