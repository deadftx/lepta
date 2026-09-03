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
      auth_type TEXT NOT NULL DEFAULT 'GRAPH', -- 'GRAPH' ou 'SMTP'
      azure_tenant_id TEXT DEFAULT 'f376d8b7-1a55-4cfb-a8e1-3e2799e0918e',
      azure_client_id TEXT DEFAULT '27281728-09ae-4d31-9fa6-3c93f748e78b',
      azure_client_secret_encrypted TEXT,
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
    CREATE TABLE IF NOT EXISTS configuracao_email_fluxo (
      evento TEXT PRIMARY KEY,
      destinatarios_json TEXT NOT NULL DEFAULT '[]',
      notificar_solicitante INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    );
  `);

  // Migração automática de colunas para suportar Entra ID / Microsoft Graph
  try {
    const cols = db.prepare('PRAGMA table_info(configuracao_email)').all().map(c => c.name.toLowerCase());
    if (!cols.includes('auth_type')) db.exec("ALTER TABLE configuracao_email ADD COLUMN auth_type TEXT DEFAULT 'GRAPH'");
    if (!cols.includes('azure_tenant_id')) db.exec("ALTER TABLE configuracao_email ADD COLUMN azure_tenant_id TEXT DEFAULT 'f376d8b7-1a55-4cfb-a8e1-3e2799e0918e'");
    if (!cols.includes('azure_client_id')) db.exec("ALTER TABLE configuracao_email ADD COLUMN azure_client_id TEXT DEFAULT '27281728-09ae-4d31-9fa6-3c93f748e78b'");
    if (!cols.includes('azure_client_secret_encrypted')) db.exec("ALTER TABLE configuracao_email ADD COLUMN azure_client_secret_encrypted TEXT");
  } catch (err) {
    console.warn('Aviso ao migrar colunas de Entra ID em configuracao_email:', err.message);
  }

  // Eventos padrão do fluxo financeiro
  const DEFAULT_EVENTOS = [
    { evento: 'SOLICITACAO_CRIADA', notificar_solicitante: 1, destinatarios: [] },
    { evento: 'DIRETORIA_APROVADA', notificar_solicitante: 1, destinatarios: [] },
    { evento: 'DIRETORIA_NEGADA', notificar_solicitante: 1, destinatarios: 1 },
    { evento: 'JURIDICO_APROVADO', notificar_solicitante: 1, destinatarios: [] },
    { evento: 'JURIDICO_NEGADO', notificar_solicitante: 1, destinatarios: 1 },
    { evento: 'FINANCEIRO_RECEBIDA', notificar_solicitante: 0, destinatarios: [{ type: 'CUSTOM', email: 'pagamentos@lepta.com.br', name: 'Financeiro' }] },
    { evento: 'FINANCEIRO_AGENDADA', notificar_solicitante: 1, destinatarios: [] },
    { evento: 'FINANCEIRO_PAGA', notificar_solicitante: 1, destinatarios: [] },
    { evento: 'FINANCEIRO_REJEITADA', notificar_solicitante: 1, destinatarios: [] }
  ];

  const checkEventoStmt = db.prepare(`SELECT evento FROM configuracao_email_fluxo WHERE evento = ?`);
  const insertEventoStmt = db.prepare(`
    INSERT INTO configuracao_email_fluxo (evento, destinatarios_json, notificar_solicitante, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const ev of DEFAULT_EVENTOS) {
    const row = checkEventoStmt.get(ev.evento);
    if (!row) {
      insertEventoStmt.run(
        ev.evento,
        JSON.stringify(ev.destinatarios),
        ev.notificar_solicitante ? 1 : 0,
        new Date().toISOString(),
        'sistema'
      );
    }
  }

  const existing = db.prepare(`SELECT * FROM configuracao_email WHERE id = 'default'`).get();
  const initialAzureSecret = process.env.AZURE_CLIENT_SECRET || '';
  const encryptedAzureSecret = initialAzureSecret ? encryptPassword(initialAzureSecret) : null;

  if (!existing) {
    const initialPass = process.env.SMTP_PASS || process.env.LEPTA_SMTP_PASS || 'Lepta@2026';
    const encryptedPass = encryptPassword(initialPass);
    db.prepare(`
      INSERT INTO configuracao_email (
        id, auth_type, azure_tenant_id, azure_client_id, azure_client_secret_encrypted,
        host, port, secure, user, pass_encrypted, from_name, from_email,
        to_finance_email, app_base_url, updated_by, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'default',
      'GRAPH',
      'f376d8b7-1a55-4cfb-a8e1-3e2799e0918e',
      '27281728-09ae-4d31-9fa6-3c93f748e78b',
      encryptedAzureSecret,
      process.env.SMTP_HOST || 'smtp.office365.com',
      Number(process.env.SMTP_PORT) || 587,
      process.env.SMTP_SECURE === 'true' ? 1 : 0,
      'sistema@lepta.com.br',
      encryptedPass,
      'LeptaSys',
      'sistema@lepta.com.br',
      process.env.FINANCE_NOTIFICATION_EMAIL || 'pagamentos@lepta.com.br',
      process.env.APP_BASE_URL || 'https://lepta.com.br',
      'sistema',
      new Date().toISOString()
    );
  } else {
    // Garante que o remetente padrão seja sistema@lepta.com.br e configure o Entra ID
    db.prepare(`
      UPDATE configuracao_email
      SET auth_type = 'GRAPH',
          from_email = 'sistema@lepta.com.br',
          user = 'sistema@lepta.com.br',
          azure_tenant_id = COALESCE(azure_tenant_id, 'f376d8b7-1a55-4cfb-a8e1-3e2799e0918e'),
          azure_client_id = COALESCE(azure_client_id, '27281728-09ae-4d31-9fa6-3c93f748e78b'),
          azure_client_secret_encrypted = COALESCE(azure_client_secret_encrypted, ?)
      WHERE id = 'default'
    `).run(encryptedAzureSecret);
  }
}

/**
 * Obtém token de aplicativo via Microsoft Entra ID (OAuth2 Client Credentials)
 */
export async function getMicrosoftGraphToken(tenantId, clientId, clientSecret) {
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('grant_type', 'client_credentials');

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Falha ao autenticar com Microsoft Entra ID.');
  }
  return data.access_token;
}

/**
 * Dispara e-mail utilizando a API oficial Microsoft Graph (Exchange Online)
 */
export async function sendEmailViaMicrosoftGraph({
  tenantId,
  clientId,
  clientSecret,
  fromEmail,
  toEmails,
  subject,
  htmlContent,
  attachments = []
}) {
  const accessToken = await getMicrosoftGraphToken(tenantId, clientId, clientSecret);

  const graphAttachments = [];
  if (attachments && attachments.length > 0) {
    for (const a of attachments) {
      if (a.path && fs.existsSync(a.path)) {
        try {
          const fileBytes = fs.readFileSync(a.path);
          graphAttachments.push({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: a.filename || path.basename(a.path),
            contentType: a.contentType || 'application/octet-stream',
            contentBytes: fileBytes.toString('base64')
          });
        } catch (readErr) {
          console.warn('Aviso ao ler anexo para Graph API:', readErr.message);
        }
      }
    }
  }

  const messagePayload = {
    message: {
      subject,
      body: {
        contentType: 'HTML',
        content: htmlContent
      },
      toRecipients: toEmails.map(e => ({
        emailAddress: { address: e }
      })),
      ...(graphAttachments.length > 0 ? { attachments: graphAttachments } : {})
    },
    saveToSentItems: true
  };

  const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(fromEmail)}/sendMail`;
  const res = await fetch(sendMailUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(messagePayload)
  });

  if (!res.ok) {
    let errorDetail = '';
    try {
      const errJson = await res.json();
      errorDetail = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      errorDetail = await res.text();
    }

    if (res.status === 403 || errorDetail.includes('Authorization_RequestDenied') || errorDetail.includes('Access is denied')) {
      throw new Error(`Permissão Mail.Send pendente de consentimento: O aplicativo no Entra ID necessita que um Administrador Geral clique no botão "Conceder consentimento do administrador para Lepta" no Azure.`);
    }
    if (res.status === 404 || errorDetail.includes('ResourceNotFound') || errorDetail.includes('MailboxNotEnabledForRESTAPI')) {
      throw new Error(`A caixa postal remetente "${fromEmail}" não foi encontrada no Microsoft 365 ou não possui licença do Exchange ativa.`);
    }

    throw new Error(`Erro Microsoft Graph (${res.status}): ${errorDetail}`);
  }

  return { success: true, messageId: `graph-${Date.now()}` };
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

  const authType = dbRow?.auth_type || 'GRAPH';
  const azureTenantId = dbRow?.azure_tenant_id || 'f376d8b7-1a55-4cfb-a8e1-3e2799e0918e';
  const azureClientId = dbRow?.azure_client_id || '27281728-09ae-4d31-9fa6-3c93f748e78b';
  const decryptedAzureSecret = dbRow?.azure_client_secret_encrypted ? decryptPassword(dbRow.azure_client_secret_encrypted) : null;
  const azureClientSecret = decryptedAzureSecret || process.env.AZURE_CLIENT_SECRET || '';

  const host = dbRow?.host || process.env.SMTP_HOST || 'smtp.office365.com';
  const port = Number(dbRow?.port) || Number(process.env.SMTP_PORT) || 587;
  const secure = dbRow ? Boolean(dbRow.secure) : (process.env.SMTP_SECURE === 'true');
  const user = dbRow?.user || process.env.SMTP_USER || 'sistema@lepta.com.br';
  const decryptedPass = dbRow?.pass_encrypted ? decryptPassword(dbRow.pass_encrypted) : null;
  const pass = decryptedPass || process.env.SMTP_PASS || process.env.LEPTA_SMTP_PASS || 'Lepta@2026';
  const fromName = dbRow?.from_name || 'LeptaSys';
  const fromEmail = dbRow?.from_email || user || 'sistema@lepta.com.br';
  const toFinance = dbRow?.to_finance_email || process.env.FINANCE_NOTIFICATION_EMAIL || 'pagamentos@lepta.com.br';
  const appBaseUrl = dbRow?.app_base_url || process.env.APP_BASE_URL || 'https://lepta.com.br';

  return {
    authType,
    azureTenantId,
    azureClientId,
    azureClientSecret,
    hasAzureSecret: Boolean(azureClientSecret),
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
 * Testa a conexão (Microsoft Graph ou SMTP) e envio de e-mail de teste
 */
export async function testSmtpConnection(config, testRecipient) {
  try {
    const targetEmail = testRecipient || config.to || 'pagamentos@lepta.com.br';

    if (config.authType === 'GRAPH') {
      if (!config.azureClientSecret) {
        return { success: false, error: 'O segredo do cliente (Client Secret) do Entra ID não foi informado.' };
      }

      // 1. Testa aquisição do token OAuth2
      await getMicrosoftGraphToken(config.azureTenantId, config.azureClientId, config.azureClientSecret);

      // 2. Tenta envio pelo Graph API
      try {
        await sendEmailViaMicrosoftGraph({
          tenantId: config.azureTenantId,
          clientId: config.azureClientId,
          clientSecret: config.azureClientSecret,
          fromEmail: config.fromEmail,
          toEmails: [targetEmail],
          subject: `[LeptaSys] Teste Microsoft Entra ID - ${new Date().toLocaleTimeString('pt-BR')}`,
          htmlContent: `
            <div style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 20px; border-radius: 8px;">
              <h2 style="color: #38bdf8; margin-top: 0;">✅ Teste Microsoft Entra ID (Graph API) Bem-Sucedido!</h2>
              <p>O LeptaSys autenticou via OAuth2 com o locatário <strong>${config.azureTenantId}</strong> e disparou este e-mail através da API oficial da Microsoft.</p>
              <p><strong>Remetente configurado:</strong> ${config.fromEmail}</p>
              <p><strong>Data/Hora do teste:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            </div>
          `
        });

        return {
          success: true,
          message: `E-mail de teste enviado com sucesso via Microsoft Graph para ${targetEmail}!`
        };
      } catch (graphErr) {
        if (graphErr.message.includes('Permissão Mail.Send pendente de consentimento')) {
          return {
            success: false,
            adminConsentPending: true,
            error: `Autenticação com o Entra ID realizada com sucesso! Porém, a permissão "Mail.Send" ainda necessita do consentimento de administrador no Azure para que o envio seja liberado.`
          };
        }
        throw graphErr;
      }
    }

    const transporter = createTransporter(config);
    await transporter.verify();

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
    console.error('❌ [EmailService] Erro no teste de e-mail:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Envia e-mail para pagamentos@lepta.com.br quando uma solicitação é aprovada
 */
export async function sendPurchaseApprovalEmail({ db, requisicao, itens = [], anexos = [], aprovadorNome = 'Aprovador', uploadDir }) {
  try {
    const config = getActiveEmailConfig(db);

    if (config.authType === 'SMTP' && !config.pass) {
      console.warn('⚠️ [EmailService] Senha SMTP não configurada. E-mail simulado em log.');
      console.log(`📧 [Simulação E-mail para ${config.to}] Solicitação #${requisicao.numero || requisicao.id} aprovada por ${aprovadorNome}.`);
      return { success: true, simulated: true };
    }

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

    if (config.authType === 'GRAPH') {
      const graphRes = await sendEmailViaMicrosoftGraph({
        tenantId: config.azureTenantId,
        clientId: config.azureClientId,
        clientSecret: config.azureClientSecret,
        fromEmail: config.fromEmail,
        toEmails: [config.to],
        subject: `[LeptaSys] Solicitação Aprovada ${numeroStr} - ${requisicao.fornecedor_nome || requisicao.produto_servico} (${formatBrl(valorTotal)})`,
        htmlContent,
        attachments: emailAttachments
      });
      console.log(`✅ [EmailService] E-mail de aprovação enviado com sucesso via Graph API para ${config.to}.`);
      return graphRes;
    }

    const t = createTransporter(config);
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

/**
 * Envia notificação por e-mail para qualquer evento do fluxo de solicitações financeiras
 */
export async function sendFinancialWorkflowEmail({
  db,
  evento,
  requisicao,
  detalhes = {},
  autorNome = 'Sistema',
  motivo = '',
  anexos = [],
  uploadDir
}) {
  try {
    if (!db || !evento || !requisicao) return { success: false, error: 'Parâmetros insuficientes' };

    ensureEmailConfigTable(db);
    const config = getActiveEmailConfig(db);

    // Carrega a configuração do evento
    const row = db.prepare('SELECT * FROM configuracao_email_fluxo WHERE evento = ?').get(evento);
    if (!row) return { success: true, skipped: 'Evento não configurado' };

    let destinatarios = [];
    try {
      destinatarios = JSON.parse(row.destinatarios_json || '[]');
    } catch (_) {}

    const emailSet = new Set();
    for (const d of destinatarios) {
      if (d?.email && typeof d.email === 'string') {
        emailSet.add(d.email.trim().toLowerCase());
      }
    }

    // Notifica solicitante se configurado
    if (row.notificar_solicitante === 1 && requisicao.solicitante_email) {
      emailSet.add(requisicao.solicitante_email.trim().toLowerCase());
    }

    const toEmails = Array.from(emailSet).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (toEmails.length === 0) {
      return { success: true, skipped: 'Nenhum destinatário configurado para este evento' };
    }

    if (config.authType === 'SMTP' && !config.pass) {
      console.warn(`⚠️ [EmailService] Senha SMTP não configurada. E-mail de fluxo (${evento}) simulado para:`, toEmails);
      return { success: true, simulated: true, recipients: toEmails };
    }
    if (config.authType === 'GRAPH' && !config.azureClientSecret) {
      console.warn(`⚠️ [EmailService] Segredo Entra ID não configurado. E-mail de fluxo (${evento}) simulado para:`, toEmails);
      return { success: true, simulated: true, recipients: toEmails };
    }

    const numeroStr = requisicao.numero ? `#${requisicao.numero}` : requisicao.id;
    const valorTotal = (requisicao.valor || 0) * (requisicao.quantidade || 1);
    const viewUrl = `${config.appBaseUrl}/financeiro/reembolsos-despesas?id=${encodeURIComponent(requisicao.id)}`;

    // Definições visuais por evento
    const EVENT_STYLES = {
      SOLICITACAO_CRIADA: {
        title: 'Nova Solicitação Financeira Criada',
        badge: 'NOVA SOLICITAÇÃO',
        badgeColor: '#38bdf8',
        badgeBg: 'rgba(56, 189, 248, 0.2)',
        headerBg: 'linear-gradient(135deg, #0369a1, #0ea5e9)',
        subtitle: `Uma nova solicitação foi cadastrada por ${requisicao.solicitante_nome} e aguarda análise.`
      },
      DIRETORIA_APROVADA: {
        title: 'Solicitação Aprovada pela Diretoria',
        badge: 'APROVADA PELA DIRETORIA',
        badgeColor: '#4ade80',
        badgeBg: 'rgba(74, 222, 128, 0.2)',
        headerBg: 'linear-gradient(135deg, #15803d, #22c55e)',
        subtitle: `A solicitação foi aprovada pela Diretoria (${autorNome}).`
      },
      DIRETORIA_NEGADA: {
        title: 'Solicitação Recusada pela Diretoria',
        badge: 'RECUSADA PELA DIRETORIA',
        badgeColor: '#f87171',
        badgeBg: 'rgba(248, 113, 113, 0.2)',
        headerBg: 'linear-gradient(135deg, #991b1b, #ef4444)',
        subtitle: `A solicitação foi recusada pela Diretoria (${autorNome}).`
      },
      JURIDICO_APROVADO: {
        title: 'Parecer Jurídico Aprovado',
        badge: 'JURÍDICO APROVADO',
        badgeColor: '#c084fc',
        badgeBg: 'rgba(192, 132, 252, 0.2)',
        headerBg: 'linear-gradient(135deg, #6b21a8, #a855f7)',
        subtitle: `O departamento Jurídico (${autorNome}) emitiu parecer favorável à solicitação.`
      },
      JURIDICO_NEGADO: {
        title: 'Parecer Jurídico Reprovado',
        badge: 'JURÍDICO RECUSADO',
        badgeColor: '#f87171',
        badgeBg: 'rgba(248, 113, 113, 0.2)',
        headerBg: 'linear-gradient(135deg, #991b1b, #ef4444)',
        subtitle: `O departamento Jurídico (${autorNome}) reprovou a solicitação.`
      },
      FINANCEIRO_RECEBIDA: {
        title: 'Solicitação Disponível no Financeiro',
        badge: 'AGUARDANDO PAGAMENTO',
        badgeColor: '#38bdf8',
        badgeBg: 'rgba(56, 189, 248, 0.2)',
        headerBg: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
        subtitle: `A solicitação foi validada e está disponível na fila de pagamentos do Financeiro.`
      },
      FINANCEIRO_AGENDADA: {
        title: 'Pagamento Agendado pelo Financeiro',
        badge: 'PAGAMENTO AGENDADO',
        badgeColor: '#fbbf24',
        badgeBg: 'rgba(251, 191, 36, 0.2)',
        headerBg: 'linear-gradient(135deg, #b45309, #f59e0b)',
        subtitle: `O Financeiro agendou a liquidação prevista para ${formatDate(requisicao.data_pagamento || detalhes?.data_pagamento)}.`
      },
      FINANCEIRO_PAGA: {
        title: 'Pagamento Concluído pelo Financeiro',
        badge: 'PAGAMENTO EFETUADO',
        badgeColor: '#4ade80',
        badgeBg: 'rgba(74, 222, 128, 0.2)',
        headerBg: 'linear-gradient(135deg, #166534, #15803d)',
        subtitle: `O pagamento desta solicitação foi baixado e concluído com sucesso.`
      },
      FINANCEIRO_REJEITADA: {
        title: 'Solicitação Devolvida para Revisão',
        badge: 'DEVOLVIDA PARA REVISÃO',
        badgeColor: '#fb923c',
        badgeBg: 'rgba(251, 146, 60, 0.2)',
        headerBg: 'linear-gradient(135deg, #c2410c, #ea580c)',
        subtitle: `O Financeiro (${autorNome}) devolveu a solicitação para revisão do solicitante.`
      }
    };

    const style = EVENT_STYLES[evento] || {
      title: 'Atualização na Solicitação Financeira',
      badge: 'ATUALIZAÇÃO',
      badgeColor: '#38bdf8',
      badgeBg: 'rgba(56, 189, 248, 0.2)',
      headerBg: 'linear-gradient(135deg, #1e293b, #334155)',
      subtitle: `Houve uma movimentação na solicitação financeira.`
    };

    // Anexos
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
    .header { background: ${style.headerBg}; padding: 24px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; }
    .header p { margin: 6px 0 0 0; color: #f1f5f9; font-size: 14px; opacity: 0.95; }
    .content { padding: 24px; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 20px; background: ${style.badgeBg}; color: ${style.badgeColor}; border: 1px solid ${style.badgeColor}; font-size: 13px; font-weight: 700; margin-bottom: 16px; }
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
      <h1>${style.title}</h1>
      <p>${style.subtitle}</p>
    </div>
    
    <div class="content">
      <div style="text-align: center;">
        <span class="badge">● ${style.badge}</span>
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
        ${autorNome ? `
        <tr>
          <td class="label">Responsável pela Ação:</td>
          <td class="value"><strong>${autorNome}</strong> em ${formatDate(new Date().toISOString())}</td>
        </tr>` : ''}
        ${(motivo || requisicao.motivo_decisao || requisicao.juridico_motivo) ? `
        <tr>
          <td class="label">Motivo / Parecer:</td>
          <td class="value" style="color: #fca5a5; font-style: italic;">${motivo || requisicao.motivo_decisao || requisicao.juridico_motivo}</td>
        </tr>` : ''}
        ${requisicao.data_pagamento ? `
        <tr>
          <td class="label">Data de Pagamento:</td>
          <td class="value" style="color: #fde047; font-weight: 700;">${formatDate(requisicao.data_pagamento)}</td>
        </tr>` : ''}
        ${emailAttachments.length > 0 ? `
        <tr>
          <td class="label">Anexos:</td>
          <td class="value">📎 ${emailAttachments.length} arquivo(s) em anexo</td>
        </tr>` : ''}
      </table>

      <div class="btn-container">
        <a href="${viewUrl}" class="btn-action" target="_blank">
          Visualizar Solicitação no Sistema &rarr;
        </a>
      </div>
    </div>

    <div class="footer">
      Mensagem gerada automaticamente pelo LeptaSys • Grupo Lepta<br>
      Remetente: ${config.from}
    </div>
  </div>
</body>
</html>
    `;

    const subjectStr = `[LeptaSys] ${style.badge} ${numeroStr} - ${requisicao.fornecedor_nome || requisicao.produto_servico} (${formatBrl(valorTotal)})`;

    if (config.authType === 'GRAPH') {
      const graphRes = await sendEmailViaMicrosoftGraph({
        tenantId: config.azureTenantId,
        clientId: config.azureClientId,
        clientSecret: config.azureClientSecret,
        fromEmail: config.fromEmail,
        toEmails,
        subject: subjectStr,
        htmlContent,
        attachments: emailAttachments
      });
      console.log(`✅ [EmailService] Notificação [${evento}] enviada com sucesso via Graph API para [${toEmails.join(', ')}].`);
      return { ...graphRes, recipients: toEmails };
    }

    const t = createTransporter(config);
    const mailOptions = {
      from: config.from,
      to: toEmails.join(', '),
      subject: subjectStr,
      html: htmlContent,
      attachments: emailAttachments
    };

    const info = await t.sendMail(mailOptions);
    console.log(`✅ [EmailService] Notificação [${evento}] enviada com sucesso para [${toEmails.join(', ')}]. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId, recipients: toEmails };
  } catch (err) {
    console.error(`❌ [EmailService] Erro ao enviar notificação de fluxo [${evento}]:`, err.message);
    return { success: false, error: err.message };
  }
}
