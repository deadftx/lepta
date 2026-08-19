import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Database,
  Edit3,
  ExternalLink,
  Mail,
  MapPin,
  Network,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserRound,
  X
} from 'lucide-react';
import { API_BASE_URL } from '../../../../config/api';
import './CustomerRegistration.css';

interface Address {
  id?: number;
  valido?: boolean;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  localidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

interface EconomicGroup {
  id?: number;
  valido?: boolean;
  nome?: string | null;
}

interface Contact {
  nome?: string | null;
  telefone?: string | null;
  fonte?: 'local' | 'api';
}

interface Entity {
  id?: number;
  valido?: boolean;
  documento?: string | null;
  nome?: string | null;
  email?: string | null;
  telefone?: string | null;
  contatos?: Contact[] | null;
  tipo?: string | null;
  endereco?: Address | null;
  grupoEconomico?: EconomicGroup | null;
}

interface OperationalAccount {
  id?: number;
  valido?: boolean;
  sigla?: string | null;
  limite?: number | null;
  tranche?: number | null;
  produto?: { descricao?: string | null } | null;
  unidadeAdministrativa?: { alias?: string | null; empresa?: Entity | null } | null;
}

interface GraphicAccount {
  id?: number;
  valido?: boolean;
  descricao?: string | null;
  saldo?: number | null;
  lancamentos?: unknown[] | null;
  unidadeAdministrativa?: { alias?: string | null } | null;
}

interface ClientData {
  id?: number;
  valido?: boolean;
  entidade: Entity;
  contasOperacionais?: OperationalAccount[] | null;
  contasGraficas?: GraphicAccount[] | null;
}

interface ComposedClient {
  data: ClientData;
  source: 'api' | 'api+local' | 'local';
  hasLocalData: boolean;
  localOnly: boolean;
  apiAvailable: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
  warning?: string | null;
}

interface ClientSummary {
  documento: string;
  nome: string;
  telefone: string;
  email: string;
  tipo: string;
  grupoEconomico: string;
  source: 'api' | 'api+local' | 'local';
  hasLocalData: boolean;
  localOnly: boolean;
  apiAvailable: boolean;
  updatedAt?: string | null;
}

const emptyClient = (): ClientData => ({
  entidade: {
    documento: '',
    nome: '',
    email: '',
    telefone: '',
    contatos: [{ nome: '', telefone: '', fonte: 'local' }],
    tipo: 'PJ',
    valido: true,
    endereco: {
      logradouro: '', numero: '', complemento: '', bairro: '',
      localidade: '', estado: '', cep: '', valido: true
    },
    grupoEconomico: null
  },
  contasOperacionais: [],
  contasGraficas: []
});

const cloneData = (data: ClientData) => JSON.parse(JSON.stringify(data)) as ClientData;

const formatDocument = (value?: string | null) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return value || 'Não informado';
};

const formatCurrency = (value?: number | null) => value === null || value === undefined
  ? '—'
  : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const phoneHref = (value?: string | null) => {
  const match = String(value || '').trim().match(/\+?\d[\d\s().-]{6,}\d/);
  if (!match) return '';
  const hasCountryPrefix = match[0].trim().startsWith('+');
  const digits = match[0].replace(/\D/g, '');
  return digits ? `tel:${hasCountryPrefix ? '+' : ''}${digits}` : '';
};

const sourceLabel = (source: ComposedClient['source']) => {
  if (source === 'api+local') return 'API + Banco Interno';
  if (source === 'local') return 'Banco Interno';
  return 'API UNLTD';
};

const CustomerRegistration = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<ClientSummary[]>([]);
  const [selectedClient, setSelectedClient] = useState<ComposedClient | null>(null);
  const [editData, setEditData] = useState<ClientData | null>(null);
  const [editing, setEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [suggestions, setSuggestions] = useState<ClientSummary[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const token = () => localStorage.getItem('lepta_auth_token');
  const authHeaders = () => ({ Authorization: `Bearer ${token()}` });

  const clientSearchUrl = (query: string) =>
    `${API_BASE_URL}/api/clientes-cadastro?search=${encodeURIComponent(query)}`;

  const readSearchResponse = async (response: Response) => {
    const payload = await response.json();
    if (!response.ok) {
      if (response.status === 404 && payload.error === 'Endpoint not found') {
        throw new Error('O servidor local está desatualizado. Reinicie o backend para ativar o Cadastro de Clientes.');
      }
      throw new Error(payload.error || 'Não foi possível buscar os clientes.');
    }
    return payload;
  };

  useEffect(() => {
    const query = searchTerm.trim();
    if (query.length < 2 || selectedClient) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      setShowSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setShowSuggestions(true);
      setSuggestionsLoading(true);
      try {
        const response = await fetch(clientSearchUrl(query), {
          headers: authHeaders(),
          signal: controller.signal
        });
        const payload = await readSearchResponse(response);
        setSuggestions((payload.results || []).slice(0, 8));
        setShowSuggestions(true);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        setSuggestions([]);
        setError(requestError instanceof Error ? requestError.message : 'Não foi possível buscar os clientes.');
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm, selectedClient]);

  const handleSearch = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (searchTerm.trim().length < 2) {
      setError('Digite pelo menos 2 caracteres do nome, CPF ou CNPJ.');
      return;
    }
    setLoading(true);
    setError('');
    setWarning('');
    setSearched(true);
    try {
      const response = await fetch(clientSearchUrl(searchTerm.trim()), {
        headers: authHeaders()
      });
      const payload = await readSearchResponse(response);
      setResults(payload.results || []);
      setSuggestions((payload.results || []).slice(0, 8));
      setShowSuggestions(false);
      setWarning(payload.warning ? 'A API apresentou instabilidade; resultados internos continuam disponíveis.' : '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível buscar os clientes.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const openClient = async (document: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/clientes-cadastro/${document}`, { headers: authHeaders() });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar o cliente.');
      setSelectedClient(payload);
      setEditData(cloneData(payload.data));
      setEditing(false);
      setIsNew(false);
      setShowSuggestions(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar o cliente.');
    } finally {
      setLoading(false);
    }
  };

  const openNewClient = () => {
    const data = emptyClient();
    setSelectedClient({
      data,
      source: 'local',
      hasLocalData: false,
      localOnly: true,
      apiAvailable: false
    });
    setEditData(cloneData(data));
    setEditing(true);
    setIsNew(true);
    setError('');
  };

  const updateEntity = (field: keyof Entity, value: string | boolean) => {
    setEditData(current => current ? {
      ...current,
      entidade: { ...current.entidade, [field]: value }
    } : current);
  };

  const updateContact = (index: number, field: 'nome' | 'telefone', value: string) => {
    setEditData(current => {
      if (!current) return current;
      const contacts = [...(current.entidade.contatos || [])];
      contacts[index] = { ...(contacts[index] || {}), [field]: value, fonte: 'local' };
      return {
        ...current,
        entidade: {
          ...current.entidade,
          contatos: contacts,
          telefone: contacts[0]?.telefone || ''
        }
      };
    });
  };

  const addContact = () => {
    setEditData(current => current ? {
      ...current,
      entidade: {
        ...current.entidade,
        contatos: [...(current.entidade.contatos || []), { nome: '', telefone: '', fonte: 'local' }]
      }
    } : current);
  };

  const removeContact = (index: number) => {
    setEditData(current => {
      if (!current) return current;
      const contacts = (current.entidade.contatos || []).filter((_, contactIndex) => contactIndex !== index);
      return {
        ...current,
        entidade: {
          ...current.entidade,
          contatos: contacts,
          telefone: contacts[0]?.telefone || ''
        }
      };
    });
  };

  const updateAddress = (field: keyof Address, value: string) => {
    setEditData(current => current ? {
      ...current,
      entidade: {
        ...current.entidade,
        endereco: { ...(current.entidade.endereco || {}), [field]: value }
      }
    } : current);
  };

  const updateEconomicGroup = (field: keyof EconomicGroup, value: string) => {
    setEditData(current => {
      if (!current) return current;
      const group = current.entidade.grupoEconomico || { valido: true };
      return {
        ...current,
        entidade: {
          ...current.entidade,
          grupoEconomico: {
            ...group,
            [field]: field === 'id' ? (value ? Number(value) : undefined) : value
          }
        }
      };
    });
  };

  const saveClient = async () => {
    if (!editData) return;
    const document = String(editData.entidade.documento || '').replace(/\D/g, '');
    if (![11, 14].includes(document.length)) {
      setError('Informe um CPF ou CNPJ válido.');
      return;
    }
    if (!String(editData.entidade.nome || '').trim()) {
      setError('Informe o nome do cliente.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const endpoint = isNew
        ? `${API_BASE_URL}/api/clientes-cadastro`
        : `${API_BASE_URL}/api/clientes-cadastro/${document}`;
      const response = await fetch(endpoint, {
        method: isNew ? 'POST' : 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: editData })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar o cadastro.');
      setSelectedClient(payload);
      setEditData(cloneData(payload.data));
      setEditing(false);
      setIsNew(false);
      setWarning('Cadastro salvo no banco interno. Os campos locais terão prioridade sobre a API.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar o cadastro.');
    } finally {
      setSaving(false);
    }
  };

  const removeLocalData = async () => {
    const document = String(selectedClient?.data?.entidade?.documento || '').replace(/\D/g, '');
    if (!document || !selectedClient?.hasLocalData) return;
    if (!window.confirm('Excluir os dados internos deste cliente? Os dados da API UNLTD não serão apagados.')) return;

    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/clientes-cadastro/${document}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível excluir os dados internos.');
      if (selectedClient.localOnly) {
        setSelectedClient(null);
        setEditData(null);
        await handleSearch();
      } else {
        await openClient(document);
        setWarning('Alterações internas removidas. O cadastro voltou a usar somente a API UNLTD.');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível excluir os dados internos.');
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    setSelectedClient(null);
    setEditData(null);
    setEditing(false);
    setIsNew(false);
    setError('');
  };

  if (selectedClient && editData) {
    const data = editing ? editData : selectedClient.data;
    const entity = data.entidade || {};
    const address = entity.endereco || {};
    const operationalAccounts = data.contasOperacionais || [];
    const graphicAccounts = data.contasGraficas || [];
    const contacts = entity.contatos || [];

    return (
      <div className="customer-registration-page customer-detail-page">
        <div className="customer-detail-toolbar">
          <button type="button" className="btn-outline" onClick={goBack}>
            <ArrowLeft size={18} /> Voltar para consulta
          </button>
          <div className="customer-detail-actions">
            {!editing && (
              <button type="button" className="btn-primary" onClick={() => setEditing(true)}>
                <Edit3 size={18} /> Editar cadastro
              </button>
            )}
            {editing && (
              <>
                <button type="button" className="btn-outline" onClick={() => {
                  if (isNew) goBack();
                  else {
                    setEditData(cloneData(selectedClient.data));
                    setEditing(false);
                  }
                }}>
                  <X size={18} /> Cancelar
                </button>
                <button type="button" className="btn-primary" onClick={saveClient} disabled={saving}>
                  <Save size={18} /> {saving ? 'Salvando...' : 'Salvar no banco interno'}
                </button>
              </>
            )}
            {!editing && selectedClient.hasLocalData && (
              <button type="button" className="btn-danger-soft" onClick={removeLocalData} disabled={saving}>
                <Trash2 size={17} /> Excluir dados internos
              </button>
            )}
          </div>
        </div>

        {error && <div className="registration-message error">{error}</div>}
        {warning && <div className="registration-message warning">{warning}</div>}

        <section className="customer-identity-card internal-card glass">
          <div className="customer-avatar-large"><Building2 size={34} /></div>
          <div className="customer-identity-main">
            {editing ? (
              <input className="registration-title-input" value={entity.nome || ''} onChange={event => updateEntity('nome', event.target.value)} placeholder="Nome ou razão social" />
            ) : (
              <h2>{entity.nome || 'Cliente sem nome'}</h2>
            )}
            <div className="customer-source-row">
              <span className={`source-pill ${selectedClient.source}`}>{sourceLabel(selectedClient.source)}</span>
              <span className="validity-pill">{entity.valido === false ? 'Cadastro inválido' : 'Cadastro válido'}</span>
              {!selectedClient.apiAvailable && !selectedClient.localOnly && <span className="offline-pill">API indisponível — usando cópia</span>}
            </div>
          </div>
          <div className="customer-document-highlight">
            <small>{entity.tipo === 'PF' ? 'CPF' : 'CNPJ'}</small>
            {editing && isNew ? (
              <input value={entity.documento || ''} onChange={event => updateEntity('documento', event.target.value)} placeholder="Somente números" />
            ) : (
              <strong>{formatDocument(entity.documento)}</strong>
            )}
          </div>
        </section>

        <div className="customer-detail-grid">
          <section className="detail-section internal-card glass">
            <div className="detail-section-title"><UserRound size={20} /><h3>Dados cadastrais</h3></div>
            <div className="detail-fields-grid">
              <DetailField icon={<Mail size={17} />} label="E-mail" value={entity.email} editing={editing} onChange={value => updateEntity('email', value)} />
              <div className="contact-field wide">
                <div className="contact-field-header">
                  <span><Phone size={17} /> Contatos e telefones</span>
                  {editing && (
                    <button type="button" className="add-contact-button" onClick={addContact}>
                      <Plus size={16} /> Adicionar contato
                    </button>
                  )}
                </div>
                <div className="contact-list">
                  {contacts.map((contact, index) => (
                    <div className="contact-row" key={`${contact.telefone || 'novo'}-${index}`}>
                      {editing ? (
                        <>
                          <input
                            value={contact.nome || ''}
                            onChange={event => updateContact(index, 'nome', event.target.value)}
                            placeholder="Nome do contato"
                            aria-label={`Nome do contato ${index + 1}`}
                          />
                          <input
                            value={contact.telefone || ''}
                            onChange={event => updateContact(index, 'telefone', event.target.value)}
                            placeholder="Telefone"
                            aria-label={`Telefone do contato ${index + 1}`}
                          />
                          <button type="button" className="remove-contact-button" onClick={() => removeContact(index)} aria-label={`Remover contato ${index + 1}`}>
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <strong>{contact.nome || 'Contato não informado'}</strong>
                          {contact.telefone && phoneHref(contact.telefone) ? (
                            <a className="phone-call-link" href={phoneHref(contact.telefone)} aria-label={`Ligar para ${contact.telefone}`} title="Ligar pelo aplicativo padrão">
                              <Phone size={15} />{contact.telefone}
                            </a>
                          ) : (
                            <span>Telefone não informado</span>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                  {!contacts.length && (
                    <div className="contact-empty">
                      Nenhum contato cadastrado.
                      {editing && <button type="button" onClick={addContact}><Plus size={15} /> Adicionar o primeiro</button>}
                    </div>
                  )}
                </div>
              </div>
              <DetailField label="Tipo" value={entity.tipo} editing={editing} onChange={value => updateEntity('tipo', value)} />
              <DetailField label="ID na UNLTD" value={entity.id?.toString()} />
              <DetailField label="ID do cliente" value={data.id?.toString()} />
              <DetailField label="Última alteração interna" value={selectedClient.updatedAt ? new Date(selectedClient.updatedAt).toLocaleString('pt-BR') : 'Sem alteração interna'} />
            </div>
          </section>

          <section className="detail-section internal-card glass">
            <div className="detail-section-title"><MapPin size={20} /><h3>Endereço</h3></div>
            <div className="detail-fields-grid address-grid">
              <DetailField label="Logradouro" value={address.logradouro} editing={editing} onChange={value => updateAddress('logradouro', value)} wide />
              <DetailField label="Número" value={address.numero} editing={editing} onChange={value => updateAddress('numero', value)} />
              <DetailField label="Complemento" value={address.complemento} editing={editing} onChange={value => updateAddress('complemento', value)} />
              <DetailField label="Bairro" value={address.bairro} editing={editing} onChange={value => updateAddress('bairro', value)} />
              <DetailField label="Cidade" value={address.localidade} editing={editing} onChange={value => updateAddress('localidade', value)} />
              <DetailField label="Estado" value={address.estado} editing={editing} onChange={value => updateAddress('estado', value)} />
              <DetailField label="CEP" value={address.cep} editing={editing} onChange={value => updateAddress('cep', value)} />
            </div>
          </section>
        </div>

        <section className="detail-section internal-card glass">
          <div className="detail-section-title"><Network size={20} /><h3>Grupo econômico</h3></div>
          <div className="detail-fields-grid">
            <DetailField label="Nome do grupo" value={entity.grupoEconomico?.nome} editing={editing} onChange={value => updateEconomicGroup('nome', value)} wide />
            <DetailField label="ID do grupo" value={entity.grupoEconomico?.id?.toString()} editing={editing} onChange={value => updateEconomicGroup('id', value)} />
            <DetailField label="Situação" value={entity.grupoEconomico ? (entity.grupoEconomico.valido === false ? 'Inválido' : 'Válido') : 'Sem grupo econômico'} />
          </div>
        </section>

        <section className="detail-section internal-card glass">
          <div className="detail-section-title section-title-with-count">
            <div><Database size={20} /><h3>Contas operacionais</h3></div>
            <span>{operationalAccounts.length} conta(s)</span>
          </div>
          <div className="registration-table-wrap">
            <table className="registration-table">
              <thead><tr><th>ID</th><th>Sigla</th><th>Produto</th><th>Unidade administrativa</th><th>Limite</th><th>Tranche</th><th>Status</th></tr></thead>
              <tbody>
                {operationalAccounts.map((account, index) => (
                  <tr key={account.id ?? index}>
                    <td>{account.id ?? '—'}</td><td>{account.sigla || '—'}</td><td>{account.produto?.descricao || '—'}</td>
                    <td>{account.unidadeAdministrativa?.alias || '—'}</td><td>{formatCurrency(account.limite)}</td>
                    <td>{formatCurrency(account.tranche)}</td><td>{account.valido === false ? 'Inválida' : 'Válida'}</td>
                  </tr>
                ))}
                {!operationalAccounts.length && <tr><td colSpan={7} className="empty-table-cell">Nenhuma conta operacional encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="detail-section internal-card glass">
          <div className="detail-section-title section-title-with-count">
            <div><Database size={20} /><h3>Contas gráficas</h3></div>
            <span>{graphicAccounts.length} conta(s)</span>
          </div>
          <div className="registration-table-wrap">
            <table className="registration-table">
              <thead><tr><th>ID</th><th>Descrição</th><th>Unidade administrativa</th><th>Saldo</th><th>Lançamentos</th><th>Status</th></tr></thead>
              <tbody>
                {graphicAccounts.map((account, index) => (
                  <tr key={account.id ?? index}>
                    <td>{account.id ?? '—'}</td><td>{account.descricao || '—'}</td><td>{account.unidadeAdministrativa?.alias || '—'}</td>
                    <td>{formatCurrency(account.saldo)}</td><td>{account.lancamentos?.length || 0}</td><td>{account.valido === false ? 'Inválida' : 'Válida'}</td>
                  </tr>
                ))}
                {!graphicAccounts.length && <tr><td colSpan={6} className="empty-table-cell">Nenhuma conta gráfica encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="customer-registration-page">
      <div className="registration-header">
        <div>
          <span className="registration-eyebrow">Lepta Intelligence</span>
          <h2>Cadastro de Clientes</h2>
          <p>Consulte dados atualizados da UNLTD e complemente o cadastro com informações internas.</p>
        </div>
        <button type="button" className="btn-primary" onClick={openNewClient}><Plus size={18} /> Cadastrar cliente</button>
      </div>

      <section className="registration-search-card internal-card glass">
        <form
          onSubmit={handleSearch}
          className="registration-search-form"
          onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setShowSuggestions(false);
          }}
        >
          <div className="registration-search-main">
            <div className="registration-search-input">
              <Search size={20} />
              <input
                value={searchTerm}
                onChange={event => {
                  setSearchTerm(event.target.value);
                  setError('');
                }}
                onFocus={() => searchTerm.trim().length >= 2 && setShowSuggestions(true)}
                placeholder="Busca instantânea por nome, CPF ou CNPJ do cedente"
                autoComplete="off"
              />
            </div>

            {showSuggestions && (
              <div className="registration-suggestions" role="listbox" aria-label="Cedentes recomendados">
                {suggestionsLoading ? (
                  <div className="registration-suggestion-status"><RefreshCw className="spin" size={17} /> Procurando recomendações...</div>
                ) : suggestions.length ? (
                  suggestions.map(client => (
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      className="registration-suggestion-item"
                      key={client.documento}
                      onClick={() => {
                        setSearchTerm(client.nome);
                        setShowSuggestions(false);
                        void openClient(client.documento);
                      }}
                    >
                      <span className="suggestion-icon"><Building2 size={18} /></span>
                      <span className="suggestion-content">
                        <strong>{client.nome}</strong>
                        <small>{formatDocument(client.documento)}{client.email ? ` · ${client.email}` : ''}</small>
                      </span>
                      <span className={`source-pill ${client.source}`}>{sourceLabel(client.source)}</span>
                    </button>
                  ))
                ) : (
                  <div className="registration-suggestion-status">Nenhum cedente recomendado para esta busca.</div>
                )}
              </div>
            )}
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <RefreshCw className="spin" size={18} /> : <Search size={18} />} {loading ? 'Consultando...' : 'Buscar cedente'}
          </button>
        </form>
        <div className="registration-source-note"><ExternalLink size={15} /> Dados compostos em tempo real: API UNLTD + Banco Interno Lepta</div>
      </section>

      {error && <div className="registration-message error">{error}</div>}
      {warning && <div className="registration-message warning">{warning}</div>}

      {loading ? (
        <div className="registration-loading internal-card glass"><RefreshCw className="spin" size={30} /><strong>Consultando cedentes na API UNLTD</strong><span>Compondo os resultados com o banco interno...</span></div>
      ) : (
        <section className="registration-results internal-card glass">
          <div className="registration-results-header"><h3>Resultados da consulta</h3>{searched && <span>{results.length} encontrado(s)</span>}</div>
          {!searched ? (
            <div className="registration-empty"><Search size={48} /><h3>Encontre um cedente</h3><p>Digite o nome, CPF ou CNPJ para consultar os dados cadastrais.</p></div>
          ) : results.length === 0 ? (
            <div className="registration-empty"><UserRound size={48} /><h3>Nenhum cedente encontrado</h3><p>Revise a busca ou cadastre um cliente interno.</p></div>
          ) : (
            <div className="registration-result-list">
              {results.map(client => (
                <div
                  className="registration-result-row"
                  key={client.documento}
                  role="button"
                  tabIndex={0}
                  onClick={() => openClient(client.documento)}
                  onKeyDown={event => {
                    if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
                    event.preventDefault();
                    openClient(client.documento);
                  }}
                >
                  <div className="result-client-main"><span className="result-avatar"><Building2 size={20} /></span><div><strong>{client.nome}</strong><small>{formatDocument(client.documento)}</small></div></div>
                  <div className="result-contact">
                    {client.telefone && phoneHref(client.telefone) ? (
                      <a
                        className="phone-call-link"
                        href={phoneHref(client.telefone)}
                        onClick={event => event.stopPropagation()}
                        aria-label={`Ligar para ${client.telefone}`}
                        title="Ligar pelo aplicativo padrão"
                      >
                        <Phone size={15} />{client.telefone}
                      </a>
                    ) : (
                      <span><Phone size={15} />Não informado</span>
                    )}
                    <span><Mail size={15} />{client.email || 'Não informado'}</span>
                  </div>
                  <div className="result-source"><span className={`source-pill ${client.source}`}>{sourceLabel(client.source)}</span><span>Ver detalhes</span></div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

const DetailField = ({
  icon,
  label,
  value,
  editing = false,
  onChange,
  wide = false,
  linkHref = ''
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string | null;
  editing?: boolean;
  onChange?: (value: string) => void;
  wide?: boolean;
  linkHref?: string;
}) => (
  <div className={`detail-field ${wide ? 'wide' : ''}`}>
    <span>{icon}{label}</span>
    {editing && onChange ? (
      <input value={value || ''} onChange={event => onChange(event.target.value)} />
    ) : value && linkHref ? (
      <a className="detail-field-link phone-call-link" href={linkHref} aria-label={`Ligar para ${value}`} title="Ligar pelo aplicativo padrão">
        <Phone size={15} />{value}
      </a>
    ) : (
      <strong>{value || 'Não informado'}</strong>
    )}
  </div>
);

export default CustomerRegistration;
