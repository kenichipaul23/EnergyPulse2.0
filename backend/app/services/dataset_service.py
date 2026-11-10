
import json
import uuid
from pathlib import Path

import pandas as pd


# Store uploaded CSV files inside backend/uploads/
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def process_csv(file_content: bytes):
    """
    Read a CSV file and return basic information about its contents.
    """

    try:
        dataframe = pd.read_csv(
            pd.io.common.BytesIO(file_content)
        )
    except pd.errors.EmptyDataError:
        raise ValueError("The CSV file is empty.")
    except (pd.errors.ParserError, UnicodeDecodeError):
        raise ValueError("The CSV file could not be read. Check its format and encoding.")
    except Exception as error:
        raise ValueError(f"Unable to process CSV: {str(error)}")

    if dataframe.empty:
        raise ValueError("The CSV file contains no data rows.")

    if len(dataframe.columns) == 0:
        raise ValueError("The CSV file has no columns.")

    # Generate a unique filename to avoid overwriting uploads.
    filename = f"{uuid.uuid4().hex}.csv"
    file_path = UPLOAD_DIR / filename

    # Save the original uploaded CSV.
    file_path.write_bytes(file_content)

    # Count missing values in each column.
    missing_values = {
        str(column): int(count)
        for column, count in dataframe.isnull().sum().items()
    }

    # Generate a preview of the first five rows.
    preview = json.loads(
        dataframe.head(5).to_json(
            orient="records",
            date_format="iso"
        )
    )

    return {
        "filename": filename,
        "rows": int(len(dataframe)),
        "columns": [str(column) for column in dataframe.columns],
        "missing_values": missing_values,
        "preview": preview,
    }
