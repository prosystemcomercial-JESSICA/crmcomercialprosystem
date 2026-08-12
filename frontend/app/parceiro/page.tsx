'use client';

import { useState } from 'react';
import axios from 'axios';
import { CheckCircle2, Loader2, Handshake, ChevronLeft, ChevronRight, Globe, Camera, BookOpen } from 'lucide-react';
import { FormState, FORM_INICIAL, paraPayload, Passo1, Passo2, Passo3, Passo4, Passo5, Passo6, Passo7, Passo8, Passo9, Passo10 } from './steps';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const PERFIS = [
  { valor: 'INDICADOR', titulo: 'Indicador', descricao: 'Apenas faz a indicação dos produtos e recebe um valor correspondente à instalação.', percentual: '30% referente ao valor da instalação' },
  { valor: 'REPRESENTANTE', titulo: 'Representante', descricao: 'Faz a prospecção de novos clientes e a instalação presencialmente do software.', percentual: '50% referente ao valor da instalação' },
  { valor: 'FRANQUEADO', titulo: 'Franqueado', descricao: 'Responsável por fazer prospecção, instalação, treinamento e suporte técnico.', percentual: '50% da instalação + 50% da mensalidade' },
];

const BENEFICIOS = [
  'Direito de uso da marca e venda dos produtos Prosystem Sistemas',
  'Treinamento inicial e contínuo',
  'Know how e estrutura da empresa',
  'Respaldo de uma empresa estruturada e com visão de mercado',
  'Acesso a toda tecnologia emergente de automação comercial (ECF, NF-e, NFC-e, PAF-ECF etc.)',
  'Facilidade para a prestação de suporte técnico',
];

const TITULOS_PASSOS = [
  'Dados do representante', 'Estrutura da empresa', 'Estrutura comercial',
  'Instalação, implantação e treinamento', 'Suporte ao cliente', 'Região de atuação',
  'Experiência no mercado', 'Marcas que representa', 'Capacidade de atendimento',
  'Apresentação da operação',
];

export default function ParceiroPage() {
  const [passo, setPasso] = useState(0);
  const [form, setForm] = useState<FormState>(FORM_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  function set<K extends keyof FormState>(campo: K, valor: FormState[K]) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  const podeAvancarPasso1 = form.nome.trim() && form.telefone.trim() && form.email.trim();

  function avancar() {
    if (passo === 0 && !podeAvancarPasso1) {
      setErro('Preencha nome, telefone e e-mail para continuar.');
      return;
    }
    setErro('');
    setPasso(p => Math.min(p + 1, TITULOS_PASSOS.length - 1));
  }

  function voltar() {
    setErro('');
    setPasso(p => Math.max(p - 1, 0));
  }

  async function enviar() {
    if (!form.perfil_desejado) {
      setErro('Selecione o perfil desejado antes de enviar.');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      await axios.post(`${API_URL}/candidatos-representante`, paraPayload(form));
      setEnviado(true);
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Não foi possível enviar sua candidatura. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div style={{ minHeight: '100vh', background: '#F4F7FB', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 48, maxWidth: 480, textAlign: 'center', boxShadow: '0 4px 24px rgba(13,34,56,0.10)' }}>
          <CheckCircle2 size={48} color="#2E6EAB" style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0D2238', marginBottom: 8 }}>Candidatura recebida!</h1>
          <p style={{ fontSize: 14, color: '#4A6E8A', marginBottom: 28 }}>Obrigado pelo interesse em ser parceiro Prosystem. Nossa equipe vai analisar seus dados e entrar em contato em breve.</p>

          <div style={{ borderTop: '1px solid #E2ECF5', paddingTop: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#2E6EAB', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
              Enquanto isso, conheça nossa empresa
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
              <a
                href="https://prosystemnet.com/home/"
                target="_blank"
                rel="noopener noreferrer"
                title="Site institucional"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textDecoration: 'none', width: 88, padding: '12px 8px', borderRadius: 12, border: '1px solid #E2ECF5' }}
              >
                <Globe size={20} color="#2E6EAB" />
                <span style={{ fontSize: 11, color: '#4A6E8A', textAlign: 'center' }}>Site</span>
              </a>
              <a
                href="https://www.instagram.com/prosystemoficial/"
                target="_blank"
                rel="noopener noreferrer"
                title="Instagram"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textDecoration: 'none', width: 88, padding: '12px 8px', borderRadius: 12, border: '1px solid #E2ECF5' }}
              >
                <Camera size={20} color="#2E6EAB" />
                <span style={{ fontSize: 11, color: '#4A6E8A', textAlign: 'center' }}>Instagram</span>
              </a>
              <a
                href="https://universidade-prosytem-production.up.railway.app/base-conhecimento"
                target="_blank"
                rel="noopener noreferrer"
                title="Ferramentas disponíveis no sistema"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textDecoration: 'none', width: 88, padding: '12px 8px', borderRadius: 12, border: '1px solid #E2ECF5' }}
              >
                <BookOpen size={20} color="#2E6EAB" />
                <span style={{ fontSize: 11, color: '#4A6E8A', textAlign: 'center' }}>Ferramentas</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FB', fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <div style={{ background: 'linear-gradient(135deg,#0D2238 0%,#1A4E82 60%,#2E6EAB 100%)', padding: '56px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
            Pro<span style={{ color: '#90BEF0' }}>System</span>
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginTop: 16, marginBottom: 12 }}>
            Venha ser parceiro da Prosystem Desenvolvimento de Sistemas
          </h1>
          <p style={{ fontSize: 14, color: '#B8D4EF', lineHeight: 1.6 }}>
            Representação Comercial &amp; Outsourcing — a Prosystem atua no mercado com fornecimento de software de
            automação comercial para diversos segmentos: drogarias, farmácias de manipulação, lojas, oficinas e
            comércio em geral. Estamos buscando novas parcerias para ampliar nosso grupo.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, marginBottom: 24, boxShadow: '0 1px 3px rgba(13,34,56,0.05)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0D2238', marginBottom: 16 }}>O que você ganha como parceiro</h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {BENEFICIOS.map(b => (
              <li key={b} style={{ fontSize: 14, color: '#4A6E8A', marginBottom: 8, lineHeight: 1.5 }}>{b}</li>
            ))}
          </ul>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 32, marginBottom: 24, boxShadow: '0 1px 3px rgba(13,34,56,0.05)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0D2238', marginBottom: 16 }}>Perfis de parceria</h2>
          <div style={{ display: 'grid', gap: 16 }}>
            {PERFIS.map(p => (
              <div key={p.valor} style={{ border: '1px solid #E2ECF5', borderRadius: 12, padding: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#2E6EAB', marginBottom: 4 }}>{p.titulo}</p>
                <p style={{ fontSize: 13, color: '#4A6E8A', marginBottom: 6, lineHeight: 1.5 }}>{p.descricao}</p>
                <p style={{ fontSize: 12, color: '#0D2238', fontWeight: 600 }}>{p.percentual}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: '0 1px 3px rgba(13,34,56,0.05)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0D2238', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Handshake size={18} color="#2E6EAB" /> Ficha de Cadastro e Qualificação
          </h2>
          <p style={{ fontSize: 12, color: '#4A6E8A', marginBottom: 4 }}>
            Etapa {passo + 1} de {TITULOS_PASSOS.length} — {TITULOS_PASSOS[passo]}
          </p>
          <div style={{ height: 6, background: '#E2ECF5', borderRadius: 3, marginBottom: 24, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${((passo + 1) / TITULOS_PASSOS.length) * 100}%`, background: '#2E6EAB', transition: 'width 0.2s' }} />
          </div>

          {passo === 0 && <Passo1 f={form} set={set} />}
          {passo === 1 && <Passo2 f={form} set={set} />}
          {passo === 2 && <Passo3 f={form} set={set} />}
          {passo === 3 && <Passo4 f={form} set={set} />}
          {passo === 4 && <Passo5 f={form} set={set} />}
          {passo === 5 && <Passo6 f={form} set={set} />}
          {passo === 6 && <Passo7 f={form} set={set} />}
          {passo === 7 && <Passo8 f={form} set={set} />}
          {passo === 8 && <Passo9 f={form} set={set} />}
          {passo === 9 && <Passo10 f={form} set={set} />}

          {erro && <p style={{ fontSize: 13, color: '#DC2626', marginTop: 16 }}>{erro}</p>}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button
              onClick={voltar}
              disabled={passo === 0}
              style={{ background: 'transparent', color: '#2E6EAB', border: '1px solid #2E6EAB', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: passo === 0 ? 'default' : 'pointer', opacity: passo === 0 ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <ChevronLeft size={16} /> Voltar
            </button>
            {passo < TITULOS_PASSOS.length - 1 ? (
              <button
                onClick={avancar}
                style={{ background: '#2E6EAB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                Avançar <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={enviar}
                disabled={enviando}
                style={{ background: '#2E6EAB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: enviando ? 'default' : 'pointer', opacity: enviando ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {enviando ? <Loader2 size={16} className="animate-spin" /> : null}
                {enviando ? 'Enviando...' : 'Enviar candidatura'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
