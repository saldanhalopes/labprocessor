import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, FileText, FolderOpen, Save, RefreshCw, ExternalLink, Search, ChevronRight, ChevronDown, Loader2, Edit3 } from 'lucide-react';

interface VaultNode {
  name: string;
  type: 'folder' | 'file';
  path?: string;
  size?: number;
  modified?: string;
  children?: VaultNode[];
}

const KnowledgeView: React.FC = () => {
  const [tree, setTree] = useState<VaultNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['Testes']));
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [editedContent, setEditedContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [frontmatter, setFrontmatter] = useState<Record<string, any> | null>(null);

  const loadTree = useCallback(async () => {
    setLoadingTree(true);
    try {
      const res = await fetch('/api/knowledge/vault');
      const data = await res.json();
      setTree(data.tree || []);
    } catch (e) { console.error('Error loading vault:', e); }
    finally { setLoadingTree(false); }
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  const loadFile = async (nodePath: string) => {
    setSelected(nodePath);
    setLoadingFile(true);
    setIsEditing(false);
    try {
      const res = await fetch(`/api/knowledge/vault/${nodePath}`);
      const data = await res.json();
      setContent(data.content || '');
      setEditedContent(data.content || '');
      // Parse frontmatter
      if (data.content) parseYaml(data.content);
    } catch (e) { console.error('Error loading file:', e); }
    finally { setLoadingFile(false); }
  };

  const parseYaml = (text: string) => {
    const match = text.match(/^---\n([\s\S]*?)\n---/);
    if (!match) { setFrontmatter(null); return; }
    const yamlBlock = match[1];
    const fm: Record<string, any> = {};
    yamlBlock.split('\n').forEach(line => {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (m) {
        try { fm[m[1]] = JSON.parse(m[2]); }
        catch { fm[m[1]] = m[2].replace(/['"]/g, ''); }
      }
    });
    setFrontmatter(fm);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/knowledge/vault/${selected}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editedContent })
      });
      setContent(editedContent);
      parseYaml(editedContent);
      setIsEditing(false);
    } catch (e) { console.error('Error saving:', e); }
    finally { setSaving(false); }
  };

  const toggleFolder = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const filteredTree = search ? filterTree(tree, search.toLowerCase()) : tree;

  const allFiles = flattenTree(tree);
  const stats = {
    total: allFiles.length,
    tests: tree.find(f => f.name === 'Testes')?.children?.length || 0,
    products: tree.find(f => f.name === 'Produtos')?.children?.length || 0,
  };

  return (
    <div className="animate-fade-in-up">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center justify-center gap-3">
          <BookOpen className="w-8 h-8 text-violet-600" />
          Vault Obsidian
        </h2>
        <p className="text-slate-500 mt-2">
          Navegue e edite as notas do conhecimento do laboratório
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Notas', value: stats.total, color: 'violet' },
          { label: 'Testes', value: stats.tests, color: 'teal' },
          { label: 'Produtos', value: stats.products, color: 'amber' },
        ].map(s => (
          <div key={s.label} className={`bg-${s.color}-50 border border-${s.color}-200 rounded-xl p-4 text-center`}>
            <div className={`text-2xl font-black text-${s.color}-600`}>{s.value}</div>
            <div className={`text-xs font-bold text-${s.color}-500 uppercase tracking-wider`}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* File Tree Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-violet-500" />
                Arquivos
              </h3>
              <button onClick={loadTree} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400" title="Atualizar">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2">
              <div className="relative mb-3">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filtrar..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300"
                />
              </div>
              <div className="max-h-[500px] overflow-y-auto no-scrollbar">
                {loadingTree ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
                ) : (
                  <TreeNodes nodes={filteredTree} expanded={expanded} onToggle={toggleFolder} selected={selected} onSelect={loadFile} />
                )}
              </div>
            </div>
          </div>

          {/* Open in Obsidian */}
          <div className="mt-4 p-4 bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl">
            <p className="text-xs font-bold text-violet-700 mb-2">Abrir no Obsidian Desktop</p>
            <a
              href="obsidian://open?vault=LabProcessor"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors w-full justify-center"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir Vault
            </a>
            <p className="text-[10px] text-violet-400 mt-2 text-center">
              Requer Obsidian instalado e vault configurado como "LabProcessor"
            </p>
          </div>
        </div>

        {/* Editor Panel */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
              <FileText className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">Selecione um arquivo para visualizar</p>
              <p className="text-slate-400 text-sm mt-1">Navegue pelas pastas do vault à esquerda</p>
            </div>
          ) : loadingFile ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-violet-500" />
                  <span className="font-mono text-sm text-slate-600">{selected}</span>
                </div>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => { setEditedContent(content); setIsEditing(false); }}
                        className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        Salvar
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                      Editar
                    </button>
                  )}
                </div>
              </div>

              {/* Frontmatter card */}
              {frontmatter && (
                <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(frontmatter)
                      .filter(([k]) => !['aliases', 'tags', 'rotas'].includes(k))
                      .map(([key, val]) => (
                        <div key={key} className="bg-white rounded-lg border border-slate-200 p-2.5">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{key}</div>
                          <div className="text-sm font-semibold text-slate-700 truncate">{String(val)}</div>
                        </div>
                      ))}
                  </div>
                  {/* Aliases */}
                  {frontmatter.aliases && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Array.isArray(frontmatter.aliases) && frontmatter.aliases.map((a: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded-md text-[10px] font-bold">{a}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Editor / Viewer */}
              <div className="p-6">
                {isEditing ? (
                  <textarea
                    value={editedContent}
                    onChange={e => setEditedContent(e.target.value)}
                    className="w-full h-[400px] font-mono text-sm text-slate-700 border border-slate-200 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 resize-none"
                    spellCheck={false}
                  />
                ) : (
                  <div className="prose prose-sm max-w-none prose-headings:text-slate-800 prose-p:text-slate-600 prose-code:text-violet-600 prose-code:bg-violet-50 prose-code:px-1 prose-code:rounded font-mono text-sm text-slate-600 whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                    {content}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function flattenTree(nodes: VaultNode[]): VaultNode[] {
  const result: VaultNode[] = [];
  const walk = (items: VaultNode[]) => {
    for (const item of items) {
      if (item.type === 'file') result.push(item);
      if (item.children) walk(item.children);
    }
  };
  walk(nodes);
  return result;
}

function filterTree(nodes: VaultNode[], query: string): VaultNode[] {
  return nodes
    .map(n => {
      if (n.type === 'file') {
        return n.name.toLowerCase().includes(query) ? n : null;
      }
      const filtered = n.children ? filterTree(n.children, query) : [];
      return filtered.length > 0 || n.name.toLowerCase().includes(query)
        ? { ...n, children: filtered }
        : null;
    })
    .filter(Boolean) as VaultNode[];
}

function TreeNodes({ nodes, expanded, onToggle, selected, onSelect }: {
  nodes: VaultNode[];
  expanded: Set<string>;
  onToggle: (name: string) => void;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map(node => {
        if (node.type === 'folder') {
          const isOpen = expanded.has(node.name);
          return (
            <li key={node.name}>
              <button
                onClick={() => onToggle(node.name)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                <FolderOpen className="w-3.5 h-3.5 text-amber-500" />
                <span>{node.name}</span>
                <span className="ml-auto text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{node.children?.length || 0}</span>
              </button>
              {isOpen && node.children && (
                <div className="ml-4 border-l border-slate-100 pl-2">
                  <TreeNodes nodes={node.children} expanded={expanded} onToggle={onToggle} selected={selected} onSelect={onSelect} />
                </div>
              )}
            </li>
          );
        }
        const isActive = selected === node.path!;
        return (
          <li key={node.name}>
            <button
              onClick={() => onSelect(node.path!)}
              className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition-colors text-left ${
                isActive
                  ? 'bg-violet-50 text-violet-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span className="truncate">{node.name.replace('.md', '')}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default KnowledgeView;
