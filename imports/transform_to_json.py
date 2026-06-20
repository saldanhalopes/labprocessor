import pandas as pd
import json
import os
from collections import defaultdict

os.chdir('/home/ubuntu/upload')

print("Transformando dados para estrutura JSON reutilizável...")

# ============================================================================
# PARTE 1: PROCESSAR BASEFLUXO - Base de Verdade
# ============================================================================

print("\n[1/4] Processando BASEFLUXO...")

basefluxo_file = 'BASEFLUXOTEMPOANALISE.xlsx'
bd_tc_geral = pd.read_excel(basefluxo_file, sheet_name='BD _TC GERAL ')
base_fluxo_analise = pd.read_excel(basefluxo_file, sheet_name='BASE FLUXO ANALISE')

# Limpar dados
bd_tc_geral = bd_tc_geral.dropna(axis=1, how='all').dropna(axis=0, how='all')
base_fluxo_analise = base_fluxo_analise.dropna(axis=1, how='all').dropna(axis=0, how='all')

# Renomear colunas para a primeira aba
bd_tc_geral.columns = ['concat_cod_maq', 'ativo', 'analise_cq', 'forma_farmaceutica', 
                        'teste', 'similaridade', 'rota', 'atividades', 'padrao_amostra', 
                        'mo_maq', 'tc_minutos']

# Renomear colunas para a segunda aba
base_fluxo_analise.columns = ['ativo', 'analise_cq', 'forma_farmaceutica', 'teste', 
                               'similaridade', 'rota', 'atividades', 'padrao_amostra', 
                               'mo_maq', 'tc_minutos']

# Combinar dados (remover duplicatas)
basefluxo_combined = pd.concat([bd_tc_geral, base_fluxo_analise], ignore_index=True)
basefluxo_combined = basefluxo_combined.drop_duplicates(subset=['ativo', 'teste', 'rota', 'atividades', 'padrao_amostra'])

# Converter para estrutura hierárquica
basefluxo_hierarchy = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))

for _, row in basefluxo_combined.iterrows():
    ativo = str(row['ativo']).strip() if pd.notna(row['ativo']) else 'DESCONHECIDO'
    forma = str(row['forma_farmaceutica']).strip() if pd.notna(row['forma_farmaceutica']) else 'DESCONHECIDA'
    teste = str(row['teste']).strip() if pd.notna(row['teste']) else 'DESCONHECIDO'
    similaridade = str(row['similaridade']).strip() if pd.notna(row['similaridade']) else 'NÃO APLICÁVEL'
    rota = str(row['rota']).strip() if pd.notna(row['rota']) else 'DESCONHECIDA'
    atividade = str(row['atividades']).strip() if pd.notna(row['atividades']) else 'DESCONHECIDA'
    padrao_amostra = str(row['padrao_amostra']).strip() if pd.notna(row['padrao_amostra']) else 'DESCONHECIDO'
    mo_maq = str(row['mo_maq']).strip() if pd.notna(row['mo_maq']) else 'DESCONHECIDO'
    tc = float(row['tc_minutos']) if pd.notna(row['tc_minutos']) and isinstance(row['tc_minutos'], (int, float)) else 0
    
    basefluxo_hierarchy[ativo][forma][teste].append({
        'similaridade': similaridade,
        'rota': rota,
        'atividade': atividade,
        'padrao_amostra': padrao_amostra,
        'execucao': mo_maq,
        'tempo_corrida_minutos': tc
    })

# Converter para dicionário normal
basefluxo_dict = {}
for ativo, formas in basefluxo_hierarchy.items():
    basefluxo_dict[ativo] = {}
    for forma, testes in formas.items():
        basefluxo_dict[ativo][forma] = {}
        for teste, atividades in testes.items():
            basefluxo_dict[ativo][forma][teste] = atividades

# Salvar BASEFLUXO estruturado
with open('/home/ubuntu/basefluxo_estruturado.json', 'w', encoding='utf-8') as f:
    json.dump(basefluxo_dict, f, indent=2, ensure_ascii=False)

print(f"✓ BASEFLUXO estruturado salvo")
print(f"  - Ativos: {len(basefluxo_dict)}")
print(f"  - Formas farmacêuticas: {sum(len(f) for f in basefluxo_dict.values())}")

# ============================================================================
# PARTE 2: PROCESSAR MFVCQ - Demanda
# ============================================================================

print("\n[2/4] Processando MFVCQ...")

mfvcq_file = 'MFVCQ_Oficial-DEMANDAATUALIZADAFEVMARABR2024.xlsb'
demanda = pd.read_excel(mfvcq_file, sheet_name='DEMANDA', engine='pyxlsb')

# Limpar dados
demanda = demanda.dropna(axis=1, how='all').dropna(axis=0, how='all')

# Renomear colunas (25 colunas)
col_names = ['centro', 'codigo_pa', 'codigo_bulk', 'descricao', 'cod_analise_cq', 
             'analise_cq', 'tem_demanda', 'eh_solido', 'ativo', 'contemplado_pmp',
             'observacao', 'media_12_meses', 'fator_conversao', 'demanda_convertida',
             'tamanho_bulk', 'tamanho_lote_pa', 'demanda_lotes', 'demanda_lotes_bulk',
             'historico_entr', 'hist_med_mes', 'p_r', 'celula', 'historico_demanda_anterior',
             'diferenca_atual', 'col_extra']

# Ajustar número de colunas
demanda.columns = col_names[:len(demanda.columns)]

# Filtrar apenas linhas com dados válidos (skip headers)
demanda = demanda[demanda['ativo'].notna() & (demanda['ativo'] != 'ATIVO')]
demanda = demanda[demanda['codigo_pa'].notna()]

# Converter tipos de dados
demanda['codigo_pa'] = pd.to_numeric(demanda['codigo_pa'], errors='coerce')
demanda['codigo_bulk'] = pd.to_numeric(demanda['codigo_bulk'], errors='coerce')
demanda['media_12_meses'] = pd.to_numeric(demanda['media_12_meses'], errors='coerce')
demanda['fator_conversao'] = pd.to_numeric(demanda['fator_conversao'], errors='coerce')
demanda['demanda_convertida'] = pd.to_numeric(demanda['demanda_convertida'], errors='coerce')
demanda['tamanho_bulk'] = pd.to_numeric(demanda['tamanho_bulk'], errors='coerce')
demanda['tamanho_lote_pa'] = pd.to_numeric(demanda['tamanho_lote_pa'], errors='coerce')
demanda['demanda_lotes'] = pd.to_numeric(demanda['demanda_lotes'], errors='coerce')
demanda['demanda_lotes_bulk'] = pd.to_numeric(demanda['demanda_lotes_bulk'], errors='coerce')

# Converter para lista de dicionários
demanda_list = demanda.to_dict(orient='records')

# Salvar DEMANDA estruturada
with open('/home/ubuntu/demanda_estruturada.json', 'w', encoding='utf-8') as f:
    json.dump(demanda_list, f, indent=2, ensure_ascii=False)

print(f"✓ DEMANDA estruturada salva")
print(f"  - Produtos: {len(demanda_list)}")
print(f"  - Células: {demanda['celula'].nunique()}")

# ============================================================================
# PARTE 3: CRIAR ÍNDICES PARA BUSCA RÁPIDA
# ============================================================================

print("\n[3/4] Criando índices de busca...")

# Índice de ativos
ativos_index = {}
for ativo in basefluxo_dict.keys():
    ativos_index[ativo.lower()] = ativo

# Índice de formas farmacêuticas
formas_index = set()
for ativo in basefluxo_dict.values():
    for forma in ativo.keys():
        formas_index.add(forma)
formas_index = list(formas_index)

# Índice de testes
testes_index = set()
for ativo in basefluxo_dict.values():
    for forma in ativo.values():
        for teste in forma.keys():
            testes_index.add(teste)
testes_index = list(testes_index)

# Índice de rotas
rotas_index = set()
for ativo in basefluxo_dict.values():
    for forma in ativo.values():
        for teste in forma.values():
            for atividade in teste:
                rotas_index.add(atividade['rota'])
rotas_index = list(rotas_index)

# Índice de células
celulas_index = demanda['celula'].dropna().unique().tolist()

# Índice de produtos por ativo
produtos_por_ativo = defaultdict(list)
for _, row in demanda.iterrows():
    ativo = str(row['ativo']).strip().lower()
    produtos_por_ativo[ativo].append({
        'codigo_pa': row['codigo_pa'],
        'codigo_bulk': row['codigo_bulk'],
        'descricao': row['descricao'],
        'celula': row['celula']
    })

# Salvar índices
indices = {
    'ativos': list(ativos_index.keys()),
    'formas_farmaceuticas': formas_index,
    'testes': testes_index,
    'rotas': rotas_index,
    'celulas': celulas_index,
    'produtos_por_ativo': {k: v for k, v in produtos_por_ativo.items()}
}

with open('/home/ubuntu/indices_busca.json', 'w', encoding='utf-8') as f:
    json.dump(indices, f, indent=2, ensure_ascii=False)

print(f"✓ Índices criados")
print(f"  - Ativos: {len(indices['ativos'])}")
print(f"  - Formas: {len(indices['formas_farmaceuticas'])}")
print(f"  - Testes: {len(indices['testes'])}")
print(f"  - Rotas: {len(indices['rotas'])}")
print(f"  - Células: {len(indices['celulas'])}")

# ============================================================================
# PARTE 4: CRIAR ESTRUTURA DE TEMPLATE PARA NOVO PRODUTO
# ============================================================================

print("\n[4/4] Criando template para novo produto...")

template_novo_produto = {
    "ativo": "NOME_DO_ATIVO",
    "codigo_pa": "CÓDIGO_PRODUTO_ACABADO",
    "codigo_bulk": "CÓDIGO_BULK",
    "descricao": "DESCRIÇÃO_COMPLETA",
    "forma_farmaceutica": "Sólidos|Líquidos|Injetáveis|Suspensões|Cremes|Pomadas",
    "celula": "CÉLULA_DE_PRODUÇÃO",
    "demanda": {
        "media_12_meses": 0.0,
        "fator_conversao": 1.0,
        "tamanho_bulk": 0.0,
        "tamanho_lote_pa": 0.0,
        "demanda_em_lotes": 0.0,
        "demanda_em_lotes_bulk": 0.0
    },
    "analises_cq": [
        {
            "tipo": "Bulk|Produto Acabado",
            "teste": "TESTE_REALIZADO",
            "similaridade": "SIMILARIDADE",
            "rota": "ROTA_EQUIPAMENTO",
            "atividades": [
                {
                    "descricao": "DESCRIÇÃO_ATIVIDADE",
                    "padrao_amostra": "Padrão|Amostra",
                    "execucao": "MO|MAQ",
                    "tempo_corrida_minutos": 0
                }
            ]
        }
    ],
    "tempo_total_analise_minutos": 0.0,
    "tempo_total_analise_horas": 0.0
}

with open('/home/ubuntu/template_novo_produto.json', 'w', encoding='utf-8') as f:
    json.dump(template_novo_produto, f, indent=2, ensure_ascii=False)

print(f"✓ Template criado")

# ============================================================================
# RESUMO FINAL
# ============================================================================

print("\n" + "="*80)
print("TRANSFORMAÇÃO CONCLUÍDA COM SUCESSO!")
print("="*80)

print("\nArquivos gerados:")
print("  1. /home/ubuntu/basefluxo_estruturado.json - Base de fluxo hierárquica")
print("  2. /home/ubuntu/demanda_estruturada.json - Demanda de produtos")
print("  3. /home/ubuntu/indices_busca.json - Índices para busca rápida")
print("  4. /home/ubuntu/template_novo_produto.json - Template para novo produto")

print("\nEstatísticas:")
print(f"  - Ativos únicos: {len(basefluxo_dict)}")
print(f"  - Produtos na demanda: {len(demanda_list)}")
print(f"  - Células de produção: {len(celulas_index)}")
print(f"  - Rotas de análise: {len(rotas_index)}")
print(f"  - Testes possíveis: {len(testes_index)}")

print("\nPróximas etapas:")
print("  1. Revisar estrutura JSON")
print("  2. Criar skills para processamento automático")
print("  3. Implementar validações e regras de negócio")
print("  4. Testar com novo produto")
