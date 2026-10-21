import { redirect } from 'next/navigation';

// Módulo retirado em 21/10/2026 (pedido da Jessica): pesquisas e qualidade do
// atendimento ficam no CRM de atendimento; aqui o foco é o caso de churn.
export default function Page() {
  redirect('/casos');
}
