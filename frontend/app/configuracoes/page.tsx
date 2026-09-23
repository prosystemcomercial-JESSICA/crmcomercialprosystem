'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useTheme, ThemeColor, ThemeMode } from '@/lib/theme-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Check, Moon, Sun, Palette, Bell, GitMerge, FileText, Info, Save, Zap, Shield, ExternalLink, DatabaseBackup, AlertTriangle, MessageSquare } from 'lucide-react';
import { apiClient, ResumoBackup } from '@/lib/api-client';

// ─── Theme Definitions ────────────────────────────────────

const THEMES: Array<{
  id: ThemeColor;
  name: string;
  description: string;
  primary: string;
  dark: string;
  light: string;
  preview: string[];
}> = [
  {
    id: 'azul',
    name: 'Azul ProSystem',
    description: 'Identidade oficial da marca. Seriedade e confiança.',
    primary: '#4B8EC8',
    dark: '#2E6EAB',
    light: '#EBF4FF',
    preview: ['#0D2238', '#4B8EC8', '#EBF4FF', '#F4F7FB'],
  },
  {
    id: 'laranja',
    name: 'Laranja Energia',
    description: 'Alto contraste e dinamismo. Ideal para times comerciais.',
    primary: '#E8711A',
    dark: '#C45E10',
    light: '#FFF4ED',
    preview: ['#1C0E05', '#E8711A', '#FFF4ED', '#FFF8F4'],
  },
  {
    id: 'verde',
    name: 'Verde Crescimento',
    description: 'Transmite crescimento e retenção. Foco em resultados.',
    primary: '#1A9E5A',
    dark: '#127A44',
    light: '#EAFAF3',
    preview: ['#052015', '#1A9E5A', '#EAFAF3', '#F4FAF7'],
  },
];

// ─── Config sections ──────────────────────────────────────

const SECOES = [
  {
    id: 'pipeline',
    label: 'Central de Leads',
    icon: GitMerge,
    campos: [
      { key: 'etapas_funil', label: 'Etapas do Funil', tipo: 'info', valor: 'Prospecção → Qualificação → Apresentação → Proposta → Negociação → Fechamento' },
      { key: 'prob_default', label: 'Probabilidade padrão', tipo: 'info', valor: '10% → 25% → 40% → 60% → 75% → 90%' },
    ]
  },
  {
    id: 'leads',
    label: 'Leads',
    icon: Bell,
    campos: [
      { key: 'origens', label: 'Origens disponíveis', tipo: 'info', valor: 'Manual, Site, Indicação, Campanha, Evento, Outro' },
      { key: 'temperatura', label: 'Temperatura padrão', tipo: 'info', valor: 'FRIO' },
      { key: 'nutricao_dias', label: 'Dias sem atividade para alertar', tipo: 'number', valor: '7' },
    ]
  },
  {
    id: 'propostas',
    label: 'Propostas',
    icon: FileText,
    campos: [
      { key: 'validade_default', label: 'Validade padrão (dias)', tipo: 'number', valor: '30' },
      { key: 'alerta_expiracao', label: 'Alertar antes de expirar (dias)', tipo: 'number', valor: '3' },
    ]
  },
  {
    id: 'notificacoes',
    label: 'Notificações',
    icon: Bell,
    campos: [
      { key: 'alerta_atividade', label: 'Alertar atividades atrasadas', tipo: 'toggle', valor: 'true' },
      { key: 'alerta_proposta', label: 'Alertar propostas expirando', tipo: 'toggle', valor: 'true' },
      { key: 'alerta_sem_atividade', label: 'Alertar leads sem atividade', tipo: 'toggle', valor: 'true' },
    ]
  },
];

// ─── Component ────────────────────────────────────────────

// Mesma lista de gestão do backend (podeVerTudo em backend/src/lib/scope.ts).
const ROLES_GESTAO_WPP = ['CEO', 'DIRETOR', 'ADMIN', 'SUPERVISAO_COMERCIAL', 'SUPERVISAO'];

type MaterialTriagem = { texto: string; imagem: string | null; pdf: string | null; pdf_nome: string | null };
const MATERIAL_VAZIO: MaterialTriagem = { texto: '', imagem: null, pdf: null, pdf_nome: null };

type WhatsappEmpresaStatus = {
  configurado: boolean;
  conectado: boolean;
  status: string;
  numero: string | null;
  webhook_url?: string | null;
};

export default function ConfiguracoesPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const { color: themeColor, mode: themeMode, setColor, setMode } = useTheme();
  const router = useRouter();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  // ZapSign
  const [zapConfig, setZapConfig] = useState({
    ZAPSIGN_API_TOKEN: '',
    ZAPSIGN_ENVIRONMENT: 'sandbox',
    ZAPSIGN_WEBHOOK_SECRET: '',
    ZAPSIGN_TEMPLATE_PRO: '',
    ZAPSIGN_TEMPLATE_PLUS: '',
    ZAPSIGN_TEMPLATE_FARMA_PRO: '',
    ZAPSIGN_TEMPLATE_FARMA_PLUS: '',
    ZAPSIGN_TEMPLATE_PADARIA_PRO: '',
    ZAPSIGN_TEMPLATE_PADARIA_PLUS: '',
  });
  const [zapSaving, setZapSaving] = useState(false);
  const [zapSaved, setZapSaved] = useState(false);
  const [zapLoading, setZapLoading] = useState(false);

  // WhatsApp da empresa (instância única UAZAPI — só gestão)
  const gestaoWpp = ROLES_GESTAO_WPP.includes(((user as any)?.role || '').toUpperCase());
  const [wppEmpresa, setWppEmpresa] = useState<WhatsappEmpresaStatus | null>(null);
  const [wppToken, setWppToken] = useState('');
  const [wppLoading, setWppLoading] = useState(false);
  const [wppSalvando, setWppSalvando] = useState(false);
  const [wppErro, setWppErro] = useState<string | null>(null);
  const [wppOk, setWppOk] = useState(false);

  // Triagem automática do WhatsApp (só gestão)
  const [triagem, setTriagem] = useState<{ ativa: boolean; material: { farmacia: MaterialTriagem; padaria: MaterialTriagem } }>({ ativa: false, material: { farmacia: MATERIAL_VAZIO, padaria: MATERIAL_VAZIO } });
  const [triagemSalvando, setTriagemSalvando] = useState(false);
  const [triagemMsg, setTriagemMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  // Backup manual
  const [backups, setBackups] = useState<ResumoBackup[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupRodando, setBackupRodando] = useState(false);
  const [backupErro, setBackupErro] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  useEffect(() => {
    const initial: Record<string, string> = {};
    SECOES.forEach(s => s.campos.forEach(c => { initial[c.key] = c.valor; }));
    setValores(initial);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    setZapLoading(true);
    apiClient.getConfiguracoesIntegracoes()
      .then(res => {
        const d = res.data.data || {};
        setZapConfig(prev => ({
          ...prev,
          ZAPSIGN_API_TOKEN:          d.ZAPSIGN_API_TOKEN          || '',
          ZAPSIGN_ENVIRONMENT:        d.ZAPSIGN_ENVIRONMENT        || 'sandbox',
          ZAPSIGN_WEBHOOK_SECRET:     d.ZAPSIGN_WEBHOOK_SECRET     || '',
          ZAPSIGN_TEMPLATE_PRO:       d.ZAPSIGN_TEMPLATE_PRO       || '',
          ZAPSIGN_TEMPLATE_PLUS:      d.ZAPSIGN_TEMPLATE_PLUS      || '',
          ZAPSIGN_TEMPLATE_FARMA_PRO: d.ZAPSIGN_TEMPLATE_FARMA_PRO || '',
          ZAPSIGN_TEMPLATE_FARMA_PLUS:d.ZAPSIGN_TEMPLATE_FARMA_PLUS|| '',
          ZAPSIGN_TEMPLATE_PADARIA_PRO: d.ZAPSIGN_TEMPLATE_PADARIA_PRO || '',
          ZAPSIGN_TEMPLATE_PADARIA_PLUS:d.ZAPSIGN_TEMPLATE_PADARIA_PLUS|| '',
        }));
      })
      .catch(() => {})
      .finally(() => setZapLoading(false));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !gestaoWpp) return;
    setWppLoading(true);
    apiClient.getWhatsappEmpresa()
      .then(res => setWppEmpresa(res.data.data))
      .catch(() => setWppEmpresa(null))
      .finally(() => setWppLoading(false));
    apiClient.getWhatsappTriagem()
      .then(res => {
        const d = res.data.data;
        if (d) setTriagem({
          ativa: !!d.ativa,
          material: {
            farmacia: { ...MATERIAL_VAZIO, ...(d.material?.farmacia || {}) },
            padaria: { ...MATERIAL_VAZIO, ...(d.material?.padaria || {}) },
          },
        });
      })
      .catch(() => {});
  }, [isAuthenticated, gestaoWpp]);

  const lerArquivoComoDataUrl = (file: File, limiteMb: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.size > limiteMb * 1024 * 1024) {
        reject(new Error(`Arquivo grande demais (máx. 5 MB imagem / 10 MB PDF).`));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
      reader.readAsDataURL(file);
    });
  };

  const handleTriagemImagem = async (segmento: 'farmacia' | 'padaria', file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await lerArquivoComoDataUrl(file, 5);
      setTriagem(t => ({ ...t, material: { ...t.material, [segmento]: { ...t.material[segmento], imagem: dataUrl } } }));
    } catch (err: any) {
      setTriagemMsg({ ok: false, texto: err?.message || 'Arquivo grande demais (máx. 5 MB imagem / 10 MB PDF).' });
    }
  };

  const handleTriagemPdf = async (segmento: 'farmacia' | 'padaria', file: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await lerArquivoComoDataUrl(file, 10);
      setTriagem(t => ({ ...t, material: { ...t.material, [segmento]: { ...t.material[segmento], pdf: dataUrl, pdf_nome: file.name } } }));
    } catch (err: any) {
      setTriagemMsg({ ok: false, texto: err?.message || 'Arquivo grande demais (máx. 5 MB imagem / 10 MB PDF).' });
    }
  };

  const handleSalvarTriagem = async () => {
    setTriagemSalvando(true);
    setTriagemMsg(null);
    try {
      await apiClient.salvarWhatsappTriagem(triagem);
      setTriagemMsg({ ok: true, texto: 'Triagem salva.' });
    } catch (err: any) {
      setTriagemMsg({ ok: false, texto: err?.response?.data?.message || 'Falha ao salvar a triagem.' });
    } finally {
      setTriagemSalvando(false);
    }
  };

  const handleSalvarWppEmpresa = async () => {
    if (!wppToken.trim()) { setWppErro('Cole o token da instância.'); return; }
    setWppSalvando(true);
    setWppErro(null);
    try {
      const res = await apiClient.salvarWhatsappEmpresa(wppToken.trim());
      setWppEmpresa(res.data.data);
      setWppToken(''); // o token não volta do servidor e não fica na tela
      setWppOk(true);
      setTimeout(() => setWppOk(false), 2500);
    } catch (err: any) {
      setWppErro(err?.response?.data?.message || 'Falha ao salvar o token.');
    } finally {
      setWppSalvando(false);
    }
  };

  const carregarBackups = () => {
    setBackupsLoading(true);
    apiClient.listarBackups()
      .then(res => setBackups(res.data))
      .catch(() => {})
      .finally(() => setBackupsLoading(false));
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    carregarBackups();
  }, [isAuthenticated]);

  const handleBackupAgora = async () => {
    setBackupRodando(true);
    setBackupErro(null);
    try {
      await apiClient.executarBackup();
      carregarBackups();
    } catch (err: any) {
      setBackupErro(err?.response?.data?.error || 'Falha ao executar backup');
    } finally {
      setBackupRodando(false);
    }
  };

  const handleSaveZap = async () => {
    setZapSaving(true);
    try {
      await apiClient.saveConfiguracoesIntegracoes(zapConfig);
      setZapSaved(true);
      setTimeout(() => setZapSaved(false), 2500);
    } catch { /* ignore */ } finally { setZapSaving(false); }
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  if (loading || !isAuthenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--t-content-bg)' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--t-primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  const isCEO = user?.role === 'CEO' || user?.role === 'SUPERVISAO' || user?.role === 'ADMIN';

  const cardStyle: React.CSSProperties = {
    background: 'var(--t-card-bg)',
    border: '1px solid var(--t-card-border)',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 1px 3px var(--t-card-shadow)'
  };

  const sectionHeader: React.CSSProperties = {
    padding: '14px 20px',
    borderBottom: '1px solid var(--t-card-border)',
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--t-card-bg)'
  };

  const inputStyle: React.CSSProperties = {
    padding: '6px 12px', border: '1px solid var(--t-card-border)',
    borderRadius: 8, fontSize: 13, background: 'var(--t-card-bg)',
    color: 'var(--t-text-primary)', outline: 'none', width: 100,
    textAlign: 'right' as const
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--t-text-primary)', marginBottom: 4 }}>
              Configurações
            </h1>
            <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>
              Personalize o CRM para o seu processo de vendas
            </p>
          </div>
          {isCEO && (
            <button
              onClick={handleSave}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                color: '#fff', cursor: 'pointer', border: 'none',
                background: saved
                  ? 'linear-gradient(135deg, #16a34a, #15803d)'
                  : 'linear-gradient(135deg, var(--t-primary) 0%, var(--t-primary-dark) 100%)',
                boxShadow: '0 2px 8px color-mix(in srgb, var(--t-primary) 25%, transparent)',
                transition: 'all 0.2s'
              }}>
              {saved ? <><Check size={14} /> Salvo!</> : <><Save size={14} /> Salvar configurações</>}
            </button>
          )}
        </div>

        {!isCEO && (
          <div style={{
            marginBottom: 20, padding: '12px 16px', borderRadius: 10,
            background: '#fefce8', border: '1px solid #fde047',
            fontSize: 13, color: '#ca8a04', display: 'flex', alignItems: 'center', gap: 8
          }}>
            <Info size={14} /> Apenas CEO, Supervisão e Administrador podem alterar configurações.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ══ APARÊNCIA ══════════════════════════════════════ */}
          <div style={cardStyle}>
            <div style={sectionHeader}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--t-primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Palette size={16} color="var(--t-primary)" />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>Aparência</h2>
            </div>

            <div style={{ padding: 20 }}>

              {/* Modo claro / escuro */}
              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Modo
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {([
                    { id: 'claro' as ThemeMode, icon: Sun, label: 'Claro', desc: 'Interface luminosa, ideal para ambientes iluminados' },
                    { id: 'escuro' as ThemeMode, icon: Moon, label: 'Escuro', desc: 'Reduz a fadiga visual em ambientes com pouca luz' },
                  ]).map(m => {
                    const Icon = m.icon;
                    const isSelected = themeMode === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        style={{
                          flex: 1, padding: '16px', borderRadius: 12, cursor: 'pointer',
                          border: `2px solid ${isSelected ? 'var(--t-primary)' : 'var(--t-card-border)'}`,
                          background: isSelected ? 'var(--t-primary-light)' : 'var(--t-card-bg)',
                          textAlign: 'left' as const,
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: isSelected ? 'var(--t-primary)' : 'var(--t-card-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            <Icon size={18} color={isSelected ? '#fff' : 'var(--t-text-muted)'} />
                          </div>
                          {isSelected && (
                            <div style={{
                              width: 20, height: 20, borderRadius: '50%',
                              background: 'var(--t-primary)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              <Check size={11} color="#fff" />
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)', marginBottom: 3 }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--t-text-muted)', lineHeight: 1.4 }}>{m.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tema de cor */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Tema de Cor
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  {THEMES.map(t => {
                    const isSelected = themeColor === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setColor(t.id)}
                        style={{
                          padding: '16px', borderRadius: 12, cursor: 'pointer',
                          border: `2px solid ${isSelected ? t.primary : 'var(--t-card-border)'}`,
                          background: isSelected ? t.light : 'var(--t-card-bg)',
                          textAlign: 'left' as const,
                          transition: 'all 0.15s'
                        }}
                      >
                        {/* Color preview strip */}
                        <div style={{ display: 'flex', gap: 4, marginBottom: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {t.preview.map((c, i) => (
                              <div key={i} style={{
                                width: 20, height: 20, borderRadius: 6,
                                background: c,
                                border: '1px solid rgba(0,0,0,0.1)'
                              }} />
                            ))}
                          </div>
                          {isSelected && (
                            <div style={{
                              width: 22, height: 22, borderRadius: '50%',
                              background: t.primary,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <Check size={12} color="#fff" />
                            </div>
                          )}
                        </div>

                        {/* Sidebar miniatura */}
                        <div style={{
                          display: 'flex', gap: 4, marginBottom: 10,
                          padding: 8, borderRadius: 8,
                          background: t.preview[0], border: '1px solid rgba(255,255,255,0.08)'
                        }}>
                          <div style={{ width: 3, height: 32, borderRadius: 2, background: t.primary }} />
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {[14, 10, 10].map((w, i) => (
                              <div key={i} style={{ height: 4, borderRadius: 2, background: i === 0 ? t.primary : 'rgba(255,255,255,0.15)', width: `${w * 5}%` }} />
                            ))}
                          </div>
                        </div>

                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t-text-primary)', marginBottom: 3 }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--t-text-muted)', lineHeight: 1.4 }}>{t.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ══ BACKUP ══════════════════════════════════════ */}
          <div style={cardStyle}>
            <div style={sectionHeader}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--t-primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <DatabaseBackup size={16} color="var(--t-primary)" />
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>Backup</h2>
            </div>

            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--t-text-muted)', maxWidth: 480 }}>
                  Exporta todas as tabelas do banco agora mesmo. Mantém os 5 backups mais recentes.
                </p>
                <button
                  onClick={handleBackupAgora}
                  disabled={backupRodando}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    color: '#fff', cursor: backupRodando ? 'default' : 'pointer', border: 'none',
                    opacity: backupRodando ? 0.7 : 1,
                    background: 'linear-gradient(135deg, var(--t-primary) 0%, var(--t-primary-dark) 100%)',
                    boxShadow: '0 2px 8px color-mix(in srgb, var(--t-primary) 25%, transparent)',
                    transition: 'all 0.2s'
                  }}>
                  <DatabaseBackup size={14} />
                  {backupRodando ? 'Fazendo backup...' : 'Fazer backup agora'}
                </button>
              </div>

              {backupErro && (
                <div style={{
                  marginBottom: 16, padding: '10px 14px', borderRadius: 8,
                  background: 'var(--t-error-bg)', border: '1px solid var(--t-error-border)',
                  fontSize: 12, color: 'var(--t-error)', display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <AlertTriangle size={13} /> {backupErro}
                </div>
              )}

              {backupsLoading ? (
                <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Carregando...</p>
              ) : backups.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>Nenhum backup manual ainda.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {backups.map(b => {
                    const totalLinhas = Object.values(b.tabelas).reduce((a, c) => a + c, 0);
                    const totalTabelas = Object.keys(b.tabelas).length;
                    return (
                      <div key={b.timestamp} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 8,
                        background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)',
                        fontSize: 12
                      }}>
                        <span style={{ color: 'var(--t-text-primary)', fontWeight: 600 }}>
                          {new Date(b.data).toLocaleString('pt-BR')}
                        </span>
                        <span style={{ color: 'var(--t-text-muted)' }}>
                          {totalTabelas} tabelas · {totalLinhas} linhas
                        </span>
                        {b.erros.length > 0 && (
                          <span style={{ color: 'var(--t-error)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={12} /> {b.erros.length} erro(s)
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ══ WHATSAPP DA EMPRESA (só gestão) ═══════════════ */}
          {gestaoWpp && (
            <div style={cardStyle}>
              <div style={sectionHeader}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={16} color="#16a34a" />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>WhatsApp da empresa</h2>
                  <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Um número para o CRM todo. Conversas novas entram em &quot;Sem dono&quot; e o vendedor assume.</p>
                </div>
              </div>

              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {wppLoading ? (
                  <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Carregando...</p>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, fontWeight: 600, fontSize: 12,
                      background: wppEmpresa?.conectado ? '#dcfce7' : wppEmpresa?.configurado ? '#fef9c3' : 'var(--t-content-bg)',
                      color: wppEmpresa?.conectado ? '#15803d' : wppEmpresa?.configurado ? '#a16207' : 'var(--t-text-muted)',
                      border: '1px solid var(--t-card-border)',
                    }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: wppEmpresa?.conectado ? '#16a34a' : wppEmpresa?.configurado ? '#eab308' : '#9ca3af' }} />
                      {wppEmpresa?.conectado ? 'Conectado' : wppEmpresa?.configurado ? (wppEmpresa.status === 'CONECTANDO' ? 'Conectando' : 'Desconectado') : 'Não configurado'}
                    </span>
                    {wppEmpresa?.numero && (
                      <span style={{ color: 'var(--t-text-primary)', fontWeight: 600 }}>Número: {wppEmpresa.numero}</span>
                    )}
                  </div>
                )}

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-muted)', display: 'block', marginBottom: 4 }}>
                    Token da instância (UAZAPI)
                    <span style={{ fontSize: 10, color: '#16a34a', marginLeft: 6 }}>→ painel da UAZAPI &gt; instância &gt; token</span>
                  </label>
                  <input
                    type="password"
                    autoComplete="off"
                    value={wppToken}
                    onChange={e => setWppToken(e.target.value)}
                    placeholder={wppEmpresa?.configurado ? 'Token já salvo — cole um novo para trocar' : 'Cole aqui o token da instância'}
                    className="ps-input w-full"
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                </div>

                {wppErro && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 8,
                    background: 'var(--t-error-bg)', border: '1px solid var(--t-error-border)',
                    fontSize: 12, color: 'var(--t-error)', display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <AlertTriangle size={13} /> {wppErro}
                  </div>
                )}

                <div style={{ background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)', borderRadius: 8, padding: '10px 14px', fontSize: 11 }}>
                  <p style={{ fontWeight: 700, color: 'var(--t-text-primary)', marginBottom: 4 }}>Endereço do webhook</p>
                  {wppEmpresa?.webhook_url ? (
                    <p style={{ fontFamily: 'monospace', color: 'var(--t-text-primary)', wordBreak: 'break-all' }}>{wppEmpresa.webhook_url}</p>
                  ) : (
                    <p style={{ color: 'var(--t-error)' }}>EVOLUTION_WEBHOOK_URL não está configurada no servidor.</p>
                  )}
                  <p style={{ color: 'var(--t-text-muted)', marginTop: 4 }}>
                    Ao salvar, o CRM registra este endereço na instância automaticamente (mensagens e conexão).
                  </p>
                </div>

                <button
                  onClick={handleSalvarWppEmpresa}
                  disabled={wppSalvando}
                  className="flex items-center gap-2"
                  style={{
                    alignSelf: 'flex-start',
                    padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: wppOk ? '#15803d' : '#16a34a',
                    color: '#fff', border: 'none', cursor: wppSalvando ? 'not-allowed' : 'pointer',
                    opacity: wppSalvando ? 0.7 : 1, transition: 'background 0.2s',
                  }}>
                  {wppOk ? <><Check size={13} /> Token salvo!</> : <><Save size={13} /> {wppSalvando ? 'Validando...' : 'Salvar token'}</>}
                </button>
              </div>
            </div>
          )}

          {/* ══ TRIAGEM AUTOMÁTICA (só gestão) ════════════════ */}
          {gestaoWpp && (
            <div style={cardStyle}>
              <div style={sectionHeader}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquare size={16} color="#7c3aed" />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>Triagem automática</h2>
                  <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Todo número novo que escrever para o WhatsApp da empresa recebe o menu (Quero conhecer, Serviços, Suporte, Financeiro).</p>
                </div>
              </div>

              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--t-text-primary)' }}>
                    Triagem automática ligada
                  </label>
                  <button
                    onClick={() => setTriagem(t => ({ ...t, ativa: !t.ativa }))}
                    style={{
                      position: 'relative', width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                      border: 'none', cursor: 'pointer',
                      background: triagem.ativa ? 'var(--t-primary)' : 'var(--t-card-border)',
                      transition: 'background 0.2s'
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3,
                      width: 18, height: 18, background: '#fff', borderRadius: '50%',
                      left: triagem.ativa ? 23 : 3, transition: 'left 0.2s'
                    }} />
                  </button>
                </div>

                {(['farmacia', 'padaria'] as const).map(segmento => {
                  const m = triagem.material[segmento];
                  return (
                    <div key={segmento} style={{ border: '1px solid var(--t-card-border)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {segmento === 'farmacia' ? 'Farmácia' : 'Padaria'}
                      </p>

                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-muted)', display: 'block', marginBottom: 4 }}>
                          Texto (pode ter links)
                        </label>
                        <textarea
                          value={m.texto}
                          onChange={e => setTriagem(t => ({ ...t, material: { ...t.material, [segmento]: { ...t.material[segmento], texto: e.target.value } } }))}
                          rows={4}
                          className="ps-input w-full"
                          style={{ fontSize: 13, resize: 'vertical' as const }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-muted)', display: 'block', marginBottom: 4 }}>
                          Imagem
                        </label>
                        {m.imagem ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <img src={m.imagem} alt="Miniatura" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--t-card-border)' }} />
                            <button
                              onClick={() => setTriagem(t => ({ ...t, material: { ...t.material, [segmento]: { ...t.material[segmento], imagem: null } } }))}
                              style={{ fontSize: 12, color: 'var(--t-error)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                            >
                              Remover
                            </button>
                          </div>
                        ) : (
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => handleTriagemImagem(segmento, e.target.files?.[0] || null)}
                            style={{ fontSize: 12 }}
                          />
                        )}
                      </div>

                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-muted)', display: 'block', marginBottom: 4 }}>
                          PDF
                        </label>
                        {m.pdf ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 12, color: 'var(--t-text-primary)' }}>{m.pdf_nome || 'arquivo.pdf'}</span>
                            <button
                              onClick={() => setTriagem(t => ({ ...t, material: { ...t.material, [segmento]: { ...t.material[segmento], pdf: null, pdf_nome: null } } }))}
                              style={{ fontSize: 12, color: 'var(--t-error)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                            >
                              Remover
                            </button>
                          </div>
                        ) : (
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={e => handleTriagemPdf(segmento, e.target.files?.[0] || null)}
                            style={{ fontSize: 12 }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}

                {triagemMsg && (
                  <div style={{
                    padding: '10px 14px', borderRadius: 8,
                    background: triagemMsg.ok ? '#dcfce7' : 'var(--t-error-bg)',
                    border: `1px solid ${triagemMsg.ok ? '#16a34a' : 'var(--t-error-border)'}`,
                    fontSize: 12, color: triagemMsg.ok ? '#15803d' : 'var(--t-error)',
                    display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    {triagemMsg.ok ? <Check size={13} /> : <AlertTriangle size={13} />} {triagemMsg.texto}
                  </div>
                )}

                <button
                  onClick={handleSalvarTriagem}
                  disabled={triagemSalvando}
                  className="flex items-center gap-2"
                  style={{
                    alignSelf: 'flex-start',
                    padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: '#7c3aed',
                    color: '#fff', border: 'none', cursor: triagemSalvando ? 'not-allowed' : 'pointer',
                    opacity: triagemSalvando ? 0.7 : 1, transition: 'background 0.2s',
                  }}>
                  <Save size={13} /> {triagemSalvando ? 'Salvando...' : 'Salvar triagem'}
                </button>
              </div>
            </div>
          )}

          {/* ══ CONFIG SECTIONS ════════════════════════════════ */}
          {SECOES.map(secao => {
            const Icon = secao.icon;
            return (
              <div key={secao.id} style={cardStyle}>
                <div style={sectionHeader}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'var(--t-primary-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Icon size={16} color="var(--t-primary)" />
                  </div>
                  <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>{secao.label}</h2>
                </div>
                <div>
                  {secao.campos.map((campo, idx) => (
                    <div
                      key={campo.key}
                      style={{
                        padding: '14px 20px',
                        borderTop: idx > 0 ? '1px solid var(--t-card-border)' : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                        opacity: campo.tipo !== 'info' && !isCEO ? 0.6 : 1
                      }}
                    >
                      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--t-text-primary)', flex: 1 }}>
                        {campo.label}
                      </label>

                      {campo.tipo === 'info' && (
                        <p style={{ fontSize: 12, color: 'var(--t-text-muted)', textAlign: 'right' as const, maxWidth: 320 }}>
                          {campo.valor}
                        </p>
                      )}

                      {campo.tipo === 'number' && (
                        <input
                          type="number"
                          value={valores[campo.key] || campo.valor}
                          onChange={e => setValores(p => ({ ...p, [campo.key]: e.target.value }))}
                          disabled={!isCEO}
                          style={inputStyle}
                        />
                      )}

                      {campo.tipo === 'toggle' && (
                        <button
                          onClick={() => isCEO && setValores(p => ({ ...p, [campo.key]: p[campo.key] === 'true' ? 'false' : 'true' }))}
                          disabled={!isCEO}
                          style={{
                            position: 'relative', width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                            border: 'none', cursor: isCEO ? 'pointer' : 'default',
                            background: valores[campo.key] !== 'false' ? 'var(--t-primary)' : 'var(--t-card-border)',
                            transition: 'background 0.2s'
                          }}
                        >
                          <span style={{
                            position: 'absolute', top: 3,
                            width: 18, height: 18, background: '#fff', borderRadius: '50%',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                            transform: `translateX(${valores[campo.key] !== 'false' ? '23px' : '3px'})`,
                            transition: 'transform 0.2s'
                          }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* ══ ZAPSIGN — INTEGRAÇÃO ══════════════════════════ */}
          <div style={cardStyle}>
            <div style={sectionHeader}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={16} color="#7c3aed" />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>ZapSign — Assinatura Eletrônica</h2>
                <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Configure a integração para envio automático de contratos</p>
              </div>
              <a href="https://app.zapsign.com.br/conta/integracoes" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                Acessar ZapSign <ExternalLink size={10} />
              </a>
            </div>

            <div style={{ padding: 20 }}>
              {zapLoading ? (
                <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>Carregando configurações...</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Token + Ambiente */}
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-muted)', display: 'block', marginBottom: 4 }}>
                        API Token ZapSign
                        <span style={{ fontSize: 10, color: '#7c3aed', marginLeft: 6 }}>→ Conta &gt; Configurações &gt; Integrações &gt; API ZAPSIGN</span>
                      </label>
                      <input
                        type="password"
                        value={zapConfig.ZAPSIGN_API_TOKEN}
                        onChange={e => setZapConfig(p => ({ ...p, ZAPSIGN_API_TOKEN: e.target.value }))}
                        placeholder="bed57172-05f3-46da-..."
                        className="ps-input w-full"
                        style={{ fontFamily: 'monospace', fontSize: 12 }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-muted)', display: 'block', marginBottom: 4 }}>Ambiente</label>
                        <select
                          value={zapConfig.ZAPSIGN_ENVIRONMENT}
                          onChange={e => setZapConfig(p => ({ ...p, ZAPSIGN_ENVIRONMENT: e.target.value }))}
                          className="ps-input w-full"
                        >
                          <option value="sandbox">Sandbox (testes)</option>
                          <option value="production">Produção</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-muted)', display: 'block', marginBottom: 4 }}>Webhook Secret (opcional)</label>
                        <input
                          value={zapConfig.ZAPSIGN_WEBHOOK_SECRET}
                          onChange={e => setZapConfig(p => ({ ...p, ZAPSIGN_WEBHOOK_SECRET: e.target.value }))}
                          placeholder="chave para validar webhooks"
                          className="ps-input w-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Templates por plano */}
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                      Modelos de Contrato por Plano
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 12 }}>
                      Cole o <strong>Token do Modelo</strong> obtido em ZapSign &gt; Modelos &gt; Gerenciar (código na URL do modelo).
                      Esses modelos são usados para gerar e enviar contratos automaticamente quando uma proposta é aceita.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        ['ZAPSIGN_TEMPLATE_PRO',         'Plano Pro'],
                        ['ZAPSIGN_TEMPLATE_PLUS',        'Plano Plus'],
                        ['ZAPSIGN_TEMPLATE_FARMA_PRO',   'Farma Pro'],
                        ['ZAPSIGN_TEMPLATE_FARMA_PLUS',  'Farma Plus'],
                        ['ZAPSIGN_TEMPLATE_PADARIA_PRO',  'Padaria Pro'],
                        ['ZAPSIGN_TEMPLATE_PADARIA_PLUS', 'Padaria Plus'],
                      ] as [string, string][]).map(([key, label]) => (
                        <div key={key}>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
                          <input
                            value={(zapConfig as any)[key]}
                            onChange={e => setZapConfig(p => ({ ...p, [key]: e.target.value }))}
                            placeholder="token-modelo-zapsign"
                            className="ps-input w-full"
                            style={{ fontFamily: 'monospace', fontSize: 11 }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* URL do webhook */}
                  <div style={{ background: '#f5f3ff', borderRadius: 8, padding: '10px 14px', fontSize: 11 }}>
                    <p style={{ fontWeight: 700, color: '#7c3aed', marginBottom: 4 }}>URL do Webhook ZapSign</p>
                    <p style={{ fontFamily: 'monospace', color: '#4c1d95', background: '#ede9fe', padding: '4px 8px', borderRadius: 5, display: 'inline-block' }}>
                      {typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001/webhook/zapsign` : 'http://localhost:3001/webhook/zapsign'}
                    </p>
                    <p style={{ color: '#7c3aed', marginTop: 4 }}>Configure essa URL em: ZapSign &gt; Configurações &gt; Webhooks &gt; URL de Notificação</p>
                  </div>

                  <button
                    onClick={handleSaveZap}
                    disabled={zapSaving}
                    className="flex items-center gap-2"
                    style={{
                      alignSelf: 'flex-start',
                      padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                      background: zapSaved ? '#16a34a' : '#7c3aed',
                      color: '#fff', border: 'none', cursor: zapSaving ? 'not-allowed' : 'pointer',
                      opacity: zapSaving ? 0.7 : 1, transition: 'background 0.2s',
                    }}>
                    {zapSaved ? <><Check size={13} /> Configurações salvas!</> : <><Save size={13} /> {zapSaving ? 'Salvando...' : 'Salvar configurações ZapSign'}</>}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ══ INFO DO SISTEMA ════════════════════════════════ */}
          <div style={{ ...cardStyle, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Info size={14} color="var(--t-text-muted)" />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Informações do Sistema
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
              {[
                { label: 'Versão', value: '2.0.0' },
                { label: 'Backend', value: 'Fastify + Prisma' },
                { label: 'Banco', value: 'PostgreSQL 16' },
                { label: 'Frontend', value: 'Next.js 14' },
                { label: 'Empresa', value: 'ProSystem™' },
                { label: 'Desde', value: '2008' },
              ].map(i => (
                <div key={i.label}>
                  <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 2 }}>{i.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>{i.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
