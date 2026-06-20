#!/usr/bin/env python3
import json
import os
import sys
import argparse
from pathlib import Path

# Configurar caminhos
SKILL_DIR = Path(__file__).parent.parent
REFS_DIR = SKILL_DIR / 'references'
TEMPLATES_DIR = SKILL_DIR / 'templates'

def load_data():
    """Carrega os dados de referência."""
    with open(REFS_DIR / 'basefluxo_estruturado.json', 'r', encoding='utf-8') as f:
        basefluxo = json.load(f)
    with open(REFS_DIR / 'demanda_estruturada.json', 'r', encoding='utf-8') as f:
        demanda = json.load(f)
    with open(REFS_DIR / 'indices_busca.json', 'r', encoding='utf-8') as f:
        indices = json.load(f)
    return basefluxo, demanda, indices

def analyze_product(ativo, codigo_pa=None, forma=None, media_mensal=0, fator_conversao=1.0, tamanho_bulk=0):
    """Analisa um produto novo ou existente e gera seu fluxo e demanda."""
    basefluxo, demanda, indices = load_data()
    
    # 1. Buscar fluxo do ativo na BASEFLUXO
    ativo_upper = str(ativo).upper()
    fluxo_ativo = basefluxo.get(ativo_upper)
    
    if not fluxo_ativo:
        # Se não encontrou o ativo exato, tentar buscar por aproximação
        ativos_similares = [a for a in basefluxo.keys() if ativo_upper in a or a in ativo_upper]
        if ativos_similares:
            ativo_upper = ativos_similares[0]
            fluxo_ativo = basefluxo.get(ativo_upper)
            print(f"Ativo exato não encontrado. Usando similar: {ativo_upper}")
        else:
            print(f"AVISO: Ativo '{ativo_upper}' não encontrado na BASEFLUXO.")
            print("Será necessário criar um fluxo do zero baseado em produtos similares.")
            fluxo_ativo = {}
            
    # 2. Selecionar a forma farmacêutica correta
    fluxo_forma = {}
    forma_selecionada = forma
    
    if fluxo_ativo:
        if forma and forma in fluxo_ativo:
            fluxo_forma = fluxo_ativo[forma]
        elif len(fluxo_ativo) == 1:
            forma_selecionada = list(fluxo_ativo.keys())[0]
            fluxo_forma = fluxo_ativo[forma_selecionada]
            print(f"Forma não especificada ou não encontrada. Usando única disponível: {forma_selecionada}")
        else:
            print(f"Formas disponíveis para {ativo_upper}: {list(fluxo_ativo.keys())}")
            
    # 3. Calcular tempos totais
    tempo_total_minutos = 0
    analises_cq = []
    
    for teste, atividades in fluxo_forma.items():
        # Simplificando: pegando apenas o primeiro item da lista de atividades por teste
        # Na prática real, pode haver múltiplas rotas/similaridades
        if atividades and isinstance(atividades, list):
            item = atividades[0]
            
            # Somar todos os tempos deste teste
            tempo_teste = sum(a.get('tempo_corrida_minutos', 0) for a in atividades)
            tempo_total_minutos += tempo_teste
            
            analises_cq.append({
                "tipo": "Bulk", # Default para análises da basefluxo
                "teste": teste,
                "similaridade": item.get('similaridade', 'NÃO APLICÁVEL'),
                "rota": item.get('rota', 'DESCONHECIDA'),
                "atividades": atividades
            })
            
    # 4. Calcular demanda
    demanda_convertida = float(media_mensal) * float(fator_conversao)
    demanda_lotes = 0
    if float(tamanho_bulk) > 0:
        demanda_lotes = demanda_convertida / float(tamanho_bulk)
        
    # 5. Determinar célula de produção
    celula = "DESCONHECIDA"
    if forma_selecionada:
        forma_lower = str(forma_selecionada).lower()
        if "sólido" in forma_lower:
            celula = "SÓLIDOS 1" # Default, pode precisar ajuste
        elif "líquido" in forma_lower or "susp" in forma_lower:
            celula = "SUSP/LIQ/CR/POM I, II e III"
        elif "inj" in forma_lower:
            celula = "INJETÁVEIS e ONCOLÓGICOS"
            
    # 6. Montar resultado
    resultado = {
        "ativo": ativo_upper,
        "codigo_pa": codigo_pa,
        "forma_farmaceutica": forma_selecionada,
        "celula": celula,
        "demanda": {
            "media_12_meses": float(media_mensal),
            "fator_conversao": float(fator_conversao),
            "demanda_convertida": demanda_convertida,
            "tamanho_bulk": float(tamanho_bulk),
            "demanda_em_lotes": demanda_lotes
        },
        "analises_cq": analises_cq,
        "resumo_tempos": {
            "tempo_unitario_minutos": tempo_total_minutos,
            "tempo_unitario_horas": round(tempo_total_minutos / 60, 2),
            "tempo_total_lotes_minutos": tempo_total_minutos * demanda_lotes,
            "tempo_total_lotes_horas": round((tempo_total_minutos * demanda_lotes) / 60, 2)
        }
    }
    
    return resultado

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analisa fluxo de CQ e demanda para produtos")
    parser.add_argument("--ativo", required=True, help="Nome do princípio ativo")
    parser.add_argument("--codigo", help="Código do produto acabado")
    parser.add_argument("--forma", help="Forma farmacêutica")
    parser.add_argument("--media", type=float, default=0, help="Média mensal de demanda")
    parser.add_argument("--fator", type=float, default=1.0, help="Fator de conversão")
    parser.add_argument("--bulk", type=float, default=0, help="Tamanho do bulk")
    parser.add_argument("--out", help="Arquivo de saída JSON")
    
    args = parser.parse_args()
    
    resultado = analyze_product(
        args.ativo, 
        args.codigo, 
        args.forma, 
        args.media, 
        args.fator, 
        args.bulk
    )
    
    if args.out:
        with open(args.out, 'w', encoding='utf-8') as f:
            json.dump(resultado, f, indent=2, ensure_ascii=False)
        print(f"Resultado salvo em {args.out}")
    else:
        print(json.dumps(resultado, indent=2, ensure_ascii=False))
