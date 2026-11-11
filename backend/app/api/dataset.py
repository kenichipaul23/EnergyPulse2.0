import json, uuid
from pathlib import Path
from datetime import datetime
import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException, Query

router = APIRouter(prefix="/api/datasets", tags=["datasets"])
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

def read_csv_bytes(content: bytes):
    try: 
        df = pd.read_csv(pd.io.common.BytesIO(content))
    except Exception as e: 
        raise ValueError(f"Cannot read CSV: {e}")
    if df.empty: 
        raise ValueError("CSV has no data rows.")
    return df

def process_csv(content: bytes, original_filename: str):
    # Sanitize and keep the original filename uploaded by the user
    safe_name = Path(original_filename).name
    if not safe_name.lower().endswith(".csv"):
        raise ValueError("Upload a valid .csv file.")
    
    # If a file with the exact same name already exists, append a short hash to prevent overwriting
    target_path = UPLOAD_DIR / safe_name
    if target_path.exists():
        stem = target_path.stem
        safe_name = f"{stem}_{uuid.uuid4().hex[:6]}.csv"
        target_path = UPLOAD_DIR / safe_name

    df = read_csv_bytes(content)
    target_path.write_bytes(content)

    return {
        "filename": safe_name,
        "rows": len(df),
        "columns": list(map(str, df.columns)),
        "missing_values": {str(c): int(v) for c, v in df.isna().sum().items()},
        "preview": json.loads(df.head(5).to_json(orient="records", date_format="iso"))
    }

def dataset_path(filename):
    if not filename or Path(filename).name != filename or not filename.endswith(".csv"): 
        raise ValueError("Invalid dataset filename")
    p = (UPLOAD_DIR / filename).resolve()
    if p.parent != UPLOAD_DIR.resolve() or not p.is_file(): 
        raise ValueError("Dataset not found")
    return p

def analytics(filename):
    df = pd.read_csv(dataset_path(filename))
    cols = {str(c).strip().lower().replace(" ", "_"): c for c in df.columns}

    def find(names):
        return next((cols[n] for n in names if n in cols), None)

    date_col = find(["timestamp", "datetime", "date_time", "date", "time"])
    energy_col = find(["total_building_energy_kwh", "electricity_kwh", "energy_kwh", "consumption_kwh", "kwh", "energy"])
    demand_col = find(["total_building_demand_kw", "demand_kw", "power_kw", "kw"])
    rate_col = find(["illustrative_tariff_php_per_kwh", "tariff_php_per_kwh", "rate_php_per_kwh", "php_per_kwh"])
    if energy_col is None:
        numeric = [c for c in df.select_dtypes(include="number").columns if not str(c).lower().endswith("_kw")]
        energy_col = numeric[0] if numeric else None
    if energy_col is None:
        raise ValueError("No numeric energy column found. Use a column such as energy_kwh or total_building_energy_kwh.")

    df[energy_col] = pd.to_numeric(df[energy_col], errors="coerce")
    clean = df.dropna(subset=[energy_col]).copy()
    if clean.empty:
        raise ValueError("Energy column has no valid numeric values.")
    energy = clean[energy_col].astype(float)
    dates = pd.to_datetime(clean[date_col], errors="coerce") if date_col else pd.Series(pd.NaT, index=clean.index)
    clean["_date"] = dates

    step = max(1, len(clean) // 800)
    rows = []
    for i, (_, r) in enumerate(clean.iloc[::step].iterrows()):
        rows.append({
            "x": int(i * step),
            "date": str(r["_date"]) if pd.notna(r["_date"]) else f"Record {i * step + 1}",
            "energy": float(r[energy_col]),
        })

    rate_series = pd.to_numeric(clean[rate_col], errors="coerce") if rate_col else None
    default_rate = float(rate_series.dropna().mean()) if rate_series is not None and rate_series.notna().any() else 12.0266

    monthly_history = []
    if clean["_date"].notna().any():
        dated = clean.dropna(subset=["_date"]).copy()
        dated["_ym"] = dated["_date"].dt.to_period("M")
        grouped = dated.groupby("_ym")[energy_col].sum().sort_index()
        for period, value in grouped.items():
            monthly_history.append({
                "year": int(period.year),
                "month_number": int(period.month),
                "label": period.strftime("%b %Y"),
                "kwh": float(value),
            })

    by_key = {(m["year"], m["month_number"]): m["kwh"] for m in monthly_history}
    years = sorted({m["year"] for m in monthly_history})
    yoy = None
    if 2024 in years and 2025 in years:
        s24 = sum(by_key.get((2024, m), 0) for m in range(1, 13))
        s25 = sum(by_key.get((2025, m), 0) for m in range(1, 13))
        yoy = (s25 - s24) / s24 if s24 else 0.0

    forecast = []
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    for m in range(1, 13):
        v24 = by_key.get((2024, m))
        v25 = by_key.get((2025, m))
        if v24 is not None and v25 is not None:
            month_change = (v25 - v24) / v24 if v24 else 0.0
            growth = 0.65 * month_change + 0.35 * (yoy or 0.0)
            predicted = max(0.0, v25 * (1 + growth))
            method = "same-month seasonal + blended YoY"
        elif v25 is not None:
            predicted = max(0.0, v25 * (1 + (yoy or 0.0)))
            method = "latest year x overall YoY"
        elif v24 is not None:
            predicted = max(0.0, v24)
            method = "repeat latest available month"
        else:
            continue
        forecast.append({
            "year": 2026,
            "month_number": m,
            "label": f"{month_names[m - 1]} 2026",
            "kwh": float(predicted),
            "method": method,
            "kwh_2024": None if v24 is None else float(v24),
            "kwh_2025": None if v25 is None else float(v25),
        })

    regression = None
    reg_rows = []
    if len(monthly_history) >= 2:
        n = len(monthly_history)
        xs = list(range(1, n + 1))
        ys = [m["kwh"] for m in monthly_history]
        xm = sum(xs) / n
        ym = sum(ys) / n
        num = sum((x - xm) * (y - ym) for x, y in zip(xs, ys))
        den = sum((x - xm) ** 2 for x in xs)
        b = num / den if den else 0.0
        a = ym - b * xm
        sst = sum((y - ym) ** 2 for y in ys)
        ssr = sum((y - (a + b * x)) ** 2 for x, y in zip(xs, ys))
        for x, y, mrow in zip(xs, ys, monthly_history):
            dx = x - xm
            dy = y - ym
            reg_rows.append({
                "label": mrow["label"],
                "x": x,
                "y": float(y),
                "dx": float(dx),
                "dy": float(dy),
                "product": float(dx * dy),
                "square": float(dx * dx),
                "predicted": float(a + b * x),
            })
        regression = {
            "n": n,
            "x_mean": float(xm),
            "y_mean": float(ym),
            "a": float(a),
            "b": float(b),
            "r2": float(1 - ssr / sst) if sst else 1.0,
            "note": "Computed on all monthly totals. A straight line is the class model only. The 2026 plan uses the seasonal method above.",
            "rows": reg_rows,
        }

    appliances = []
    for c in df.columns:
        name = str(c)
        low = name.lower()
        if c == energy_col or not low.endswith("_kwh"):
            continue
        if "total_building" in low or "cost" in low:
            continue
        values = pd.to_numeric(df[c], errors="coerce")
        kw_name = name[:-4] + "_kw" if name.lower().endswith("_kwh") else None
        kw_col = None
        for cand in df.columns:
            if str(cand).lower() == (kw_name or "").lower():
                kw_col = cand
                break
        kw_values = pd.to_numeric(df[kw_col], errors="coerce") if kw_col else None
        hourly_profile = []
        peak_hour = None
        if date_col:
            hours = pd.to_datetime(df[date_col], errors="coerce").dt.hour
            frame = pd.DataFrame({"hour": hours, "kwh": values})
            hourly = frame.dropna().groupby("hour")["kwh"].mean()
            hourly_profile = [{"hour": int(h), "average_kwh": float(v)} for h, v in hourly.items()]
            if len(hourly):
                peak_hour = int(hourly.idxmax())
        appliances.append({
            "name": name.replace("_kwh", "").replace("_", " ").title(),
            "kwh": float(values.sum(skipna=True)),
            "average_kw": None if kw_values is None or not kw_values.notna().any() else float(kw_values.mean()),
            "peak_kw": None if kw_values is None or not kw_values.notna().any() else float(kw_values.max()),
            "peak_hour": peak_hour,
            "hourly_profile": hourly_profile,
        })

    total = float(energy.sum())
    avg = float(energy.mean())
    peak = float(energy.max())
    minimum = float(energy.min())
    demand = pd.to_numeric(clean[demand_col], errors="coerce") if demand_col else None
    monthly = [{"month": m["label"], "month_number": m["month_number"], "year": m["year"], "kwh": m["kwh"]} for m in monthly_history]

    return {
        "filename": filename,
        "records": int(len(clean)),
        "energy_column": str(energy_col),
        "date_column": str(date_col) if date_col else None,
        "total_kwh": total,
        "average_kwh": avg,
        "peak_kwh": peak,
        "minimum_kwh": minimum,
        "peak_kw": float(demand.max()) if demand is not None and demand.notna().any() else None,
        "cost_php": total * default_rate,
        "rate_php_per_kwh": default_rate,
        "series": rows,
        "series_note": "Chart series is downsampled for speed. Totals use every hourly row.",
        "monthly": monthly,
        "monthly_history": monthly_history,
        "forecast_2026": forecast,
        "yoy_change": None if yoy is None else float(yoy),
        "regression": regression,
        "appliances": sorted(appliances, key=lambda a: a["kwh"], reverse=True),
        "dates": {
            "start": str(dates.min()) if dates.notna().any() else None,
            "end": str(dates.max()) if dates.notna().any() else None,
        },
    }

@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Upload a CSV file.")
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(413, "Maximum upload size is 20 MB.")
    try:
        result = process_csv(content, file.filename)
        return {"message": "Dataset uploaded successfully", "original_filename": file.filename, "dataset": result}
    except ValueError as e:
        raise HTTPException(400, str(e))

@router.get("/{filename}/analytics")
def get_analytics(filename: str):
    try:
        return analytics(filename)
    except ValueError as e:
        raise HTTPException(404, str(e))

@router.delete("/{filename}")
def delete_dataset(filename: str):
    try:
        p = dataset_path(filename)
        p.unlink()
        return {"message": f"Dataset '{filename}' deleted successfully."}
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Could not delete file: {e}")

@router.get("")
def list_datasets():
    result = []
    for p in sorted(UPLOAD_DIR.glob("*.csv"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            df = pd.read_csv(p, nrows=2)
            result.append({"filename": p.name, "columns": list(df.columns)})
        except:
            pass
    return result