const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (m) process.env[m[1]] = process.env[m[1]] || m[2];
}

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function main() {
  const html = fs
    .readFileSync(path.join(__dirname, '..', 'src', 'email-templates', 'padaria', 'email-1.html'), 'utf-8')
    .replace('{{unsubscribe_url}}', '#');

  const { data, error } = await resend.emails.send({
    from: 'Prosystem <onboarding@resend.dev>',
    to: 'jessica.prosystem@gmail.com',
    subject: 'Sua padaria vende. Mas o lucro aparece?',
    html,
  });

  if (error) {
    console.error('Erro ao enviar:', error);
    process.exit(1);
  }
  console.log('Enviado com sucesso. ID:', data.id);
}

main();
