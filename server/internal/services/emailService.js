import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Chave de criptografia para proteger a senha do e-mail no banco SQLite
const authSecretPath = path.join(path.resolve(), '.auth-secret');
let encryptionKeyBuffer;
try {
  const secretText = process.env.AUTH_ENCRYPTION_KEY || (fs.existsSync(authSecretPath) ? fs.readFileSync(authSecretPath, 'utf8').trim() : 'lepta-secret-key-2026');
  encryptionKeyBuffer = createHash('sha256').update(secretText).digest();
} catch {
  encryptionKeyBuffer = createHash('sha256').update('lepta-fallback-key').digest();
}

/**
 * Criptografa texto usando AES-256-CBC
 */
export function encryptPassword(plainText) {
  if (!plainText) return null;
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', encryptionKeyBuffer, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Descriptografa texto usando AES-256-CBC
 */
export function decryptPassword(cipherText) {
  if (!cipherText) return null;
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 2) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = createDecipheriv('aes-256-cbc', encryptionKeyBuffer, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Erro ao descriptografar senha de e-mail:', error.message);
    return null;
  }
}

/**
 * Garante que a tabela de configuração de e-mail exista no banco SQLite
 */
export function ensureEmailConfigTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS configuracao_email (
      id TEXT PRIMARY KEY,
      host TEXT NOT NULL DEFAULT 'smtp.office365.com',
      port INTEGER NOT NULL DEFAULT 587,
      secure INTEGER NOT NULL DEFAULT 0,
      user TEXT NOT NULL DEFAULT 'webmaster@lepta.com.br',
      pass_encrypted TEXT,
      from_name TEXT NOT NULL DEFAULT 'LeptaSys',
      from_email TEXT NOT NULL DEFAULT 'webmaster@lepta.com.br',
      to_finance_email TEXT NOT NULL DEFAULT 'pagamentos@lepta.com.br',
      app_base_url TEXT NOT NULL DEFAULT 'https://lepta.com.br',
      updated_by TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  // Se não existir registro padrão, inicializa com os dados do Office 365 e a senha padrão
  const existing = db.prepare(`SELECT * FROM configuracao_email WHERE id = 'default'`).get();
  if (!existing) {
    const initialPass = process.env.SMTP_PASS || process.env.LEPTA_SMTP_PASS || 'Lepta@2026';
    const encryptedPass = encryptPassword(initialPass);
    db.prepare(`
      INSERT INTO configuracao_email (
        id, host, port, secure, user, pass_encrypted, from_name, from_email,
        to_finance_email, app_base_url, updated_by, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'default',
      process.env.SMTP_HOST || 'smtp.office365.com',
      Number(process.env.SMTP_PORT) || 587,
      process.env.SMTP_SECURE === 'true' ? 1 : 0,
      process.env.SMTP_USER || 'webmaster@lepta.com.br',
      encryptedPass,
      'LeptaSys',
      process.env.SMTP_FROM_EMAIL || 'webmaster@lepta.com.br',
      process.env.FINANCE_NOTIFICATION_EMAIL || 'pagamentos@lepta.com.br',
      process.env.APP_BASE_URL || 'https://lepta.com.br',
      'sistema',
      new Date().toISOString()
    );
  }
}

/**
 * Obtém a configuração ativa (prioriza banco de dados, com fallback para .env)
 */
export function getActiveEmailConfig(db) {
  let dbRow = null;
  try {
    if (db) {
      ensureEmailConfigTable(db);
      dbRow = db.prepare(`SELECT * FROM configuracao_email WHERE id = 'default'`).get();
    }
  } catch (err) {
    console.warn('Aviso ao consultar configuracao_email no SQLite:', err.message);
  }

  const host = dbRow?.host || process.env.SMTP_HOST || 'smtp.office365.com';
  const port = Number(dbRow?.port) || Number(process.env.SMTP_PORT) || 587;
  const secure = dbRow ? Boolean(dbRow.secure) : (process.env.SMTP_SECURE === 'true');
  const user = dbRow?.user || process.env.SMTP_USER || 'webmaster@lepta.com.br';
  const decryptedPass = dbRow?.pass_encrypted ? decryptPassword(dbRow.pass_encrypted) : null;
  const pass = decryptedPass || process.env.SMTP_PASS || process.env.LEPTA_SMTP_PASS || 'Lepta@2026';
  const fromName = dbRow?.from_name || 'LeptaSys';
  const fromEmail = dbRow?.from_email || user;
  const toFinance = dbRow?.to_finance_email || process.env.FINANCE_NOTIFICATION_EMAIL || 'pagamentos@lepta.com.br';
  const appBaseUrl = dbRow?.app_base_url || process.env.APP_BASE_URL || 'https://lepta.com.br';

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromName,
    fromEmail,
    from: `"${fromName}" <${fromEmail}>`,
    to: toFinance,
    appBaseUrl,
    hasPassword: Boolean(pass)
  };
}

/**
 * Cria o transporter nodemailer baseado nas configurações
 */
function createTransporter(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure && config.port === 587,
    auth: {
      user: config.user,
      pass: config.pass
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    }
  });
}

function formatBrl(val) {
  const num = Number(val) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return dateStr;
  }
}

/**
 * Testa a conexão SMTP e envio de e-mail de teste
 */
export async function testSmtpConnection(config, testRecipient) {
  try {
    const transporter = createTransporter(config);
    await transporter.verify();

    const targetEmail = testRecipient || config.to || 'pagamentos@lepta.com.br';
    const info = await transporter.sendMail({
      from: config.from,
      to: targetEmail,
      subject: `[LeptaSys] Teste de Conexão SMTP - ${new Date().toLocaleTimeString('pt-BR')}`,
      html: `
        <div style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; border-radius: 8px;">
          <h2 style="color: #38bdf8; margin-top: 0;">✅ Teste de Conexão SMTP Bem-Sucedido!</h2>
          <p>O LeptaSys conseguiu autenticar e disparar este e-mail através do servidor <strong>${config.host}:${config.port}</strong>.</p>
          <p><strong>Remetente configurado:</strong> ${config.from}</p>
          <p><strong>Data/Hora do teste:</strong> ${new Date().toLocaleString('pt-BR')}</p>
        </div>
      `
    });

    return { success: true, message: `E-mail de teste enviado com sucesso para ${targetEmail}!`, messageId: info.messageId };
  } catch (error) {
    console.error('❌ [EmailService] Erro no teste SMTP:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Envia e-mail para pagamentos@lepta.com.br quando uma solicitação é aprovada
 */
export async function sendPurchaseApprovalEmail({ db, requisicao, itens = [], anexos = [], aprovadorNome = 'Aprovador', uploadDir }) {
  try {
    const config = getActiveEmailConfig(db);

    if (!config.pass) {
      console.warn('⚠️ [EmailService] Senha SMTP não configurada. E-mail simulado em log.');
      console.log(`📧 [Simulação E-mail para ${config.to}] Solicitação #${requisicao.numero || requisicao.id} aprovada por ${aprovadorNome}.`);
      return { success: true, simulated: true };
    }

    const t = createTransporter(config);
    const numeroStr = requisicao.numero ? `#${requisicao.numero}` : requisicao.id;
    const valorTotal = (requisicao.valor || 0) * (requisicao.quantidade || 1);
    const viewUrl = `${config.appBaseUrl}/financeiro/reembolsos-despesas?id=${encodeURIComponent(requisicao.id)}`;

    // Monta anexos físicos para o nodemailer
    const emailAttachments = [];
    if (anexos && anexos.length > 0 && uploadDir) {
      for (const a of anexos) {
        if (a.caminho_arquivo) {
          const filePath = path.join(uploadDir, a.caminho_arquivo);
          if (fs.existsSync(filePath)) {
            emailAttachments.push({
              filename: a.nome_arquivo || path.basename(filePath),
              path: filePath
            });
          }
        }
      }
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
    .container { max-width: 650px; margin: 0 auto; background: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #1e3a8a, #3b82f6); padding: 24px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
    .header p { margin: 6px 0 0 0; color: #93c5fd; font-size: 14px; }
    .content { padding: 24px; }
    .badge { display: inline-block; padding: 6px 12px; border-radius: 20px; background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); font-size: 13px; font-weight: 700; margin-bottom: 16px; }
    .info-table { width: 100%; border-collapse: collapse; margin-top: 12px; margin-bottom: 24px; }
    .info-table td { padding: 10px 12px; border-bottom: 1px solid #334155; font-size: 14px; }
    .info-table td.label { color: #94a3b8; font-weight: 600; width: 38%; }
    .info-table td.value { color: #f8fafc; font-weight: 500; }
    .price-highlight { color: #34d399; font-size: 18px; font-weight: 800; }
    .btn-container { text-align: center; margin: 30px 0 15px 0; }
    .btn-action { display: inline-block; background: linear-gradient(135deg, #2563eb, #3b82f6); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4); }
    .footer { padding: 16px 24px; background: #0f172a; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #1e293b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>LeptaSys - Notificação Financeira</h1>
      <p>Uma nova solicitação foi aprovada e enviada para pagamento</p>
    </div>
    
    <div class="content">
      <div style="text-align: center;">
        <span class="badge">✓ SOLICITAÇÃO APROVADA</span>
      </div>

      <table class="info-table">
        <tr>
          <td class="label">Código / Número:</td>
          <td class="value"><strong>${numeroStr}</strong> (${requisicao.id})</td>
        </tr>
        <tr>
          <td class="label">Fornecedor / Prestador:</td>
          <td class="value"><strong>${requisicao.fornecedor_nome || 'Não informado'}</strong>${requisicao.fornecedor_contato ? ` (${requisicao.fornecedor_contato})` : ''}</td>
        </tr>
        <tr>
          <td class="label">Descrição / Serviço:</td>
          <td class="value">${requisicao.produto_servico}</td>
        </tr>
        <tr>
          <td class="label">Valor Total:</td>
          <td class="value"><span class="price-highlight">${formatBrl(valorTotal)}</span></td>
        </tr>
        <tr>
          <td class="label">Empresa Pagadora:</td>
          <td class="value" style="color: #a5b4fc; font-weight: 700;">${requisicao.empresa_pagadora || 'INDIFERENTE'}</td>
        </tr>
        <tr>
          <td class="label">Forma de Pagamento:</td>
          <td class="value" style="color: #60a5fa; font-weight: 600;">
            ${requisicao.forma_pagamento || '-'}
            ${(requisicao.quantidade_parcelas || 1) > 1 ? ` (${requisicao.quantidade_parcelas}x parcelas)` : ' (À vista)'}
          </td>
        </tr>
        <tr>
          <td class="label">Centro de Custo:</td>
          <td class="value">${requisicao.departamento_centro_custo || 'Não informado'}</td>
        </tr>
        <tr>
          <td class="label">Solicitante:</td>
          <td class="value">${requisicao.solicitante_nome} (${requisicao.solicitante_email || 'Sem e-mail'})</td>
        </tr>
        <tr>
          <td class="label">Aprovado Por:</td>
          <td class="value">${aprovadorNome} em ${formatDate(requisicao.decidido_em || new Date().toISOString())}</td>
        </tr>
        ${requisicao.observacoes ? `
        <tr>
          <td class="label">Observações:</td>
          <td class="value" style="font-style: italic;">${requisicao.observacoes}</td>
        </tr>` : ''}
        ${emailAttachments.length > 0 ? `
        <tr>
          <td class="label">Anexos Vinculados:</td>
          <td class="value">📎 ${emailAttachments.length} arquivo(s) em anexo neste e-mail</td>
        </tr>` : ''}
      </table>

      <div class="btn-container">
        <a href="${viewUrl}" class="btn-action" target="_blank">
          Visualizar Solicitação no Sistema &rarr;
        </a>
      </div>

      <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 20px;">
        Ao clicar no botão acima, você será direcionado diretamente para os detalhes desta solicitação no LeptaSys.
      </p>
    </div>

    <div class="footer">
      Mensagem gerada automaticamente pelo LeptaSys • Grupo Lepta<br>
      Remetente: ${config.from}
    </div>
  </div>
</body>
</html>
    `;

    const mailOptions = {
      from: config.from,
      to: config.to,
      subject: `[LeptaSys] Solicitação Aprovada ${numeroStr} - ${requisicao.fornecedor_nome || requisicao.produto_servico} (${formatBrl(valorTotal)})`,
      html: htmlContent,
      attachments: emailAttachments
    };

    const info = await t.sendMail(mailOptions);
    console.log(`✅ [EmailService] E-mail de aprovação enviado com sucesso para ${config.to}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ [EmailService] Erro ao enviar e-mail de aprovação:', error.message);
    return { success: false, error: error.message };
  }
}
