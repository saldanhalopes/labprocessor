# LabProcessor Plus 🧪

LabProcessor Plus é uma solução completa em monorepo projetada para análise inteligente de documentos laboratoriais e métodos analíticos. Utilizando o poder do **Google Gemini API** e **RAG (Retrieval-Augmented Generation)**, o sistema permite extrair dados críticos de arquivos PDF e interagir com o conhecimento armazenado via chat contextual.

---

## 🚀 Arquitetura e Tecnologias

O projeto é estruturado como um monorepo moderno:

- **Frontend:** React + Vite (Interface rápida, responsiva e premium).
- **Backend:** Node.js + Express (Processamento de arquivos e orquestração de IA).
- **Banco de Dados:** Google Cloud Firestore (NoSQL escalável).
- **Storage:** Google Cloud Storage (Armazenamento de documentos e imagens extraídas).
- **Inteligência Artificial:** 
  - **Google Gemini 2.0 Flash:** Para análise de documentos e chat.
  - **Pinecone:** Vector Database para busca semântica e RAG.

---

## ✨ Funcionalidades Principais

- **Análise de Documentos:** Upload de métodos analíticos em PDF com extração automática de tabelas, reagentes, normas e equipamentos.
- **Chat Inteligente (RAG):** Converse com seus documentos de forma contextualizada usando busca vetorial.
- **Gestão de Usuários:** Sistema de autenticação e controle de acesso integrado ao Firestore.
- **Cloud Native:** Totalmente preparado para o **Firebase App Hosting** e Cloud Run.
- **Deploy Resiliente:** Startup inteligente que prioriza disponibilidade (Health Checks).

---

## 🛠️ Configuração e Instalação (Local)

### Pré-requisitos
- Node.js 20+
- Google Cloud SDK (Opcional, mas recomendado para ADC)

### Instalação
No diretório raiz do projeto:
```bash
npm install
```

### Variáveis de Ambiente
Crie um arquivo `.env.local` na pasta `backend/` com as seguintes chaves:

```env
DATABASE_TYPE=firestore
FIREBASE_STORAGE_BUCKET=seu-bucket.appspot.com
GEMINI_API_KEY=sua_chave_gemini
PINECONE_API_KEY=sua_chave_pinecone
PINECONE_INDEX=seu_indice
```

### Autenticação Local
Para acessar o Firestore/Storage localmente, coloque o arquivo `firebase-service-account.json` na pasta `backend/` ou execute:
```bash
gcloud auth application-default login
```

### Execução
```bash
# Iniciar Frontend e Backend simultaneamente
npm run dev
```

---

## 🌐 Deploy (Firebase)

O projeto está configurado para o **Firebase App Hosting**. 

1. O arquivo `apphosting.yaml` define o processo de build unificado.
2. Segredos (API Keys) devem ser configurados no **Console do Firebase** em "App Hosting -> Variáveis de Ambiente".
3. O deploy é automático via GitHub Integration.

---

## 📁 Estrutura do Projeto

```text
├── backend/            # Servidor Express, IA e Camada de Dados
├── frontend/           # Aplicação React + Vite
├── apphosting.yaml     # Configuração de Deploy Cloud
└── package.json        # Orquestração de scripts do monorepo
```

---

## 🔒 Segurança

- **Secrets:** Arquivos `.env` e chaves `.json` estão ignorados pelo Git. **Nunca** comite chaves privadas.
- **Admin:** O sistema cria automaticamente um usuário `admin` / `admin` no primeiro startup para garantir o acesso inicial. Recomenda-se trocar a senha após o primeiro login.

---
Desenvolvido com foco em excelência laboratorial e inteligência artificial.
