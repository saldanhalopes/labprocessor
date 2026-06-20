import pandas as pd
import json
import os
import sys

os.chdir('/home/ubuntu/upload')

# Ler BASEFLUXO
print("Lendo BASEFLUXOTEMPOANALISE.xlsx...")
basefluxo_file = 'BASEFLUXOTEMPOANALISE.xlsx'
basefluxo_sheets = pd.read_excel(basefluxo_file, sheet_name=None)

# Ler MFVCQ
print("Lendo MFVCQ_Oficial-DEMANDAATUALIZADAFEVMARABR2024.xlsb...")
mfvcq_file = 'MFVCQ_Oficial-DEMANDAATUALIZADAFEVMARABR2024.xlsb'
mfvcq_sheets = pd.read_excel(mfvcq_file, sheet_name=None, engine='pyxlsb')

# Criar estrutura de dados
data_structure = {
    "basefluxo": {
        "file": basefluxo_file,
        "sheets": {}
    },
    "mfvcq": {
        "file": mfvcq_file,
        "sheets": {}
    }
}

# Processar BASEFLUXO
for sheet_name, df in basefluxo_sheets.items():
    # Limpar colunas vazias
    df = df.dropna(axis=1, how='all')
    df = df.dropna(axis=0, how='all')
    
    data_structure["basefluxo"]["sheets"][sheet_name] = {
        "shape": [int(df.shape[0]), int(df.shape[1])],
        "columns": list(df.columns),
        "sample_rows": df.head(3).to_dict(orient='records')
    }

# Processar MFVCQ
for sheet_name, df in mfvcq_sheets.items():
    # Limpar colunas vazias
    df = df.dropna(axis=1, how='all')
    df = df.dropna(axis=0, how='all')
    
    data_structure["mfvcq"]["sheets"][sheet_name] = {
        "shape": [int(df.shape[0]), int(df.shape[1])],
        "columns": list(df.columns),
        "sample_rows": df.head(3).to_dict(orient='records')
    }

# Salvar estrutura
with open('/home/ubuntu/data_structure.json', 'w', encoding='utf-8') as f:
    json.dump(data_structure, f, indent=2, ensure_ascii=False)

print("Estrutura salva em /home/ubuntu/data_structure.json")
print(f"\nBASEFLUXO sheets: {list(basefluxo_sheets.keys())}")
print(f"MFVCQ sheets: {list(mfvcq_sheets.keys())}")

# Salvar dados completos em JSON
basefluxo_data = {}
for sheet_name, df in basefluxo_sheets.items():
    df = df.dropna(axis=1, how='all')
    df = df.dropna(axis=0, how='all')
    basefluxo_data[sheet_name] = df.to_dict(orient='records')

mfvcq_data = {}
for sheet_name, df in mfvcq_sheets.items():
    df = df.dropna(axis=1, how='all')
    df = df.dropna(axis=0, how='all')
    mfvcq_data[sheet_name] = df.to_dict(orient='records')

# Salvar dados completos
with open('/home/ubuntu/basefluxo_data.json', 'w', encoding='utf-8') as f:
    json.dump(basefluxo_data, f, indent=2, ensure_ascii=False)

with open('/home/ubuntu/mfvcq_data.json', 'w', encoding='utf-8') as f:
    json.dump(mfvcq_data, f, indent=2, ensure_ascii=False)

print("\nDados completos salvos em:")
print("  - /home/ubuntu/basefluxo_data.json")
print("  - /home/ubuntu/mfvcq_data.json")
