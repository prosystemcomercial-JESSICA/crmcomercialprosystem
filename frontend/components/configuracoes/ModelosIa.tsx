'use client';

import { useEffect, useState } from 'react';
import { Cpu, RotateCcw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

// Configurações › Modelos de IA (pedido da Jessica, 29/10/2026): para cada assistente, o modelo principal e
// a reserva (usada quando o principal falha). "Automático" = a ordem padrão do CRM: Groq grátis primeiro,
// depois as pagas. Só a gestão vê.

type Modelo = { id: string; nome: string; gratis: boolean; imagem: boolean; busca: boolean; tem_chave: boolean };
type Funcao = { id: string; nome: string; descricao: string; grupo: string; principal: string; reserva: string };

const card: React.CSSProperties = { background: 'var(--t-card-bg)', border: '1px solid var(--t-card-border)', borderRadius: 12, overflow: 'hidden' };
const select: React.CSSProperties = { width: '100%', padding: '7px 8px', borderRadius: 8, border: '1px solid var(--t-card-border)', background: 'var(--t-card-bg)', color: 'var(--t-text-primary)', fontSize: 12 };

const rotulo = (m: Modelo) => `${m.nome}${m.gratis ? ' (grátis)' : ''}${m.tem_chave ? '' : ' (sem chave)'}`;

export default function ModelosIa() {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [funcoes, setFuncoes] = useState<Funcao[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const aplicar = (d: { modelos: Modelo[]; funcoes: Funcao[] }) => { setModelos(d.modelos); setFuncoes(d.funcoes); };
  useEffect(() => {
    apiClient.getIaModelos().then(r => aplicar(r.data.data)).catch(() => setMsg({ ok: false, texto: 'Não foi possível carregar os modelos.' }));
  }, []);

  if (!funcoes) return msg ? <div style={{ ...card, padding: 16, fontSize: 12, color: '#dc2626' }}>{msg.texto}</div> : null;

  const mudar = (id: string, campo: 'principal' | 'reserva', valor: string) => setFuncoes(fs => fs && fs.map(f => (f.id === id ? { ...f, [campo]: valor } : f)));
  const salvar = async () => {
    setSalvando(true); setMsg(null);
    try {
      const rotas = Object.fromEntries(funcoes.map(f => [f.id, { principal: f.principal, reserva: f.reserva }]));
      aplicar((await apiClient.salvarIaModelos(rotas)).data.data);
      setMsg({ ok: true, texto: 'Salvo. Já vale para os próximos pedidos.' });
    } catch (e: any) {
      setMsg({ ok: false, texto: e?.response?.data?.message || 'Não foi possível salvar.' });
    } finally { setSalvando(false); }
  };

  const grupos = [...new Set(funcoes.map(f => f.grupo))];
  const opcoes = (incluirNenhuma: boolean) => (
    <>
      <option value="auto">Automático (grátis primeiro)</option>
      {modelos.map(m => <option key={m.id} value={m.id} disabled={!m.tem_chave}>{rotulo(m)}</option>)}
      {incluirNenhuma && <option value="nenhuma">Sem reserva</option>}
    </>
  );

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--t-card-border)' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Cpu size={16} color="#4338ca" />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text-primary)' }}>Modelos de IA</h2>
          <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
            Escolha a IA de cada assistente e a reserva, usada quando a principal falha. <b>Automático</b> tenta primeiro o Groq (grátis) e só usa a paga quando ele não dá conta.
          </p>
        </div>
      </div>
      <div style={{ padding: '8px 20px 20px', display: 'grid', gap: 18 }}>
        {grupos.map(g => (
          <section key={g}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--t-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '10px 0 4px' }}>{g}</h3>
            {funcoes.filter(f => f.grupo === g).map(f => {
              const mudou = f.principal !== 'auto' || f.reserva !== 'auto';
              return (
                <div key={f.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr) 28px', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--t-card-border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text-primary)' }}>{f.nome}</div>
                    <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{f.descricao}</div>
                  </div>
                  <select aria-label={`Modelo principal: ${f.nome}`} style={select} value={f.principal} onChange={e => mudar(f.id, 'principal', e.target.value)}>{opcoes(false)}</select>
                  <select aria-label={`Reserva: ${f.nome}`} style={select} value={f.reserva} onChange={e => mudar(f.id, 'reserva', e.target.value)}>{opcoes(true)}</select>
                  <button type="button" title="Voltar ao automático" aria-label={`Voltar ${f.nome} ao automático`} disabled={!mudou}
                    onClick={() => { mudar(f.id, 'principal', 'auto'); mudar(f.id, 'reserva', 'auto'); }}
                    style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', cursor: mudou ? 'pointer' : 'default', opacity: mudou ? 1 : 0.3, color: 'var(--t-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RotateCcw size={14} />
                  </button>
                </div>
              );
            })}
          </section>
        ))}
        <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
          Os modelos do Groq não leem imagem nem PDF e não pesquisam na internet: nesses pedidos o CRM pula para o próximo que consegue. Os grátis têm limite por dia; o Gemini grátis pode usar o que recebe para treinar os modelos do Google. Uso e falhas de cada um aparecem em Desempenho do setor.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={salvar} disabled={salvando}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--t-primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer', opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Salvando…' : 'Salvar modelos'}
          </button>
          {msg && <span style={{ fontSize: 12, color: msg.ok ? '#15803d' : '#dc2626' }}>{msg.texto}</span>}
        </div>
      </div>
    </div>
  );
}
