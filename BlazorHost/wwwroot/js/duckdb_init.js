/**
 * DALA DuckDB Integration (Real Wasm Version)
 */
import * as duckdb from '@duckdb/duckdb-wasm';

const MANUAL_BUNDLES = {
    mvp: {
        mainModule: '/js/duckdb/duckdb-mvp.wasm',
        mainWorker: '/js/duckdb/duckdb-browser-mvp.worker.js',
    },
    eh: {
        mainModule: '/js/duckdb/duckdb-eh.wasm',
        mainWorker: '/js/duckdb/duckdb-browser-eh.worker.js',
    },
};

let db = null;
let worker = null;
let isOpening = false;

// Session-Isolation: Use versioned filenames to bypass kernel-level locks
let currentDbVersion = parseInt(localStorage.getItem('dala_db_version') || '1');
let dbPath = `opfs://dala_main_v${currentDbVersion}.db`;

export async function initDuckDB() {
    if (db) return { status: "ready" };
    if (isOpening) {
        while (isOpening) await new Promise(r => setTimeout(r, 100));
        if (db) return { status: "ready" };
    }
    
    isOpening = true;
    try {
        console.log(`Initializing DALA DuckDB (Version: ${currentDbVersion}) with OPFS...`);
        const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);
        
        let attempts = 0;
        let opened = false;
        
        while (attempts < 3 && !opened) {
            try {
                if (worker) worker.terminate();
                worker = new Worker(bundle.mainWorker);
                db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.ERROR), worker);
                await db.instantiate(bundle.mainModule);
                
                await db.open({
                    path: dbPath,
                    accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
                });
                opened = true;
            } catch (err) {
                attempts++;
                console.warn(`OPFS Lock Attempt ${attempts} failed for ${dbPath}:`, err);
                
                if (attempts === 2) {
                    // Session-Isolation Strategy: If the lock is fundamentally stuck, bypass it with a new file version
                    currentDbVersion++;
                    dbPath = `opfs://dala_main_v${currentDbVersion}.db`;
                    localStorage.setItem('dala_db_version', currentDbVersion);
                    console.warn(`Bypassing lock by bumping to new version: ${dbPath}`);
                }
                
                if (db) await db.terminate().catch(() => {});
                if (worker) worker.terminate();
                db = null;
                worker = null;
                
                if (!opened && attempts < 3) await new Promise(r => setTimeout(r, 1000));
            }
        }

        if (!opened) {
            // Ultimate fallback
            worker = new Worker(bundle.mainWorker);
            db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.ERROR), worker);
            await db.instantiate(bundle.mainModule);
            await db.open({ path: dbPath, accessMode: duckdb.DuckDBAccessMode.READ_ONLY });
        }
        
        if (opened) {
            // Cleanup Logic: Attempt to delete older versioned files to save space
            try {
                const root = await navigator.storage.getDirectory();
                for (let v = 1; v < currentDbVersion; v++) {
                    const oldFile = `dala_main_v${v}.db`;
                    await root.removeEntry(oldFile).catch(() => {});
                    await root.removeEntry(`${oldFile}.wal`).catch(() => {}); // Also cleanup WAL files
                }
            } catch (cleanupErr) {
                console.warn("DALA Cleanup: Failed to delete older versions", cleanupErr);
            }
        }
        
        const conn = await db.connect();
        const tablesResult = await conn.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'`);
        const tables = tablesResult.toArray().map(r => r.table_name);
        await conn.close();

        console.log(`DuckDB Version ${currentDbVersion} ready. Tables:`, tables);
        return { status: "ready", tables: tables, version: currentDbVersion };
    } finally {
        isOpening = false;
    }
}

// Close-on-Blur Hack: Proactively release lock when the user leaves the tab
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && db) {
        console.log("DALA: Proactively releasing OPFS handle on blur...");
        db.terminate();
        if (worker) worker.terminate();
        db = null;
        worker = null;
    }
});

window.addEventListener('beforeunload', () => {
    if (db) {
        db.terminate();
        if (worker) worker.terminate();
    }
});

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

export async function ingestLargeCSV(file, tableName, dotnetRef) {
    await initDuckDB();
    
    console.log(`Ingesting large CSV: ${file.name} into ${tableName}`);
    
    // Register the file handle
    await db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
    
    const conn = await db.connect();
    try {
        // Step 1: Initializing
        if (dotnetRef) await dotnetRef.invokeMethodAsync('OnIngestProgress', 10);
        
        // Step 2: Compaction (CSV -> Internal Table / Parquet)
        // DuckDB-Wasm handles the streaming internally when reading from the registered handle
        await conn.query(`CREATE TABLE ${tableName} AS SELECT * FROM read_csv_auto('${file.name}')`);
        
        if (dotnetRef) await dotnetRef.invokeMethodAsync('OnIngestProgress', 90);
        
        // Step 3: Finalizing & Flushing to Disk
        console.log("Forcing flush to OPFS disk...");
        await conn.query('CHECKPOINT;');
        await db.flushFiles();
        // Force persistence for future writes by disabling automatic WAL checkpoint delay
        await conn.query('SET wal_autocheckpoint = "0KB";');

        const countResult = await conn.query(`SELECT count(*) as total FROM ${tableName}`);
        const count = countResult.toArray()[0].total;
        
        console.log(`Ingestion complete and flushed. ${count} rows loaded.`);
        if (dotnetRef) {
            await dotnetRef.invokeMethodAsync('OnIngestProgress', 100);
            // Auto-refresh inventory
            const tablesRes = await conn.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'`);
            const tables = tablesRes.toArray().map(r => r.table_name);
            await dotnetRef.invokeMethodAsync('OnInventoryUpdated', tables);
        }
        
        return { status: "success", rowCount: Number(count) };
    } catch (err) {
        console.error("Ingestion failed:", err);
        throw err;
    } finally {
        await conn.close();
    }
}

export async function getTableProfile(tableName) {
    await initDuckDB();
    const conn = await db.connect();
    try {
        // Table Existence Check: Case-insensitive and early return to block downstream SQL errors
        const existRes = await conn.query(`SELECT count(*) as exists FROM information_schema.tables WHERE lower(table_name) = lower('${tableName}')`);
        const exists = existRes.toArray()[0].exists > 0;
        
        if (!exists) {
            console.warn(`Shield: Table ${tableName} not found in current OPFS session.`);
            return JSON.stringify({ status: "pending_import", tableName: tableName });
        }

        // 1. Basic Stats: Count
        const countRes = await conn.query(`SELECT count(*) as total FROM "${tableName}"`);
        const rowCount = countRes.toArray()[0].total;
        
        // 2. Column Info: Types
        const infoRes = await conn.query(`PRAGMA table_info('${tableName}')`);
        const columns = infoRes.toArray().map(c => ({
            name: c.name,
            type: c.type.toUpperCase(),
            notnull: c.notnull
        }));
        
        // Safe conversion helpers — guards against NaN, Infinity, BigInt
        const safeNum = (v) => { 
            if (v === null || v === undefined) return 0;
            const n = Number(v.toString()); 
            return isFinite(n) ? n : 0; 
        };

        const safeStr = (v) => {
            if (v === null || v === undefined) return 'N/A';
            const n = Number(v);
            if (!isFinite(n) && typeof v !== 'string') return 'N/A';
            return String(v);
        };

        // 3. Manual Robust Profiling Loop
        const profileSummary = [];
        for (const col of columns) {
            try {
                let stats = {};
                const isNumeric = ['INT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'REAL', 'NUMERIC'].some(t => col.type.includes(t));
                
                if (isNumeric) {
                    const res = await conn.query(`SELECT 
                        count(*) FILTER (WHERE "${col.name}" IS NULL) as null_count,
                        min("${col.name}") as min_val,
                        max("${col.name}") as max_val,
                        avg("${col.name}") as avg_val,
                        approx_count_distinct("${col.name}") as unique_count
                    FROM "${tableName}"`);
                    const r = res.toArray()[0];
                    stats = {
                        column_name: col.name,
                        column_type: col.type,
                        min: safeStr(r.min_val),
                        max: safeStr(r.max_val),
                        avg: isFinite(Number(r.avg_val)) ? Number(r.avg_val).toFixed(2) : 'N/A',
                        approx_unique: safeStr(r.unique_count),
                        null_count: safeNum(r.null_count)
                    };
                } else {
                    const res = await conn.query(`SELECT 
                        count(*) FILTER (WHERE "${col.name}" IS NULL) as null_count,
                        approx_count_distinct("${col.name}") as unique_count
                    FROM "${tableName}"`);
                    const r = res.toArray()[0];
                    stats = {
                        column_name: col.name,
                        column_type: col.type,
                        min: 'N/A',
                        max: 'N/A',
                        avg: 'N/A',
                        approx_unique: safeStr(r.unique_count),
                        null_count: safeNum(r.null_count)
                    };
                }
                profileSummary.push(stats);
            } catch (ce) {
                console.warn(`Failed to profile column ${col.name}:`, ce);
                profileSummary.push({
                    column_name: col.name,
                    column_type: col.type,
                    min: 'ERR', max: 'ERR', avg: 'ERR', approx_unique: 'ERR', null_count: 0
                });
            }
        }
        
        const result = {
            rowCount: safeNum(rowCount),
            columnCount: columns.length,
            columns: profileSummary.map(s => ({
                name: s.column_name,
                type: s.column_type,
                nullCount: safeNum(s.null_count)
            })),
            summary: profileSummary
        };

        // Verify payload is clean before sending (no NaN/Infinity that break JSON.stringify)
        const jsonString = JSON.stringify(result, (key, val) => {
            if (typeof val === 'number' && !isFinite(val)) return 0;
            return val;
        });
        return jsonString;
    } catch (err) {
        console.error("Manual profiling failed:", err);
        throw err;
    } finally {
        await conn.close();
    }
}

export async function ingestFromInput(elementId, tableName, dotnetRef) {
    const input = document.getElementById(elementId);
    if (!input || !input.files || !input.files[0]) {
        throw new Error("No file selected or input not found");
    }
    const file = input.files[0];
    return await ingestLargeCSV(file, tableName, dotnetRef);
}

export async function getInventory(dotnetRef) {
    const status = await initDuckDB();
    if (dotnetRef && status.tables) {
        await dotnetRef.invokeMethodAsync('OnInventoryUpdated', status.tables);
    }
    return status.tables;
}

export async function clearAllStorage() {
    try {
        console.warn("Wiping OPFS storage...");
        if (db) await db.terminate();
        
        const root = await navigator.storage.getDirectory();
        await root.removeEntry('dala_main.db').catch(() => {});
        
        console.log("Storage wiped. Reloading...");
        location.reload();
    } catch (err) {
        console.error("Failed to clear storage:", err);
        throw err;
    }
}
