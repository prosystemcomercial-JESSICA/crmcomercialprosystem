'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Save, FileText, Loader2 } from 'lucide-react';

type Props = {
  atividadeId: string;
  transcricaoInicial?: string;
  origemInicial?: 'AUTOMATICA' | 'MANUAL' | null;
  onSalvar: (texto: string, origem: 'AUTOMATICA' | 'MANUAL') => Promise<void>;
};

export function TranscricaoReuniao({ atividadeId, transcricaoInicial = '', origemInicial, onSalvar }: Props) {
  const [texto, setTexto] = useState(transcricaoInicial);
  const [gravando, setGravando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvo, setSalvo] = useState(false);
  const recognitionRef = useRef<any>(null);
  const textoAcumuladoRef = useRef(transcricaoInicial);

  useEffect(() => {
    textoAcumuladoRef.current = texto;
  }, [texto]);

  const browserSuportaSpeech = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const iniciarGravacao = () => {
    setErro('');
    const SpeechRecognition: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErro('Seu navegador não suporta transcrição automática. Use Chrome ou Edge, ou cole manualmente.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.lang = 'pt-BR';
    rec.continuous = true;
    rec.interimResults = true;

    let baseTexto = textoAcumuladoRef.current;

    rec.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript + ' ';
        else interim += res[0].transcript;
      }
      if (final) {
        baseTexto = (baseTexto + ' ' + final).trim();
        setTexto(baseTexto);
      }
    };

    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setErro('Erro: ' + e.error);
        setGravando(false);
      }
    };

    rec.onend = () => {
      // Reinicia se ainda estiver gravando (Speech API tem timeouts curtos)
      if (gravando && recognitionRef.current === rec) {
        try { rec.start(); } catch { /* já reiniciado */ }
      }
    };

    try {
      rec.start();
      recognitionRef.current = rec;
      setGravando(true);
    } catch (e: any) {
      setErro('Falha ao iniciar microfone: ' + (e.message || 'permissão negada'));
    }
  };

  const pararGravacao = () => {
    setGravando(false);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
  };

  const salvar = async (origem: 'AUTOMATICA' | 'MANUAL') => {
    if (!texto.trim()) return;
    setSalvando(true);
    try {
      await onSalvar(texto, origem);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    } catch (e: any) {
      setErro('Erro ao salvar: ' + (e?.message || 'desconhecido'));
    }
    setSalvando(false);
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #C3DCFC', borderRadius: 10, padding: 14, marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={14} color="#4B8EC8" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#4B8EC8' }}>Transcrição da reunião</span>
          {origemInicial && (
            <span style={{ fontSize: 10, padding: '2px 7px', background: '#EBF4FF', color: '#4B8EC8', borderRadius: 20, fontWeight: 600 }}>
              {origemInicial === 'AUTOMATICA' ? 'Automática' : 'Manual'}
            </span>
          )}
        </div>
        {browserSuportaSpeech && (
          gravando ? (
            <button onClick={pararGravacao}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: '#fee2e2', color: '#dc2626', border: '1.5px solid #fca5a5', cursor: 'pointer'
              }}>
              <MicOff size={12} /> Parar gravação
            </button>
          ) : (
            <button onClick={iniciarGravacao}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: '#dcfce7', color: '#16a34a', border: '1.5px solid #86efac', cursor: 'pointer'
              }}>
              <Mic size={12} /> Iniciar transcrição
            </button>
          )
        )}
      </div>

      {gravando && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fef3c7', borderRadius: 8, marginBottom: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: 50, background: '#dc2626', animation: 'pulse 1s infinite' }} />
          <span style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>Gravando — autorize o microfone se solicitado</span>
        </div>
      )}

      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        placeholder="Cole aqui a transcrição do Google Meet (legendas CC) ou clique em 'Iniciar transcrição' para gravar pela voz..."
        rows={6}
        style={{
          width: '100%', padding: 10, fontSize: 13, lineHeight: 1.5,
          borderRadius: 8, border: '1px solid #C3DCFC', resize: 'vertical', fontFamily: 'inherit'
        }}
      />

      {erro && (
        <div style={{ fontSize: 11, color: '#dc2626', padding: '6px 10px', background: '#fef2f2', borderRadius: 6, marginTop: 8 }}>
          ⚠️ {erro}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <div style={{ fontSize: 11, color: '#7AAACB' }}>
          {texto.length} caracteres · {texto.split(/\s+/).filter(Boolean).length} palavras
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => salvar('MANUAL')} disabled={salvando || !texto.trim()}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: salvo ? '#dcfce7' : 'linear-gradient(135deg, #4B8EC8, #2E6EAB)',
              color: salvo ? '#16a34a' : '#fff', border: 'none', cursor: salvando ? 'wait' : 'pointer',
              opacity: !texto.trim() ? 0.5 : 1
            }}>
            {salvando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {salvo ? 'Salvo!' : 'Salvar na ficha do lead'}
          </button>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
    </div>
  );
}
