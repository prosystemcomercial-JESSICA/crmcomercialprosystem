# Sprint 29 — Step 04 — Felipe Santos (Backend)
# Pesquisa de Motivos de Churn — Implementação

## Services (TypeScript)

### SurveyChurnService
```typescript
async create(casoChurnId: string) {
  const caso = await prisma.casoChurn.findUnique({where: {id: casoChurnId}});
  if (!caso) throw new NotFoundError('Caso não encontrado');
  
  const survey = await prisma.surveyChurn.create({
    data: {
      casoChurnId,
      clienteId: caso.clienteId,
      status: 'PENDING',
      expira_em: new Date(Date.now() + 30*86400*1000)
    }
  });
  
  return survey;
}

async send(surveyId: string) {
  const survey = await prisma.surveyChurn.findUnique({where: {id: surveyId}});
  const cliente = await prisma.cliente.findUnique({where: {id: survey.clienteId}});
  
  const link = `${process.env.FRONTEND_URL}/survey/${surveyId}?token=${generateToken(surveyId)}`;
  
  await mailer.send({
    to: cliente.email,
    subject: 'Sua opinião é importante',
    template: 'survey-email',
    data: {clienteNome: cliente.nome, link}
  });
  
  await prisma.surveyChurn.update({
    where: {id: surveyId},
    data: {email_enviado: true, enviado_em: new Date()}
  });
  
  return {enviado: true};
}

async respond(surveyId: string, data: {q1, q2, q3, q4, q5}) {
  // Validate
  if (!data.q1 || data.q1.length < 10) throw new BadRequestError('Q1 min 10 chars');
  if (![1..10].includes(data.q3)) throw new BadRequestError('Q3 invalid');
  if (!['sim','não','talvez'].includes(data.q4)) throw new BadRequestError('Q4 invalid');
  if (![1..5].includes(data.q5)) throw new BadRequestError('Q5 invalid');
  
  // Save response
  const resposta = await prisma.surveyResposta.create({
    data: {
      surveyId,
      q1_resposta: data.q1,
      q2_resposta: data.q2,
      q3_score: data.q3,
      q4_opcao: data.q4,
      q5_stars: data.q5
    }
  });
  
  // Mark survey as responded
  await prisma.surveyChurn.update({
    where: {id: surveyId},
    data: {respondida: true, respondido_em: new Date()}
  });
  
  // Trigger NLP analysis async
  queue.add({type: 'nlp-analyze', respostaId: resposta.id});
  
  return {respondido: true};
}
```

### NLPSentimentService
```typescript
import compromise from 'compromise';

async analyzeSentiment(text: string) {
  // Dictionary pt-BR
  const positive = ['obrigado', 'excelente', 'ótimo', 'bom', 'gostei', 'recomendo'];
  const negative = ['ruim', 'péssimo', 'lento', 'caro', 'decepção', 'não responde'];
  
  const doc = compromise(text.toLowerCase());
  const tokens = doc.terms().data().map(t => t.text);
  
  let score = 0;
  tokens.forEach(token => {
    if (positive.includes(token)) score += 1;
    if (negative.includes(token)) score -= 1;
  });
  
  // Normalize -1 to +1
  const normalized = Math.max(-1, Math.min(1, score / tokens.length));
  
  const label = normalized < -0.5 ? 'MUITO_NEGATIVO' :
                normalized < -0.1 ? 'NEGATIVO' :
                normalized < 0.1 ? 'NEUTRO' :
                normalized < 0.5 ? 'POSITIVO' : 'MUITO_POSITIVO';
  
  const confidence = Math.abs(normalized) * 100;
  
  return {score: normalized, label, confidence};
}

async extractKeywords(text: string, topN: number = 5) {
  const doc = compromise(text.toLowerCase());
  const tokens = doc.terms().data().map(t => t.text);
  
  // Simple TF-IDF placeholder
  const freq = {};
  tokens.forEach(t => freq[t] = (freq[t] || 0) + 1);
  
  return Object.entries(freq)
    .sort((a,b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}
```

### AutoCategorizationService
```typescript
async categorize(keywords: string[]) {
  const patterns = {
    PRECO: ['preço', 'caro', 'aumento', 'concorrência', 'desconto'],
    SUPORTE: ['suporte', 'atendimento', 'responde', 'ajuda'],
    INTEGRACAO_PROBLEMAS: ['integração', 'API', 'conectar', 'sync'],
    MAL_USO_PRODUTO: ['difícil', 'complexo', 'confuso', 'entender'],
    PERFORMANCE_LENTA: ['lento', 'lag', 'speed', 'carrega'],
    MIGRACAO_CONCORRENCIA: ['concorrente', 'mudou', 'alternativa'],
    FALTA_SUPORTE: ['sem resposta', 'ignorado', 'falta suporte'],
    PERSONALIZACAO_INSUFICIENTE: ['feature', 'funcionalidade', 'customizar'],
    VOLUME_BAIXO: ['volume', 'crescimento', 'necessidade'],
    INSATISFACAO_SERVICO: ['insatisfeito', 'decepção', 'não gosto']
  };
  
  let matches = {};
  Object.entries(patterns).forEach(([motivo, words]) => {
    const count = keywords.filter(k => words.includes(k)).length;
    if (count > 0) matches[motivo] = count;
  });
  
  if (Object.keys(matches).length === 0) {
    return {motivo: null, confidence: 'NONE'};
  }
  
  const topMotivo = Object.entries(matches).sort((a,b) => b[1] - a[1])[0][0];
  const topScore = matches[topMotivo];
  
  const confidence = topScore >= 3 ? 'HIGH' : topScore >= 1 ? 'MEDIUM' : 'LOW';
  
  return {motivo: topMotivo, confidence};
}
```

---

## Routes (Fastify)

```typescript
fastify.post('/surveys/saida', async (req, reply) => {
  const {casoChurnId} = req.body;
  const survey = await surveyService.create(casoChurnId);
  reply.status(201).send(survey);
});

fastify.post('/surveys/:id/send', requireAuth, async (req, reply) => {
  const result = await surveyService.send(req.params.id);
  reply.send(result);
});

fastify.get('/surveys/saida', requireAuth, async (req, reply) => {
  const filters = req.query;
  const surveys = await surveyService.list(filters);
  reply.send(surveys);
});

fastify.get('/surveys/:id/public', async (req, reply) => {
  const survey = await prisma.surveyChurn.findUnique({where: {id: req.params.id}});
  if (!survey || survey.expira_em < new Date()) {
    reply.status(410).send({error: 'Expirada'});
    return;
  }
  reply.send({survey, questions: [{...}]});
});

fastify.post('/surveys/:id/respond', async (req, reply) => {
  const data = await surveySchema.validate(req.body);
  const result = await surveyService.respond(req.params.id, data);
  reply.send(result);
});

fastify.get('/dashboard/pesquisa', requireAuth, requireRole(['CEO','SUPERVISAO_CS','FINANCEIRO']), async (req, reply) => {
  const {periodo, status, motivo} = req.query;
  const kpis = await calculateKPIs({periodo, status, motivo});
  const charts = await generateCharts({periodo, status, motivo});
  reply.send({kpis, charts});
});

fastify.get('/relatorios/pesquisa', requireAuth, async (req, reply) => {
  const {tipo, formato, inicio, fim} = req.query;
  const buffer = await generateReport({tipo, formato, inicio, fim});
  reply.header('Content-Disposition', `attachment; filename="relatorio.${formato}"`);
  reply.send(buffer);
});
```

---

## Crons (Node-Schedule)

```typescript
// 09:00 Auto-envio surveys
schedule.scheduleJob('0 9 * * *', async () => {
  const cancelados = await prisma.casoChurn.findMany({
    where: {
      status: 'CANCELADO',
      createdAt: {gte: new Date(Date.now() - 48*3600*1000), lte: new Date(Date.now() - 24*3600*1000)}
    }
  });
  
  for (const caso of cancelados) {
    const existing = await prisma.surveyChurn.findUnique({where: {casoChurnId: caso.id}});
    if (!existing) {
      await surveyService.create(caso.id);
      await surveyService.send(survey.id);
    }
  }
});

// 23:00 Batch NLP
schedule.scheduleJob('0 23 * * *', async () => {
  const surveys = await prisma.surveyResposta.findMany({
    where: {sentimento_q1: null}
  });
  
  for (const survey of surveys) {
    const sentiment = await nlpService.analyzeSentiment(survey.q1_resposta);
    const keywords = await nlpService.extractKeywords(survey.q1_resposta);
    const categorization = await categService.categorize(keywords);
    
    await prisma.surveyResposta.update({
      where: {id: survey.id},
      data: {
        sentimento_q1: sentiment.score,
        sentimento_q1_label: sentiment.label,
        keywords_q1: keywords,
        motivo_real: categorization.motivo,
        confianca: categorization.confidence
      }
    });
  }
});

// 23:30 Detecta padrões
schedule.scheduleJob('30 23 * * *', async () => {
  const keywords = await detectTopKeywords(7);
  const newKeyword = await checkNewPatterns(keywords);
  if (newKeyword) {
    await mailer.send({
      to: ceoEmail,
      subject: 'Novo padrão de churn detectado',
      template: 'pattern-alert',
      data: {keyword: newKeyword}
    });
  }
});

// 02:00 Learning
schedule.scheduleJob('0 2 * * *', async () => {
  const yesterday = await prisma.surveyResposta.findMany({
    where: {responded_at: {gte: yesterday, lte: today}}
  });
  
  // Generate recommendations per survey
  // Invalidate cache
  cache.del(/^dashboard:pesquisa/);
});
```

---

## Sprint 29 Step 04 — Backend PRONTO ✅

Next: Isabela Costa (Frontend) — React components + hooks
