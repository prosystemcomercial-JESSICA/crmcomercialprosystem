'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { apiClient } from '@/lib/api-client';

interface Atividade {
  id: string;
  titulo: string;
  tipo: string;
  status: string;
  data_prevista?: string;
  data_realizada?: string;
  lead_id?: string;
  lead?: { id: string; nome: string; empresa?: string };
  resultado?: string;
  descricao?: string;
}

const TIPO_ICON: Record<string, string> = {
  LIGACAO: '📞', EMAIL: '📧', REUNIAO: '📅', WHATSAPP: '💬', VISITA: '🏢', TAREFA: '✅',
};

const TIPO_COLOR: Record<string, string> = {
  LIGACAO: 'bg-blue-50 border-blue-200 text-blue-700',
  EMAIL: 'bg-purple-50 border-purple-200 text-purple-700',
  REUNIAO: 'bg-green-50 border-green-200 text-green-700',
  WHATSAPP: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  VISITA: 'bg-orange-50 border-orange-200 text-orange-700',
  TAREFA: 'bg-gray-50 border-gray-200 text-gray-700',
};

function getWeekDays(baseDate: Date) {
  const days: Date[] = [];
  const monday = new Date(baseDate);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function AgendaPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [baseDate, setBaseDate] = useState(new Date());
  const [view, setView] = useState<'semana' | 'lista'>('semana');
  const [modalCreate, setModalCreate] = useState(false);
  const [form, setForm] = useState({ titulo: '', tipo: 'LIGACAO', data_prevista: '', descricao: '', lead_id: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && !loading) router.push('/');
  }, [isAuthenticated, loading]);

  const loadAtividades = () => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    apiClient.getAtividades()
      .then(res => setAtividades(res.data.data || []))
      .catch(console.error)
      .finally(() => setDataLoading(false));
  };

  useEffect(() => { loadAtividades(); }, [isAuthenticated]);

  const handleConcluir = async (id: string) => {
    await apiClient.updateAtividade(id, { status: 'REALIZADA', data_realizada: new Date().toISOString() });
    loadAtividades();
  };

  const handleCreate = async () => {
    if (!form.titulo) return;
    setSaving(true);
    try {
      await apiClient.createAtividade({ ...form, tipo: form.tipo as any });
      setModalCreate(false);
      setForm({ titulo: '', tipo: 'LIGACAO', data_prevista: '', descricao: '', lead_id: '' });
      loadAtividades();
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  if (loading || !isAuthenticated) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>;
  }

  const weekDays = getWeekDays(baseDate);
  const hoje = new Date();

  const prevWeek = () => { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d); };
  const nextWeek = () => { const d = new Date(baseDate); d.setDate(d.getDate() + 7); setBaseDate(d); };

  const atividadesDoDia = (day: Date) =>
    atividades.filter(a => {
      const dt = a.data_prevista || a.data_realizada;
      if (!dt) return false;
      return sameDay(new Date(dt), day);
    });

  const pendentes = atividades.filter(a => a.status === 'PENDENTE').sort((x, y) =>
    new Date(x.data_prevista || 0).getTime() - new Date(y.data_prevista || 0).getTime()
  );

  const formatHora = (d?: string) => d ? new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  const formatDia = (d: Date) => d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Agenda Comercial</h1>
            <p className="text-gray-500 mt-1">Suas atividades organizadas por semana</p>
          </div>
          <button onClick={() => setModalCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors">
            + Nova Atividade
          </button>
        </div>

        {/* View toggle + navegação */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">‹</button>
            <button onClick={() => setBaseDate(new Date())} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Hoje</button>
            <button onClick={nextWeek} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">›</button>
            <span className="text-sm font-medium text-gray-700 ml-2">
              {weekDays[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — {weekDays[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['semana', 'lista'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors capitalize ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {dataLoading ? (
          <div className="text-center p-12 text-gray-500">Carregando agenda...</div>
        ) : view === 'semana' ? (
          /* SEMANA VIEW */
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map(day => {
              const isToday = sameDay(day, hoje);
              const atsDia = atividadesDoDia(day);
              return (
                <div key={day.toISOString()} className={`bg-white rounded-xl border ${isToday ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'} min-h-36 flex flex-col`}>
                  <div className={`p-2 rounded-t-xl text-center ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-50'}`}>
                    <p className="text-xs font-medium">{day.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase()}</p>
                    <p className={`text-lg font-bold ${isToday ? 'text-white' : 'text-gray-700'}`}>{day.getDate()}</p>
                  </div>
                  <div className="p-1.5 space-y-1 flex-1">
                    {atsDia.length === 0 ? (
                      <p className="text-xs text-gray-300 text-center mt-2">—</p>
                    ) : (
                      atsDia.map(at => (
                        <div key={at.id} className={`rounded p-1 border text-xs ${TIPO_COLOR[at.tipo] || 'bg-gray-50 border-gray-200 text-gray-600'} ${at.status === 'REALIZADA' ? 'opacity-50' : ''}`}>
                          <p className="font-medium truncate">{TIPO_ICON[at.tipo]} {at.titulo}</p>
                          {at.lead?.nome && <p className="truncate opacity-70">{at.lead.nome}</p>}
                          {at.data_prevista && <p className="opacity-60">{formatHora(at.data_prevista)}</p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LISTA VIEW */
          <div className="space-y-2">
            {pendentes.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <div className="text-4xl mb-3">📅</div>
                <p className="text-gray-500">Nenhuma atividade pendente</p>
              </div>
            ) : pendentes.map(at => {
              const atrasada = at.data_prevista && new Date(at.data_prevista) < hoje;
              return (
                <div key={at.id} className={`bg-white rounded-xl border ${atrasada ? 'border-red-200 bg-red-50' : 'border-gray-200'} p-4 flex items-center gap-4`}>
                  <span className="text-2xl">{TIPO_ICON[at.tipo] || '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{at.titulo}</p>
                    {at.lead?.nome && <p className="text-sm text-gray-500">{at.lead.nome}{at.lead.empresa ? ` · ${at.lead.empresa}` : ''}</p>}
                    {at.data_prevista && (
                      <p className={`text-xs mt-0.5 ${atrasada ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                        {atrasada ? '⏰ Atrasada · ' : ''}
                        {new Date(at.data_prevista).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <button onClick={() => handleConcluir(at.id)}
                    className="flex-shrink-0 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    ✓ Concluir
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal criar atividade */}
      {modalCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Nova Atividade</h2>
              <button onClick={() => setModalCreate(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Título *</label>
                <input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Descreva a atividade" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Tipo</label>
                <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {['LIGACAO', 'EMAIL', 'REUNIAO', 'WHATSAPP', 'VISITA', 'TAREFA'].map(t => (
                    <option key={t} value={t}>{TIPO_ICON[t]} {t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Data prevista</label>
                <input type="datetime-local" value={form.data_prevista} onChange={e => setForm(p => ({ ...p, data_prevista: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                  rows={2} className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Detalhes opcionais" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModalCreate(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={handleCreate} disabled={!form.titulo || saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? 'Salvando...' : 'Criar Atividade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
