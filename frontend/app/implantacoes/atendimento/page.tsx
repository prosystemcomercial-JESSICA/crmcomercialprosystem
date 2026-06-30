'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Headphones, Search, Copy, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

// ── VARIÁVEIS PADRÃO ─────────────────────────────────────────────
const VARIAVEIS = [
  { nome: '{{nome_cliente}}',    desc: 'Nome do cliente',                    ex: '"Maria", "Farmácia Central"' },
  { nome: '{{nome_agente}}',     desc: 'Nome do agente de suporte',          ex: '"Carlos", "Ana"' },
  { nome: '{{numero_chamado}}',  desc: 'Número do ticket/chamado',           ex: '"#18542"' },
  { nome: '{{problema}}',        desc: 'Descrição resumida do problema',     ex: '"PDV travado no caixa 2"' },
  { nome: '{{prazo}}',           desc: 'Prazo estimado de resolução',        ex: '"hoje às 18h", "em 30 minutos"' },
  { nome: '{{link}}',            desc: 'Link de artigo ou ação',             ex: '"ajuda.prosystem.com.br/..."' },
  { nome: '{{valor}}',           desc: 'Valor financeiro',                   ex: '"R$ 349,00"' },
  { nome: '{{funcionalidade}}',  desc: 'Nome de uma função do sistema',      ex: '"Relatório de Caixa", "NF-e"' },
  { nome: '{{acao_realizada}}',  desc: 'Ação técnica executada',             ex: '"Reiniciei o serviço de NF"' },
  { nome: '{{compensacao}}',     desc: 'Compensação/crédito oferecido',      ex: '"1 mês de crédito"' },
  { nome: '{{mes_referencia}}',  desc: 'Mês de referência da cobrança',      ex: '"junho/2026"' },
  { nome: '{{telefone_urgencia}}', desc: 'Telefone para urgências 24h',      ex: '"(11) 99999-0000"' },
];

// ── TEMPLATES ────────────────────────────────────────────────────
const TEMPLATES = [
  // PRIMEIRO CONTATO
  {
    id: 'FC-01', cat: 'primeiro-contato', catLabel: 'Primeiro Contato', severity: 'baixa',
    titulo: 'Saudação Inicial — Geral',
    cenario: 'Cliente entra em contato pela primeira vez sobre qualquer assunto',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! 👋 Aqui é o {{nome_agente}} da ProSystem.\n\nRecebi sua mensagem sobre {{problema}} e já estou verificando aqui pra você.\n\nPode me contar um pouco mais sobre o que está acontecendo? (O que aparece na tela, qual módulo está usando, etc.)`,
      email: `Assunto: Re: {{problema}} — Estamos verificando [#{{numero_chamado}}]\n\nOlá, {{nome_cliente}},\n\nRecebi sua solicitação sobre {{problema}} e já iniciei a verificação aqui.\n\nPara agilizar o atendimento, pode me informar:\n- Em qual módulo o problema está ocorrendo?\n- Aparece alguma mensagem de erro na tela?\n- Quando começou (hoje, após uma atualização, etc.)?\n\nSeu número de chamado é #{{numero_chamado}} — guarda para futuras referências.\n\nAbraços,\n{{nome_agente}}\nSuporte ProSystem`,
      telefone: `"ProSystem Sistemas, bom dia/tarde! Aqui é {{nome_agente}}. Com quem falo?\n\n[Aguarda] Olá, {{nome_cliente}}! Como posso te ajudar hoje?"`,
    },
  },
  {
    id: 'FC-02', cat: 'primeiro-contato', catLabel: 'Primeiro Contato', severity: 'alta',
    titulo: 'Primeiro Contato — Operação Parada (Urgente)',
    cenario: 'PDV travado, sistema fora do ar, caixa parado',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! Aqui é {{nome_agente}} da ProSystem — já recebi seu chamado.\n\nSei que com o sistema fora isso é urgente. Estou acessando sua máquina agora.\n\nEnquanto isso, você pode tentar fechar e abrir o ProSystem novamente? Me fala o que aparecer na tela.`,
      telefone: `"{{nome_cliente}}, entendi — operação parada é prioridade. Já estou no seu sistema. Me fala: o que está aparecendo na tela agora?"`,
    },
  },
  {
    id: 'FC-03', cat: 'primeiro-contato', catLabel: 'Primeiro Contato', severity: 'baixa',
    titulo: 'Cliente Retornando',
    cenario: 'Cliente que já teve atendimento anterior entra em contato novamente',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! 😊 Que bom falar contigo!\n\nVi aqui que da última vez você teve um problema com {{problema_anterior}}. Hoje é outra situação ou voltou o mesmo?\n\nMe conta o que está acontecendo que a gente resolve!`,
    },
  },
  {
    id: 'FC-04', cat: 'primeiro-contato', catLabel: 'Primeiro Contato', severity: 'baixa',
    titulo: 'Informação Incompleta',
    cenario: 'Cliente mandou mensagem vaga — precisa de mais detalhes',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! Aqui é {{nome_agente}} da ProSystem. 👋\n\nRecebi sua mensagem — pode me ajudar com mais alguns detalhes?\n\n1. Qual módulo você estava usando? (Caixa, Estoque, NF, outro?)\n2. Apareceu alguma mensagem de erro?\n3. Aconteceu depois de alguma atualização ou do nada?\n\nCom isso já consigo te ajudar muito mais rápido! 🙏`,
    },
  },
  {
    id: 'FC-05', cat: 'primeiro-contato', catLabel: 'Primeiro Contato', severity: 'baixa',
    titulo: 'Solicitação de Treinamento / Funcionalidade',
    cenario: 'Cliente quer aprender a usar uma função do sistema',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! Aqui é {{nome_agente}} da ProSystem.\n\nClaro, consigo te ajudar com isso! A função de {{funcionalidade}} fica em {{caminho_no_sistema}}.\n\nPrefere que eu te explique por aqui no passo a passo ou faço uma videochamada pra mostrar na tela?`,
    },
  },
  // INVESTIGAÇÃO
  {
    id: 'INV-01', cat: 'investigacao', catLabel: 'Investigação', severity: 'media',
    titulo: 'Atualização de Status — Ainda Investigando',
    cenario: 'Problema complexo; técnico ainda analisando',
    canais: {
      whatsapp: `Oi {{nome_cliente}}, atualização sobre seu chamado #{{numero_chamado}}:\n\nJá identifiquei onde está o problema com {{problema}}, mas ainda estou corrigindo aqui — não quero te passar solução pela metade.\n\nVolto com novidade até {{prazo}}. Se precisar de qualquer coisa antes disso, é só chamar!`,
      email: `Olá, {{nome_cliente}},\n\nAtualização sobre o chamado #{{numero_chamado}} — {{problema}}:\n\n**O que já fiz:**\n- {{acao_realizada}}\n- {{outro_achado}}\n\n**Próximo passo:**\n{{proxima_acao}} — previsão: {{prazo}}\n\nTe atualizo até lá, ou antes se resolver.\n\nAbraços,\n{{nome_agente}}`,
    },
  },
  {
    id: 'INV-02', cat: 'investigacao', catLabel: 'Investigação', severity: 'media',
    titulo: 'Solicitação de Informação Adicional',
    cenario: 'Precisa de mais dados do cliente para investigar',
    canais: {
      whatsapp: `{{nome_cliente}}, para resolver seu problema com {{problema}} preciso de mais duas informações:\n\n1. {{informacao_1}}\n2. {{informacao_2}}\n\nPode me mandar um print ou vídeo da tela? Vai agilizar muito! 📱`,
    },
  },
  {
    id: 'INV-03', cat: 'investigacao', catLabel: 'Investigação', severity: 'alta',
    titulo: 'Escalonamento para Técnico Especialista',
    cenario: 'Problema requer especialista de nível 2',
    canais: {
      whatsapp: `{{nome_cliente}}, o problema com {{problema}} é mais específico — preciso chamar nosso técnico especialista pra isso.\n\nJá passei todo o histórico pra ele, então você não vai precisar explicar de novo.\n\nEle entra em contato em até {{prazo}}. Seu chamado é #{{numero_chamado}}.`,
      email: `Olá, {{nome_cliente}},\n\nApós análise, o chamado #{{numero_chamado}} sobre {{problema}} requer nosso time técnico especializado.\n\n**O que acontece agora:**\n- Passei todo o contexto para {{nome_especialista}}, especialista em {{area}}\n- Ele entra em contato em até {{prazo}}\n- Você não precisará repetir as informações\n\nAbraços,\n{{nome_agente}}`,
    },
  },
  {
    id: 'INV-04', cat: 'investigacao', catLabel: 'Investigação', severity: 'baixa',
    titulo: 'Aguardando Resposta do Cliente',
    cenario: 'Cliente não respondeu ao pedido de informação',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! Tudo bem?\n\nSó passando pra lembrar que preciso das informações sobre {{problema}} para conseguir resolver pra você.\n\nQuando puder me mandar, a gente finaliza isso! 😊`,
    },
  },
  {
    id: 'INV-05', cat: 'investigacao', catLabel: 'Investigação', severity: 'alta',
    titulo: 'Dependência de Terceiro (SEFAZ, Operadora)',
    cenario: 'Resolução depende de sistema externo fora da governança ProSystem',
    canais: {
      whatsapp: `{{nome_cliente}}, identifiquei o problema com {{problema}}. A situação é que depende de normalização do sistema da {{terceiro}} — não está na nossa governança.\n\nEstou monitorando de hora em hora. Assim que normalizar, já aplico a correção aqui e te aviso.\n\nEnquanto isso: {{solucao_paliativa}}.`,
    },
  },
  {
    id: 'INV-06', cat: 'investigacao', catLabel: 'Investigação', severity: 'media',
    titulo: 'Solução Paliativa enquanto Investiga Fix',
    cenario: 'Fix definitivo demora; oferece workaround para continuar operando',
    canais: {
      whatsapp: `{{nome_cliente}}, enquanto finalizo a correção definitiva do {{problema}}, tem um jeito de contornar por agora:\n\n{{workaround}}\n\nIsso resolve pra você continuar operando. O fix definitivo fica pronto até {{prazo}} — te aviso assim que aplicar.\n\nFunciona assim por enquanto?`,
    },
  },
  // RESOLUÇÃO
  {
    id: 'RES-01', cat: 'resolucao', catLabel: 'Resolução', severity: 'baixa',
    titulo: 'Problema Resolvido — Correção Simples',
    cenario: 'Problema resolvido com ação direta',
    canais: {
      whatsapp: `{{nome_cliente}}, resolvido! ✅\n\nO problema com {{problema}} era {{causa_simples}}. Já corrigi aqui — você pode testar agora?\n\nSe travar em alguma parte, me fala! 😊`,
      email: `Olá, {{nome_cliente}},\n\nBoa notícia — o problema com {{problema}} foi resolvido!\n\n**O que estava acontecendo:**\n{{causa_explicacao}}\n\n**O que fiz:**\n{{acao_realizada}}\n\n**O que você deve ver agora:**\n{{resultado_esperado}}\n\nPode testar e me confirmar que ficou tudo certo?\n\nAbraços,\n{{nome_agente}}\nSuporte ProSystem`,
    },
  },
  {
    id: 'RES-02', cat: 'resolucao', catLabel: 'Resolução', severity: 'baixa',
    titulo: 'Resolução com Ação Necessária do Cliente',
    cenario: 'Agente fez sua parte; cliente precisa completar um passo',
    canais: {
      whatsapp: `{{nome_cliente}}, fiz a correção do lado de cá. Agora precisa de um passo seu:\n\n1. {{passo_1}}\n2. {{passo_2}}\n3. {{passo_3}}\n\nPode fazer isso aí e me fala o que aparece? Estou aqui! 👍`,
    },
  },
  {
    id: 'RES-03', cat: 'resolucao', catLabel: 'Resolução', severity: 'media',
    titulo: 'Problema Conhecido — Aguardando Atualização',
    cenario: 'Bug identificado, correção em desenvolvimento',
    canais: {
      whatsapp: `{{nome_cliente}}, identificamos o problema com {{problema}} — isso está acontecendo com outros clientes também e nosso time já está trabalhando na correção.\n\nPrevisão de atualização: {{prazo}}.\n\nEnquanto isso: {{solucao_paliativa}}.\n\nAssim que lançar a atualização eu te aviso! 📢`,
    },
  },
  {
    id: 'RES-04', cat: 'resolucao', catLabel: 'Resolução', severity: 'baixa',
    titulo: 'Sugestão de Funcionalidade Registrada',
    cenario: 'Cliente pediu algo que não existe ainda no sistema',
    canais: {
      whatsapp: `{{nome_cliente}}, anotei sua sugestão sobre {{funcionalidade_solicitada}} — faz todo sentido para o negócio de vocês.\n\nVou encaminhar pro nosso time de produto. Não consigo prometer prazo agora, mas sua sugestão entra na fila de análise com prioridade.\n\nSe tiver mais alguma ideia, pode mandar! A gente leva tudo a sério. 💡`,
    },
  },
  {
    id: 'RES-05', cat: 'resolucao', catLabel: 'Resolução', severity: 'alta',
    titulo: 'Resolução após Longa Espera',
    cenario: 'Problema demorou mais que o esperado para resolver',
    canais: {
      whatsapp: `{{nome_cliente}}, problema resolvido! ✅\n\nPeço desculpas pelo tempo que levou — {{motivo_da_demora}}. Sei que não é o ideal quando a operação está em andamento.\n\nJá está corrigido: {{descricao_solucao}}.\n\nPode testar e me confirmar? E obrigado pela paciência! 🙏`,
    },
  },
  {
    id: 'RES-06', cat: 'resolucao', catLabel: 'Resolução', severity: 'critica',
    titulo: 'Resolução com Compensação / Goodwill',
    cenario: 'Problema grave causou impacto significativo; empresa oferece compensação',
    canais: {
      whatsapp: `{{nome_cliente}}, o problema foi resolvido e já apliquei a correção.\n\nPelo transtorno que causamos, conversei com nossa gestão e aplicamos {{compensacao}} na sua conta. Os detalhes chegam por e-mail.\n\nObrigado pela compreensão — e me desculpe pelo que aconteceu. 🙏`,
      email: `Olá, {{nome_cliente}},\n\nO chamado #{{numero_chamado}} foi resolvido — {{descricao_solucao}}.\n\nEntendemos que o problema com {{problema}} causou impacto real na sua operação. Como reconhecimento, aplicamos {{compensacao}} na sua conta, com validade até {{data_validade}}.\n\nEsse crédito aparece automaticamente na próxima fatura.\n\nAbraços,\n{{nome_agente}}\nGerência de Suporte ProSystem`,
    },
  },
  // ACOMPANHAMENTO
  {
    id: 'FU-01', cat: 'acompanhamento', catLabel: 'Acompanhamento', severity: 'baixa',
    titulo: 'Verificação de Satisfação — 24h após Resolução',
    cenario: 'Follow-up rápido para confirmar que o problema não voltou',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! 😊 Tudo certo por aí depois que resolvemos o {{problema}}?\n\nSe tudo bem, ótimo! Se aparecer qualquer coisa, é só chamar.`,
    },
  },
  {
    id: 'FU-02', cat: 'acompanhamento', catLabel: 'Acompanhamento', severity: 'baixa',
    titulo: 'Pesquisa NPS / CSAT',
    cenario: 'Solicitar avaliação do atendimento',
    canais: {
      whatsapp: `Oi {{nome_cliente}}, tudo bem?\n\nFicou satisfeito com o atendimento sobre {{problema}}?\n\nDe 1 a 5, como avalia? (1 = Ruim, 5 = Excelente)\n\nSua resposta me ajuda muito a melhorar! 🙏`,
      email: `Olá, {{nome_cliente}},\n\nResolvemos recentemente o chamado #{{numero_chamado}}. Gostaríamos de saber como foi a experiência.\n\n👉 {{link_pesquisa}}\n\nLeva menos de 1 minuto e nos ajuda a melhorar para todos os nossos clientes.\n\nObrigado!\n{{nome_agente}}`,
    },
  },
  {
    id: 'FU-03', cat: 'acompanhamento', catLabel: 'Acompanhamento', severity: 'baixa',
    titulo: 'Reativação após Inatividade',
    cenario: 'Cliente teve problema e ficou inativo; verificar se está tudo bem',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! Aqui é {{nome_agente}} da ProSystem.\n\nVi que faz um tempinho que não conversamos depois do problema com {{problema}}. Ficou tudo resolvido por aí?\n\nSe surgiu alguma dúvida nova, pode me chamar! 😊`,
    },
  },
  {
    id: 'FU-04', cat: 'acompanhamento', catLabel: 'Acompanhamento', severity: 'baixa',
    titulo: 'Aviso de Atualização Relacionada ao Problema',
    cenario: 'Lançamos fix definitivo para bug que o cliente reportou',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! 🎉\n\nLembra do problema com {{problema}} que você relatou? Lançamos a atualização com a correção definitiva hoje!\n\nPara aplicar: {{instrucao_atualizacao}}.\n\nValeu por ter avisado — isso ajudou outros clientes também! 💪`,
    },
  },
  // CRISE
  {
    id: 'CRI-01', cat: 'crise', catLabel: 'Crise', severity: 'critica',
    titulo: 'Notificação Inicial de Instabilidade',
    cenario: 'Sistema com instabilidade afetando múltiplos clientes',
    canais: {
      whatsapp: `⚠️ ProSystem — Aviso importante\n\nEstamos com instabilidade em {{funcionalidade_afetada}} neste momento. Nossa equipe técnica já está trabalhando na correção.\n\n**O que você pode fazer agora:** {{acao_paliativa}}\n\nPróxima atualização: {{proximo_aviso}}. Pedimos desculpas pelo transtorno.`,
      email: `Assunto: ⚠️ Instabilidade em {{funcionalidade_afetada}} — ProSystem\n\nOlá, {{nome_cliente}},\n\nEstamos comunicando uma instabilidade em {{funcionalidade_afetada}} que pode estar afetando sua operação.\n\n**O que está acontecendo:**\n{{descricao_tecnica_simples}}\n\n**O que estamos fazendo:**\nNossa equipe técnica identificou a causa. Previsão: {{prazo_estimado}}.\n\n**O que você pode fazer agora:**\n{{acao_paliativa}}\n\nPróxima atualização: {{proximo_aviso}}.\n\n{{nome_agente}}\nSuporte ProSystem`,
    },
  },
  {
    id: 'CRI-02', cat: 'crise', catLabel: 'Crise', severity: 'critica',
    titulo: 'Atualização durante Instabilidade',
    cenario: 'Update de progresso durante crise em andamento',
    canais: {
      whatsapp: `⚠️ ProSystem — Atualização {{numero_update}}\n\nEquipe técnica continua trabalhando em {{problema}}.\n\n**Status atual:** {{status}}\n**Nova previsão:** {{prazo_revisado}}\n\n{{acao_paliativa_atualizada}}\n\nPróxima atualização: {{proximo_aviso}}`,
    },
  },
  {
    id: 'CRI-03', cat: 'crise', catLabel: 'Crise', severity: 'alta',
    titulo: 'Sistema Normalizado — Resolução de Crise',
    cenario: 'Instabilidade resolvida; comunicando normalização',
    canais: {
      whatsapp: `✅ ProSystem — Sistema normalizado\n\nO problema com {{funcionalidade_afetada}} foi resolvido às {{hora_resolucao}}.\n\nPode usar normalmente. Se perceber algo diferente, chama a gente!\n\nPedimos desculpas pelo impacto na sua operação. 🙏`,
    },
  },
  {
    id: 'CRI-04', cat: 'crise', catLabel: 'Crise', severity: 'critica',
    titulo: 'Problema de Emissão Fiscal (NF/SEFAZ) — Farmácias',
    cenario: 'Clientes não conseguem emitir nota fiscal — impacto legal',
    canais: {
      whatsapp: `⚠️ {{nome_cliente}}, recebemos seu chamado sobre emissão de NF.\n\nIdentificamos instabilidade na comunicação com o sistema da SEFAZ {{estado}}. Isso está ocorrendo com vários estabelecimentos no momento.\n\n**O que fazer agora:** {{instrucao_contingencia}} (cupom não fiscal ou NF em contingência)\n\nAssim que normalizar — previsão {{prazo}} — as NFs podem ser emitidas normalmente.\n\nEstou monitorando a cada 15 minutos e te aviso. 📡`,
    },
  },
  {
    id: 'CRI-05', cat: 'crise', catLabel: 'Crise', severity: 'critica',
    titulo: 'Problema de Segurança / Acesso Indevido',
    cenario: 'Suspeita de acesso não autorizado ao sistema do cliente',
    canais: {
      email: `Assunto: ⚠️ Ação necessária — Segurança da sua conta ProSystem\n\nOlá, {{nome_cliente}},\n\nIdentificamos uma atividade incomum na sua conta ProSystem em {{data_hora}}.\n\n**O que fazer AGORA:**\n1. Acesse o ProSystem → Configurações → Usuários\n2. Troque as senhas de todos os usuários ativos\n3. Verifique o log de acesso em {{caminho_log}}\n\n**O que já fizemos:**\n- Bloqueamos o acesso suspeito às {{hora_acao}}\n\nNosso técnico {{nome_tecnico}} entra em contato em até {{prazo}}.\nUrgência: {{telefone_urgencia}}\n\n{{nome_agente}}\nGerência de Segurança ProSystem`,
    },
  },
  // COBRANÇA
  {
    id: 'BIL-01', cat: 'cobranca', catLabel: 'Cobrança', severity: 'media',
    titulo: 'Falha de Pagamento',
    cenario: 'Mensalidade não foi processada',
    canais: {
      whatsapp: `Oi {{nome_cliente}}, tudo bem?\n\nPassando pra avisar que o pagamento da mensalidade de {{mes_referencia}} ({{valor}}) não foi identificado ainda aqui.\n\nAconteceu alguma coisa? Se precisar de boleto ou outra forma de pagamento, é só falar! 😊\n\nO acesso continua normal por enquanto — só quero resolver isso com você antes que gere problema.`,
    },
  },
  {
    id: 'BIL-02', cat: 'cobranca', catLabel: 'Cobrança', severity: 'baixa',
    titulo: 'Confirmação de Renovação',
    cenario: 'Renovação anual ou mensal confirmada',
    canais: {
      email: `Olá, {{nome_cliente}},\n\nConfirmamos a renovação do seu contrato ProSystem:\n\n**Plano:** {{nome_plano}}\n**Valor:** {{valor}}/mês\n**Vigência:** {{data_inicio}} a {{data_fim}}\n**Forma de pagamento:** {{forma_pagamento}}\n\nQualquer dúvida sobre sua fatura ou contrato, responde aqui que a gente resolve!\n\nObrigado pela parceria! 🤝\n\n{{nome_agente}}\nFinanceiro ProSystem`,
    },
  },
  {
    id: 'BIL-03', cat: 'cobranca', catLabel: 'Cobrança', severity: 'alta',
    titulo: 'Resposta a Pedido de Cancelamento',
    cenario: 'Cliente solicitou cancelamento do contrato',
    canais: {
      email: `Olá, {{nome_cliente}},\n\nRecebi sua solicitação de cancelamento do contrato ProSystem — #{{numero_contrato}}.\n\nAntes de confirmar, quero entender o que aconteceu: {{pergunta_retencao}}?\n\nSe houver algo que a ProSystem possa resolver — seja técnico, financeiro ou de uso — gostaria muito de conversar. Pode me ligar: {{telefone}} ou responder aqui.\n\nSe a decisão estiver tomada, confirmaremos o cancelamento para {{data_cancelamento}}.\n\n{{nome_agente}}\nGerência Comercial ProSystem`,
    },
  },
  {
    id: 'BIL-04', cat: 'cobranca', catLabel: 'Cobrança', severity: 'media',
    titulo: 'Confirmação de Reembolso',
    cenario: 'Reembolso aprovado',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! O reembolso de {{valor}} foi aprovado.\n\nOs detalhes chegam por e-mail, mas o valor cai em {{prazo_reembolso}} via {{metodo_reembolso}}.\n\nQualquer dúvida, é só chamar! 😊`,
    },
  },
  {
    id: 'BIL-05', cat: 'cobranca', catLabel: 'Cobrança', severity: 'media',
    titulo: 'Contestação de Cobrança — Resolução',
    cenario: 'Cliente questionou uma cobrança; verificada e resolvida',
    canais: {
      whatsapp: `{{nome_cliente}}, verifiquei a cobrança que você questionou de {{mes_referencia}}.\n\n{{resolucao}}: {{descricao_resolucao}}.\n\n{{acao_tomada}}. Qualquer dúvida sobre sua fatura, pode me chamar! 😊`,
    },
  },
  // FEEDBACK
  {
    id: 'FB-01', cat: 'feedback', catLabel: 'Feedback', severity: 'baixa',
    titulo: 'Resposta a Avaliação Positiva',
    cenario: 'Cliente deu feedback positivo sobre produto ou suporte',
    canais: {
      whatsapp: `{{nome_cliente}}, que bom ouvir isso! 😊\n\nFico feliz que o atendimento tenha resolvido. Vou repassar para o nosso time — é o que nos motiva a melhorar cada vez mais.\n\nQualquer coisa, sabe onde me achar! 👋`,
    },
  },
  {
    id: 'FB-02', cat: 'feedback', catLabel: 'Feedback', severity: 'alta',
    titulo: 'Resposta a Avaliação Negativa',
    cenario: 'Cliente deixou avaliação ruim ou expressou insatisfação',
    canais: {
      whatsapp: `{{nome_cliente}}, vi seu retorno e quero entender melhor o que aconteceu.\n\n{{problema_relatado}} não deveria ter acontecido assim, e lamento que sua experiência não foi boa.\n\nPosso te ligar agora para conversar? Quero resolver isso da forma certa. 🙏`,
    },
  },
  {
    id: 'FB-03', cat: 'feedback', catLabel: 'Feedback', severity: 'baixa',
    titulo: 'Convite para Sugerir Melhorias',
    cenario: 'Coleta proativa de feedback sobre produto',
    canais: {
      whatsapp: `Oi {{nome_cliente}}! Tudo bem?\n\nEstamos sempre melhorando o ProSystem e sua opinião é muito importante pra gente.\n\nTem alguma funcionalidade que poderia ser melhor ou algo que você sente falta no sistema?\n\nPode falar à vontade — toda sugestão vai direto pro time de produto! 💡`,
    },
  },
  {
    id: 'FB-04', cat: 'feedback', catLabel: 'Feedback', severity: 'media',
    titulo: 'Confirmação de Bug Reportado',
    cenario: 'Cliente reportou um bug; confirmando recebimento e ação',
    canais: {
      whatsapp: `{{nome_cliente}}, obrigado por relatar isso! 🙏\n\nConfirmei o problema com {{bug_descricao}} no nosso ambiente — nosso time técnico já está analisando.\n\nVocê vai ser o primeiro a saber quando sair a correção. E valeu mesmo pelo aviso!`,
    },
  },
  // CHATBOT
  {
    id: 'BOT-01', cat: 'chatbot', catLabel: 'Chatbot', severity: 'baixa',
    titulo: 'Saudação e Triagem Inicial',
    cenario: 'Primeira interação do chatbot — identificar o que o cliente precisa',
    canais: {
      whatsapp: `Oi! 👋 Aqui é o assistente da ProSystem Sistemas.\n\nComo posso te ajudar hoje?\n\n1️⃣ Tenho um problema técnico (sistema, PDV, impressora)\n2️⃣ Tenho dúvida sobre nota fiscal ou financeiro\n3️⃣ Quero aprender a usar uma função\n4️⃣ Quero falar com um atendente\n\nÉ só digitar o número ou me contar o que está acontecendo!`,
    },
  },
  {
    id: 'BOT-02', cat: 'chatbot', catLabel: 'Chatbot', severity: 'baixa',
    titulo: 'FAQ — Usuário sem Acesso / Senha',
    cenario: 'Resposta automática para problema de login',
    canais: {
      whatsapp: `Para recuperar o acesso, siga estes passos:\n\n1. Na tela de login, clique em "Esqueci minha senha"\n2. Digite o e-mail do usuário cadastrado\n3. Você receberá um link para redefinir\n\nSe não aparecer a opção ou não lembrar o e-mail, digite *humano* que conecto você com um atendente! 😊`,
    },
  },
  {
    id: 'BOT-03', cat: 'chatbot', catLabel: 'Chatbot', severity: 'alta',
    titulo: 'FAQ — Não Consigo Emitir NF',
    cenario: 'Resposta automática para problemas de nota fiscal',
    canais: {
      whatsapp: `Problemas na emissão de NF costumam ter 3 causas:\n\n1. 📡 SEFAZ fora do ar — verifique em www.nfe.fazenda.gov.br\n2. 🔑 Certificado digital vencido — confira em Configurações → Certificado\n3. ⚙️ Configuração fiscal — verifique o CNPJ em Configurações → Fiscal\n\nConseguiu identificar qual é o caso? Se não, digita *ajuda* que um técnico resolve! 🙏`,
    },
  },
  {
    id: 'BOT-04', cat: 'chatbot', catLabel: 'Chatbot', severity: 'baixa',
    titulo: 'Intenção Não Reconhecida',
    cenario: 'Chatbot não entendeu a mensagem do cliente',
    canais: {
      whatsapp: `Hmm, não entendi direito. 😅\n\nPode me contar com mais detalhes o que está acontecendo? Por exemplo:\n\n- "O sistema não abre"\n- "Não consigo emitir nota"\n- "Quero saber como usar o relatório de caixa"\n\nOu se preferir já falar com um atendente, é só digitar *humano*! 👋`,
    },
  },
  {
    id: 'BOT-05', cat: 'chatbot', catLabel: 'Chatbot', severity: 'media',
    titulo: 'Transferência para Atendente Humano',
    cenario: 'Chatbot não resolve; transferindo com contexto completo',
    canais: {
      whatsapp: `Entendido! Vou te conectar com um dos nossos atendentes agora. 👋\n\n[Para o atendente: Cliente {{nome_cliente}} | Assunto: {{resumo_chatbot}} | Tentativas: {{acoes_bot}}]\n\n{{nome_cliente}}, um atendente já está recebendo seu chamado — você não vai precisar repetir nada. Tempo estimado: {{prazo}}.`,
    },
  },
  {
    id: 'BOT-06', cat: 'chatbot', catLabel: 'Chatbot', severity: 'baixa',
    titulo: 'Atendimento Fora do Horário',
    cenario: 'Mensagem recebida fora do horário de suporte',
    canais: {
      whatsapp: `Oi! 👋 Nosso suporte por chat funciona das {{horario_inicio}} às {{horario_fim}}, de {{dias_semana}}.\n\nMas não se preocupa — deixa sua mensagem aqui que respondemos assim que abrirmos!\n\nPara emergências (operação totalmente parada): {{telefone_urgencia}} — atendimento 24h. 🚨`,
    },
  },
  {
    id: 'BOT-07', cat: 'chatbot', catLabel: 'Chatbot', severity: 'baixa',
    titulo: 'Confirmação antes de Ação',
    cenario: 'Bot confirma ação antes de executar',
    canais: {
      whatsapp: `Só confirmando antes de prosseguir:\n\nVocê quer {{acao_confirmacao}}, certo?\n\n✅ Sim, pode continuar\n❌ Não, quero cancelar\n\nÉ só responder!`,
    },
  },
  {
    id: 'BOT-08', cat: 'chatbot', catLabel: 'Chatbot', severity: 'baixa',
    titulo: 'Verificação de Satisfação Pós-Bot',
    cenario: 'Verificação após o chatbot resolver (ou tentar resolver)',
    canais: {
      whatsapp: `Consegui te ajudar? 😊\n\n✅ Sim, resolveu!\n❌ Não, ainda preciso de ajuda\n\nSe quiser, também pode me avaliar de 1 a 5 — isso me ajuda a melhorar! 🙏`,
    },
  },
];

const CATS = [
  { id: 'all',             label: 'Todos',             cor: '#6b7280' },
  { id: 'primeiro-contato', label: 'Primeiro Contato', cor: '#3b82f6' },
  { id: 'investigacao',    label: 'Investigação',       cor: '#f59e0b' },
  { id: 'resolucao',       label: 'Resolução',          cor: '#10b981' },
  { id: 'acompanhamento',  label: 'Acompanhamento',     cor: '#6366f1' },
  { id: 'crise',           label: 'Crise',              cor: '#ef4444' },
  { id: 'cobranca',        label: 'Cobrança',           cor: '#8b5cf6' },
  { id: 'feedback',        label: 'Feedback',           cor: '#14b8a6' },
  { id: 'chatbot',         label: 'Chatbot',            cor: '#06b6d4' },
];

const SEV_COLOR: Record<string, { cor: string; bg: string }> = {
  baixa:   { cor: '#2563eb', bg: '#dbeafe' },
  media:   { cor: '#d97706', bg: '#fef3c7' },
  alta:    { cor: '#ea580c', bg: '#ffedd5' },
  critica: { cor: '#dc2626', bg: '#fee2e2' },
};
const SEV_LABEL: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
const CANAL_LABEL: Record<string, string> = { whatsapp: 'WhatsApp', email: 'E-mail', telefone: 'Telefone' };

// ── COMPONENTE PRINCIPAL ─────────────────────────────────────────
export default function AtendimentoPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  const [catAtiva, setCatAtiva] = useState('all');
  const [busca, setBusca] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [varPanel, setVarPanel] = useState(false);
  const [toneOpen, setToneOpen] = useState(false);
  const [canaisAtivos, setCanaisAtivos] = useState<Record<string, string>>({});

  useEffect(() => { if (!isAuthenticated && !loading) router.push('/'); }, [isAuthenticated, loading, router]);

  const templatesFiltrados = TEMPLATES.filter(t => {
    const matchCat = catAtiva === 'all' || t.cat === catAtiva;
    const q = busca.toLowerCase();
    const matchBusca = !q || t.titulo.toLowerCase().includes(q) || t.cenario.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) || Object.values(t.canais).some(txt => txt.toLowerCase().includes(q));
    return matchCat && matchBusca;
  });

  const getCanalAtivo = (t: typeof TEMPLATES[0]) => {
    const salvo = canaisAtivos[t.id];
    const canais = Object.keys(t.canais);
    return salvo && canais.includes(salvo) ? salvo : canais[0];
  };

  const copiar = async (t: typeof TEMPLATES[0]) => {
    const canal = getCanalAtivo(t);
    const texto = (t.canais as any)[canal] || '';
    try {
      await navigator.clipboard.writeText(texto);
      setCopiedId(t.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* ignore */ }
  };

  const copiarVar = async (v: string) => {
    try { await navigator.clipboard.writeText(v); } catch { /* ignore */ }
  };

  if (loading) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><p style={{ color: 'var(--t-text-muted)' }}>Carregando…</p></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 1100 }}>
        {/* HEADER */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
            <Headphones size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t-text-primary)' }}>Atendimento ao Cliente</h1>
            <p style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>
              {TEMPLATES.length} templates prontos para WhatsApp, E-mail e Telefone — copie e personalize.
            </p>
          </div>
        </div>

        {/* TOM DE VOZ */}
        <div
          style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, cursor: 'pointer' }}
          onClick={() => setToneOpen(o => !o)}
        >
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 13, fontWeight: 600, color: '#818cf8' }}>💬 Guia de Tom de Voz ProSystem</span>
            {toneOpen ? <ChevronUp size={16} color="#818cf8" /> : <ChevronDown size={16} color="#818cf8" />}
          </div>
          {toneOpen && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--t-text-muted)', fontStyle: 'italic', borderLeft: '3px solid #6366f1', paddingLeft: 12, marginBottom: 12 }}>
                "Nossa voz de suporte é de um parceiro de negócio que conhece profundamente o varejo — direto, humano, e já está resolvendo antes de terminar de explicar."
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 6 }}>✅ FAZER</p>
                  {['Usar o nome do cliente desde a primeira mensagem','Responder primeiro, contextualizar depois','Linguagem simples — zero jargão técnico','Dizer o prazo sempre ("em até 5 minutos")','Antecipar a próxima dúvida do cliente'].map(d => (
                    <p key={d} style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 4 }}>• {d}</p>
                  ))}
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>❌ NUNCA USAR</p>
                  {['"Seu ticket foi gerado com número..."','"Encaminharemos ao setor responsável"','"De acordo com nossa política"','"Por favor, aguarde" (sem prazo)','"Infelizmente não é possível"'].map(d => (
                    <p key={d} style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 4 }}>• {d}</p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BUSCA + VARIÁVEIS */}
        <div className="flex gap-2 mb-4">
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t-text-muted)' }} />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar template…"
              className="ps-input w-full"
              style={{ paddingLeft: 30, fontSize: 13 }}
            />
          </div>
          <button
            onClick={() => setVarPanel(o => !o)}
            style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid var(--t-card-border)', color: 'var(--t-text-muted)', background: 'var(--t-card-bg)', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {'{ }'} Variáveis
          </button>
        </div>

        {/* CATEGORIAS */}
        <div className="flex flex-wrap gap-2 mb-5">
          {CATS.map(c => {
            const count = c.id === 'all' ? TEMPLATES.length : TEMPLATES.filter(t => t.cat === c.id).length;
            const ativa = catAtiva === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCatAtiva(c.id)}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${ativa ? c.cor : 'var(--t-card-border)'}`,
                  background: ativa ? `${c.cor}18` : 'transparent',
                  color: ativa ? c.cor : 'var(--t-text-muted)',
                }}
              >
                {c.label} <span style={{ opacity: 0.6 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* GRID DE TEMPLATES */}
        <div style={{ display: 'grid', gap: 14 }}>
          {templatesFiltrados.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--t-text-muted)', fontSize: 13 }}>
              Nenhum template encontrado para "{busca}".
            </div>
          )}
          {templatesFiltrados.map(t => {
            const sev = SEV_COLOR[t.severity] || SEV_COLOR.baixa;
            const canais = Object.keys(t.canais);
            const canalAtivo = getCanalAtivo(t);
            const texto = (t.canais as any)[canalAtivo] || '';
            const copied = copiedId === t.id;
            const catInfo = CATS.find(c => c.id === t.cat);

            return (
              <div
                key={t.id}
                className="ps-card"
                style={{
                  borderRadius: 12, padding: '16px 18px',
                  border: '1px solid var(--t-card-border)',
                  borderLeft: `3px solid ${catInfo?.cor || '#6b7280'}`,
                }}
              >
                {/* Meta */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--t-text-muted)', background: 'var(--t-content-bg)', padding: '1px 6px', borderRadius: 4 }}>{t.id}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: sev.cor, background: sev.bg, padding: '2px 8px', borderRadius: 999 }}>{SEV_LABEL[t.severity]}</span>
                  {canais.map(c => (
                    <span key={c} style={{ fontSize: 11, color: 'var(--t-text-muted)', border: '1px solid var(--t-card-border)', padding: '1px 7px', borderRadius: 999 }}>{CANAL_LABEL[c] || c}</span>
                  ))}
                </div>

                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--t-text-primary)', marginBottom: 2 }}>{t.titulo}</div>
                <div style={{ fontSize: 12, color: 'var(--t-text-muted)', marginBottom: 10 }}>{t.cenario}</div>

                {/* Tabs de canal */}
                {canais.length > 1 && (
                  <div className="flex gap-1 mb-2">
                    {canais.map(c => (
                      <button
                        key={c}
                        onClick={() => setCanaisAtivos(p => ({ ...p, [t.id]: c }))}
                        style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
                          border: '1px solid var(--t-card-border)',
                          background: canalAtivo === c ? 'rgba(16,185,129,0.1)' : 'transparent',
                          color: canalAtivo === c ? '#10b981' : 'var(--t-text-muted)',
                        }}
                      >
                        {CANAL_LABEL[c] || c}
                      </button>
                    ))}
                  </div>
                )}

                {/* Conteúdo do template */}
                <pre style={{
                  background: 'var(--t-content-bg)', border: '1px solid var(--t-card-border)',
                  borderRadius: 8, padding: '12px 14px', fontSize: 12,
                  color: 'var(--t-text-secondary)', lineHeight: 1.7,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit',
                  maxHeight: 200, overflowY: 'auto',
                }}>
                  {texto}
                </pre>

                {/* Rodapé */}
                <div className="flex items-center justify-between mt-2">
                  <button
                    onClick={() => copiar(t)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${copied ? '#10b981' : 'var(--t-card-border)'}`,
                      background: copied ? 'rgba(16,185,129,0.1)' : 'var(--t-content-bg)',
                      color: copied ? '#10b981' : 'var(--t-text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {copied ? <><Check size={13} /> Copiado!</> : <><Copy size={13} /> Copiar</>}
                  </button>
                  <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{catInfo?.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* PAINEL DE VARIÁVEIS */}
        {varPanel && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.5)' }} onClick={() => setVarPanel(false)}>
            <div
              style={{ position: 'fixed', right: 0, top: 0, height: '100vh', width: 340, background: 'var(--t-card-bg)', borderLeft: '1px solid var(--t-card-border)', overflowY: 'auto', padding: 20 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--t-text-primary)' }}>Variáveis de Template</span>
                <button onClick={() => setVarPanel(false)}><X size={16} style={{ color: 'var(--t-text-muted)' }} /></button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 12 }}>Clique no nome para copiar a variável.</p>
              {VARIAVEIS.map(v => (
                <div key={v.nome} style={{ borderBottom: '1px solid var(--t-card-border)', padding: '10px 0', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <button
                    onClick={() => copiarVar(v.nome)}
                    style={{ fontFamily: 'monospace', fontSize: 11, color: '#818cf8', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', padding: '2px 7px', borderRadius: 4, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    {v.nome}
                  </button>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>{v.desc}</div>
                    <div style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>Ex: {v.ex}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
