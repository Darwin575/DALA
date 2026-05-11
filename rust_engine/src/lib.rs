use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use js_sys::Float64Array;

#[wasm_bindgen]
pub fn say_hello(name: &str) -> String {
    format!("Hello from Rust, {}!", name)
}

#[derive(Serialize, Deserialize)]
pub struct OutlierSummary {
    pub count: usize,
    pub outliers: Vec<f64>,
    pub lower_bound: f64,
    pub upper_bound: f64,
}

#[wasm_bindgen]
pub fn detect_outliers(data: Float64Array) -> String {
    let mut values: Vec<f64> = data.to_vec();
    
    if values.is_empty() {
        return serde_json::to_string(&OutlierSummary {
            count: 0,
            outliers: vec![],
            lower_bound: 0.0,
            upper_bound: 0.0,
        }).unwrap_or_default();
    }

    values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let q1 = quantile(&values, 0.25);
    let q3 = quantile(&values, 0.75);
    let iqr = q3 - q1;
    let lower_bound = q1 - 1.5 * iqr;
    let upper_bound = q3 + 1.5 * iqr;

    let outliers: Vec<f64> = values.iter()
        .cloned()
        .filter(|&x| x < lower_bound || x > upper_bound)
        .collect();

    let summary = OutlierSummary {
        count: outliers.len(),
        outliers,
        lower_bound,
        upper_bound,
    };

    serde_json::to_string(&summary).unwrap_or_default()
}

fn quantile(sorted_data: &[f64], q: f64) -> f64 {
    let n = sorted_data.len();
    if n == 0 { return 0.0; }
    if n == 1 { return sorted_data[0]; }
    
    let pos = (n as f64 - 1.0) * q;
    let index = pos.floor() as usize;
    let fraction = pos - pos.floor();
    
    if index + 1 < n {
        sorted_data[index] + (sorted_data[index + 1] - sorted_data[index]) * fraction
    } else {
        sorted_data[index]
    }
}
