import pandas as pd
import sqlite3
import unicodedata
import re
import sys
import glob

def normalize_column_name(col):
    col = str(col)
    # Remove accents
    col = unicodedata.normalize('NFKD', col).encode('ASCII', 'ignore').decode('utf-8')
    # Replace anything that is not alphanumeric with underscore
    col = re.sub(r'[^a-zA-Z0-9]+', '_', col)
    # Replace multiple underscores with a single underscore
    col = re.sub(r'_+', '_', col)
    # Strip leading/trailing underscores
    col = col.strip('_')
    return col

def main():
    files = glob.glob("CASOS_NPL_FECHADOS_CONSOLIDADO_INTEGRADO_atualizada.xlsx")
    if not files:
        print("Excel file not found!")
        sys.exit(1)
        
    excel_file = files[0]
    print(f"Reading Excel file: {excel_file}")
    
    try:
        df = pd.read_excel(excel_file, sheet_name='CONSOLIDADO', header=1)
    except Exception as e:
        print(f"Error reading excel: {e}")
        sys.exit(1)

    print("Original columns:")
    print(df.columns.tolist())
    
    new_cols = [normalize_column_name(c) for c in df.columns]
    
    # Check if 'Devedor' doesn't exist but 'Sacado' does, because server.js relies on Devedor.
    # The prompt says "mantendo o nome das colunas como coluna", so I will keep the original normalized names.
    df.columns = new_cols
    
    # Clean currency columns that might have string values like "\nR$ 1.000,00"
    currency_cols = ['Valor_do_Credito_Face', 'Valor_de_Aquisicao', 'Valor_em_aberto', 'Resultado_Liquido', 'Valor_Considerado', 'Proposta_Real', 'Proposta_Parceiro', 'Valor_de_Saida_Cliente', 'Resultado_Bruto']
    
    def parse_currency(val):
        if pd.isna(val):
            return val
        if isinstance(val, (int, float)):
            return float(val)
        val = str(val).replace('\n', '').replace('R$', '').replace(' ', '')
        # Usually strings formatted this way use '.' for thousands and ',' for decimals
        if ',' in val:
            val = val.replace('.', '')
            val = val.replace(',', '.')
        return pd.to_numeric(val, errors='coerce')

    for col in currency_cols:
        if col in df.columns:
            df[col] = df[col].apply(parse_currency)
    
    print("\nNormalized columns:")
    print(df.columns.tolist())
    
    # Drop all empty rows just in case
    df = df.dropna(how='all')

    print("\nConnecting to SQLite database...")
    conn = sqlite3.connect('database.sqlite')
    cursor = conn.cursor()
    
    table_name = "BASE_NPL"
    
    # We drop the table and recreate it to accommodate new columns naturally.
    cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
    print(f"Table {table_name} dropped.")
    
    print(f"Importing {len(df)} rows into {table_name}...")
    df.to_sql(table_name, conn, if_exists='replace', index=False)
    
    # Verify
    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
    count = cursor.fetchone()[0]
    print(f"Success! {count} rows imported into {table_name}.")
    
    conn.close()

if __name__ == "__main__":
    main()
