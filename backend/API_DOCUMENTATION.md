# CRM Comercial ProSystem - API Documentation

## Base URL
`http://localhost:3001`

## Authentication
All endpoints (except `/health`) require the `Authorization` header:
```
Authorization: Bearer <token>
```

## Role-Based Access Control (RBAC)
Available roles: `VENDEDOR`, `SUPERVISAO`, `CEO`, `ADMIN`, `FINANCEIRO`, `TECNICO`

---

## CASOS CHURN (Case Management)

### Create Case
```http
POST /casos-churn
Authorization: Bearer <token>
Content-Type: application/json

{
  "clienteId": "string",
  "motivo_principal": "string (optional)",
  "descricao": "string (optional)"
}
```
**Permissions:** CEO, SUPERVISAO  
**Response:** 201 Created
```json
{
  "status": "success",
  "data": {
    "id": "string",
    "clienteId": "string",
    "status": "NOVO",
    "risk_score": 0,
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
```

### List Cases
```http
GET /casos-churn?page=0&limit=20&status=NOVO&risco_min=0&risco_max=100
Authorization: Bearer <token>
```
**Permissions:** All  
**Response:** 200 OK
```json
{
  "status": "success",
  "data": [...],
  "pagination": {
    "page": 0,
    "limit": 20,
    "total": 50
  }
}
```

### Get Case by ID
```http
GET /casos-churn/:id
Authorization: Bearer <token>
```
**Permissions:** All  
**Response:** 200 OK

### Update Case
```http
PATCH /casos-churn/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "DIAGNOSTICADO|PLANEJADO|EXECUTANDO|RECUPERADO|PERDIDO",
  "risk_score": "number (0-100)",
  "motivo_principal": "string"
}
```
**Permissions:** CEO, SUPERVISAO  
**Response:** 200 OK

### Delete Case (Soft Delete)
```http
DELETE /casos-churn/:id
Authorization: Bearer <token>
```
**Permissions:** CEO only  
**Response:** 204 No Content

---

## DIAGNOSIS (Risk Assessment)

### Create Diagnosis
```http
POST /casos/:casoId/diagnostico
Authorization: Bearer <token>
Content-Type: application/json

{
  "dias_sem_interacao": 45,
  "valor_mensal": 2500,
  "frequencia_suporte": 8,
  "tempo_cliente": 4,
  "motivo_reportado": "Preço elevado"
}
```
**Permissions:** CEO, SUPERVISAO, TECNICO  
**Response:** 201 Created
```json
{
  "status": "success",
  "data": {
    "id": "string",
    "caso_churn_id": "string",
    "motivo_principal": "string",
    "risco_score": 75,
    "fatores": ["string"],
    "created_at": "ISO8601"
  }
}
```

**Risk Scoring (0-100)**
- **Dias sem interação (0-20 pts):** >60 days=20, >30=15, >15=10, >7=5
- **Valor mensal (0-15 pts):** >5000=15, >3000=12, >1000=8, >500=4
- **Frequência suporte (0-20 pts):** >10=20, >5=15, >2=10, >0=5
- **Tempo como cliente (0-15 pts):** <3m=15, <6m=12, <12m=8, <24m=4
- **Motivo (0-30 pts):** Preço/Caro=30, Performance/Lento=25, Suporte=20, Integração/API=20, Outro=10

**Risk Levels**
- BAIXO: 0-30
- MÉDIO: 31-70
- ALTO: 71-100

### Get Diagnosis by Case
```http
GET /casos/:casoId/diagnostico
Authorization: Bearer <token>
```
**Permissions:** All  
**Response:** 200 OK
```json
{
  "status": "success",
  "data": {
    "diagnosis": {...},
    "riskMatrix": {
      "casoId": "string",
      "overall_score": 75,
      "risk_level": "ALTO",
      "factors": ["string"],
      "motivo": "string"
    }
  }
}
```

### Update Diagnosis
```http
PATCH /diagnosticos/:diagnosisId
Authorization: Bearer <token>
Content-Type: application/json

{
  "dias_sem_interacao": 65,
  "frequencia_suporte": 12
}
```
**Permissions:** CEO, SUPERVISAO, TECNICO  
**Response:** 200 OK

---

## RETENTION PLANS (Plano Retenção)

### Create Plan
```http
POST /casos/:casoId/planos
Authorization: Bearer <token>
Content-Type: application/json

{
  "titulo": "Plano Premium",
  "descricao": "Desconto exclusivo + suporte dedicado"
}
```
**Permissions:** CEO, SUPERVISAO  
**Response:** 201 Created
```json
{
  "status": "success",
  "data": {
    "id": "string",
    "caso_churn_id": "string",
    "titulo": "string",
    "descricao": "string",
    "status": "RASCUNHO",
    "acoes": [],
    "created_at": "ISO8601"
  }
}
```

### List Plans for Case
```http
GET /casos/:casoId/planos
Authorization: Bearer <token>
```
**Permissions:** All  
**Response:** 200 OK

### Get Plan by ID
```http
GET /planos/:planoId
Authorization: Bearer <token>
```
**Permissions:** All  
**Response:** 200 OK

### Update Plan
```http
PATCH /planos/:planoId
Authorization: Bearer <token>
Content-Type: application/json

{
  "titulo": "string",
  "descricao": "string",
  "status": "RASCUNHO|ATIVO|CONCLUIDO"
}
```
**Permissions:** CEO, SUPERVISAO  
**Response:** 200 OK

### Activate Plan
```http
POST /planos/:planoId/ativar
Authorization: Bearer <token>
```
**Permissions:** CEO, SUPERVISAO  
**Response:** 200 OK

### Conclude Plan
```http
POST /planos/:planoId/concluir
Authorization: Bearer <token>
```
**Permissions:** CEO, SUPERVISAO  
**Response:** 200 OK

### Delete Plan
```http
DELETE /planos/:planoId
Authorization: Bearer <token>
```
**Permissions:** CEO only  
**Response:** 204 No Content

---

## RETENTION ACTIONS (Ação Retenção)

### Create Action
```http
POST /casos/:casoId/acoes
Authorization: Bearer <token>
Content-Type: application/json

{
  "titulo": "Contato com cliente",
  "tipo": "CONTATO|EMAIL|DESCONTO|PRODUTO|OUTRO",
  "descricao": "string (optional)",
  "responsavel_id": "string (optional)",
  "data_vencimento": "ISO8601 (optional)",
  "plano_id": "string (optional)"
}
```
**Permissions:** CEO, SUPERVISAO, TECNICO  
**Response:** 201 Created
```json
{
  "status": "success",
  "data": {
    "id": "string",
    "caso_churn_id": "string",
    "titulo": "string",
    "tipo": "CONTATO",
    "status": "NOVA",
    "data_vencimento": "ISO8601",
    "created_at": "ISO8601"
  }
}
```

### List Actions for Case
```http
GET /casos/:casoId/acoes?status=NOVA
Authorization: Bearer <token>
```
**Permissions:** All  
**Response:** 200 OK (array of actions)

### Get Action by ID
```http
GET /acoes/:acaoId
Authorization: Bearer <token>
```
**Permissions:** All  
**Response:** 200 OK

### Update Action
```http
PATCH /acoes/:acaoId
Authorization: Bearer <token>
Content-Type: application/json

{
  "titulo": "string",
  "descricao": "string",
  "status": "NOVA|EM_PROGRESSO|CONCLUIDA|CANCELADA",
  "responsavel_id": "string",
  "data_vencimento": "ISO8601"
}
```
**Permissions:** CEO, SUPERVISAO, TECNICO  
**Response:** 200 OK

### Mark as In Progress
```http
POST /acoes/:acaoId/progresso
Authorization: Bearer <token>
```
**Permissions:** CEO, SUPERVISAO, TECNICO  
**Response:** 200 OK

### Conclude Action
```http
POST /acoes/:acaoId/concluir
Authorization: Bearer <token>
```
**Permissions:** CEO, SUPERVISAO, TECNICO  
**Response:** 200 OK

### Cancel Action
```http
POST /acoes/:acaoId/cancelar
Authorization: Bearer <token>
```
**Permissions:** CEO, SUPERVISAO  
**Response:** 200 OK

### Get Action Timeline
```http
GET /casos/:casoId/timeline
Authorization: Bearer <token>
```
**Permissions:** All  
**Response:** 200 OK
```json
{
  "status": "success",
  "data": {
    "total": 5,
    "nova": 1,
    "em_progresso": 2,
    "concluida": 2,
    "cancelada": 0,
    "timeline": [...]
  }
}
```

### Delete Action
```http
DELETE /acoes/:acaoId
Authorization: Bearer <token>
```
**Permissions:** CEO only  
**Response:** 204 No Content

---

## DASHBOARD (Analytics & KPIs)

### Get KPIs
```http
GET /dashboard/retencao?periodo=30dias&status=NOVO
Authorization: Bearer <token>
```
**Query Parameters:**
- `periodo`: 7dias | 30dias | 90dias | 6meses (default: 30dias)
- `status`: Optional status filter

**Permissions:** CEO, SUPERVISAO  
**Response:** 200 OK
```json
{
  "status": "success",
  "data": {
    "total_casos": 45,
    "casos_por_status": {
      "NOVO": 10,
      "DIAGNOSTICADO": 15,
      "PLANEJADO": 12,
      "EXECUTANDO": 5,
      "RECUPERADO": 2,
      "PERDIDO": 1
    },
    "risco_distribution": {
      "BAIXO": 15,
      "MÉDIO": 20,
      "ALTO": 10
    },
    "taxa_diagnosticados": 78.45,
    "taxa_planejados": 62.33,
    "taxa_recuperados": 15.67,
    "valor_total_em_risco": 45000,
    "acoes_pendentes": 23
  }
}
```

### Get Status Chart Data
```http
GET /dashboard/retencao/chart/status?dias=30
Authorization: Bearer <token>
```
**Permissions:** CEO, SUPERVISAO  
**Response:** 200 OK (array of daily aggregations)

### Get Risk Distribution Chart
```http
GET /dashboard/retencao/chart/risco
Authorization: Bearer <token>
```
**Permissions:** CEO, SUPERVISAO  
**Response:** 200 OK
```json
{
  "status": "success",
  "data": {
    "BAIXO": 15,
    "MÉDIO": 20,
    "ALTO": 10
  }
}
```

### Get Top Clients at Risk
```http
GET /dashboard/retencao/top-risco?limit=10
Authorization: Bearer <token>
```
**Permissions:** CEO, SUPERVISAO  
**Response:** 200 OK
```json
{
  "status": "success",
  "data": [
    {
      "id": "string",
      "cliente": {
        "id": "string",
        "nome": "string",
        "email": "string"
      },
      "risk_score": 85,
      "status": "DIAGNOSTICADO"
    }
  ]
}
```

### Get Plan Status Summary
```http
GET /dashboard/retencao/planos-status
Authorization: Bearer <token>
```
**Permissions:** CEO, SUPERVISAO  
**Response:** 200 OK

### Get Actions by Type
```http
GET /dashboard/retencao/acoes-tipo
Authorization: Bearer <token>
```
**Permissions:** CEO, SUPERVISAO  
**Response:** 200 OK
```json
{
  "status": "success",
  "data": [
    {
      "tipo": "CONTATO",
      "count": 12
    },
    {
      "tipo": "EMAIL",
      "count": 8
    }
  ]
}
```

### Get Recovery Rate by Motive
```http
GET /dashboard/retencao/recuperacao-motivo
Authorization: Bearer <token>
```
**Permissions:** CEO, SUPERVISAO  
**Response:** 200 OK
```json
{
  "status": "success",
  "data": [
    {
      "motivo": "Preço elevado",
      "total": 10,
      "recuperados": 6,
      "taxa": "60.00"
    }
  ]
}
```

---

## Health Check

### Server Health
```http
GET /health
```
**Response:** 200 OK
```json
{
  "status": "ok",
  "timestamp": "ISO8601",
  "uptime": 123.45
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "status": "error",
  "message": "Validation error",
  "errors": [...]
}
```

### 401 Unauthorized
```json
{
  "status": "error",
  "message": "Missing or invalid authorization"
}
```

### 403 Forbidden
```json
{
  "status": "error",
  "message": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "status": "error",
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "status": "error",
  "message": "Internal server error",
  "error": "Error details (development only)"
}
```
