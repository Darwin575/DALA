use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct OutlierSummary {
    pub count: usize,
    pub outliers: Vec<f64>,
    pub lower_bound: f64,
    pub upper_bound: f64,
}

#[wasm_bindgen]
pub fn detect_outliers(data: JsValue) -> Result<JsValue, JsValue> {
    let mut values: Vec<f64> = serde_wasm_bindgen::from_value(data)?;
    
    if values.is_empty() {
        return Ok(serde_wasm_bindgen::to_value(&OutlierSummary {
            count: 0,
            outliers: vec![],
            lower_bound: 0.0,
            upper_bound: 0.0,
        })?);
    }

    values.sort_by(|a, b| a.partial_cmp(b).unwrap());

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

    Ok(serde_wasm_bindgen::to_value(&summary)?)
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
