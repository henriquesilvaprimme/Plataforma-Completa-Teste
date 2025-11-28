import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCcw } from 'lucide-react'; // Importação do ícone de refresh

const Dashboard = ({ leads = [], leadsFechados = [], usuarioLogado = { tipo: 'User', nome: '' } }) => {
  const [leadsClosed, setLeadsClosed] = useState([]);
  const [loading, setLoading] = useState(true); // Estado original do Dashboard
  const [isLoading, setIsLoading] = useState(false); // Novo estado para o botão de refresh

  // Inicializar dataInicio e dataFim com valores padrão ao carregar o componente
  const getPrimeiroDiaMes = () => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  };

  const getDataHoje = () => {
    return new Date().toISOString().slice(0, 10);
  };

  const [dataInicio, setDataInicio] = useState(getPrimeiroDiaMes());
  const [dataFim, setDataFim] = useState(getDataHoje());
  const [filtroAplicado, setFiltroAplicado] = useState({ inicio: getPrimeiroDiaMes(), fim: getDataHoje() });

  // Função auxiliar para validar e formatar a data, agora suportando strings, Date e Firestore Timestamp
  const getValidDateStr = (dateValue) => {
    if (!dateValue) return null;

    // Firestore Timestamp (objeto com seconds)
    if (typeof dateValue === 'object' && dateValue !== null && typeof dateValue.seconds === 'number') {
      const d = new Date(dateValue.seconds * 1000);
      return d.toISOString().slice(0, 10);
    }

    // Date object
    if (dateValue instanceof Date) {
      if (isNaN(dateValue.getTime())) return null;
      return dateValue.toISOString().slice(0, 10);
    }

    // String or number
    try {
      const dateObj = new Date(dateValue);
      if (isNaN(dateObj.getTime())) return null;
      return dateObj.toISOString().slice(0, 10);
    } catch (err) {
      return null;
    }
  };

  // Antes: buscava no Firebase. Agora: utiliza os dados passados via props (leadsFechados).
  // Função usada pelo botão de refresh — atualiza o estado interno a partir das props.
  const buscarLeadsClosedFromAPI = async () => {
    setIsLoading(true); // Ativa o loading do botão
    setLoading(true); // Ativa o loading original do Dashboard
    try {
      // Atualiza o estado interno com o que foi passado pelo App (leadsFechados)
      setLeadsClosed(Array.isArray(leadsFechados) ? leadsFechados : []);
    } catch (error) {
      console.error('Erro ao atualizar leads fechados a partir das props:', error);
    } finally {
      setIsLoading(false); // Desativa o loading do botão
      setLoading(false); // Desativa o loading original do Dashboard
    }
  };

  // Sincroniza leadsFechados (prop) para o estado interno quando mudar
  useEffect(() => {
    setLeadsClosed(Array.isArray(leadsFechados) ? leadsFechados : []);
    setLoading(false);
  }, [leadsFechados]);

  // refresh automático ao entrar na aba (mantido para compatibilidade)
  useEffect(() => {
    if (Array.isArray(leadsFechados) && leadsFechados.length > 0) {
      setLeadsClosed(leadsFechados);
      setLoading(false);
    } else {
      buscarLeadsClosedFromAPI();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // só na montagem

  const aplicarFiltroData = () => {
    setFiltroAplicado({ inicio: dataInicio, fim: dataFim });
  };

  // ---------- Funções copiadas/adaptadas do Leads.jsx para visibilidade ----------
  const normalizarTexto = (texto = '') => {
    return texto
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()@\+\?><\[\]\+]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const getCurrentUserFromPropOrStorage = () => {
    if (usuarioLogado) return usuarioLogado;
    try {
      const raw = localStorage.getItem('user');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  const canViewLead = (lead) => {
    // Admin vê todos
    const isAdmin = usuarioLogado?.tipo === 'Admin';
    if (isAdmin) return true;

    const user = getCurrentUserFromPropOrStorage();
    if (!user) return false;

    const userId = String(user.id ?? user.ID ?? user.userId ?? '').trim();
    const userNome = String(user.nome ?? user.name ?? user.usuario ?? '').trim().toLowerCase();

    // lead.usuarioId can be number or string
    const leadUsuarioId = (lead.usuarioId !== undefined && lead.usuarioId !== null) ? String(lead.usuarioId).trim() : '';
    if (leadUsuarioId && userId && leadUsuarioId === userId) return true;

    const leadResponsavel = String(lead.responsavel ?? lead.Responsavel ?? '').trim().toLowerCase();
    if (leadResponsavel && userNome && leadResponsavel === userNome) return true;

    const leadUsuarioLogin = String(lead.usuario ?? lead.user ?? '').trim();
    const userLogin = String(user.usuario ?? '').trim();
    if (leadUsuarioLogin && userLogin && leadUsuarioLogin === userLogin) return true;

    return false;
  };
  // ------------------------------------------------------------------------------

  // Filtro por data dos leads gerais (vindos via prop `leads`) — mas agora aplicamos visibilidade
  const leadsVisiveis = Array.isArray(leads) ? leads.filter((l) => canViewLead(l)) : [];

  // Função para checar se lead está dentro do intervalo de data aplicado (usa createdAt)
  const leadDentroDoPeriodo = (lead) => {
    const dataLeadStr = getValidDateStr(lead.createdAt ?? lead.Data ?? lead.DataFechamento ?? null);
    if (!dataLeadStr) return false;
    if (filtroAplicado.inicio && dataLeadStr < filtroAplicado.inicio) return false;
    if (filtroAplicado.fim && dataLeadStr > filtroAplicado.fim) return false;
    return true;
  };

  // Agora, total de leads segue a mesma lógica do Leads.jsx: conta todos visíveis que NÃO são 'Perdido' (aplica filtro de data)
  const totalLeads = leadsVisiveis.filter((lead) => {
    const status = lead.status ?? lead.Status ?? '';
    if (String(status) === 'Perdido') return false;
    return leadDentroDoPeriodo(lead);
  }).length;

  // Vendas: conta leads visíveis com status === 'Fechado' (aplica filtro de data)
  const vendasCount = leadsVisiveis.filter((lead) => {
    const status = lead.status ?? lead.Status ?? '';
    if (String(status) !== 'Fechado') return false;
    return leadDentroDoPeriodo(lead);
  }).length;

  // Para compatibilidade com o restante do código, usamos leadsFechadosCount = vendasCount
  const leadsFechadosCount = vendasCount;

  // Ainda mantemos os contadores por seguradora com base em leadsFiltradosClosed (usando leadsClosed prop),
  // para não modificar demais comportamentos que dependem especificamente dessa coleção.
  // Porém, se preferir que estes contadores também venham de `leads` (status 'Fechado'), me diga e eu adapto.
  let leadsFiltradosClosed =
    (usuarioLogado?.tipo === 'Admin')
      ? (leadsClosed || [])
      : (leadsClosed || []).filter((lead) => {
          const resp = (lead.Responsavel ?? lead.responsavel ?? '').toString();
          return resp === (usuarioLogado?.nome || '');
        });

  // Filtro de data nos leads fechados (usando campo Data / createdAt)
  leadsFiltradosClosed = (leadsFiltradosClosed || []).filter((lead) => {
    const possibleDate = lead.Data ?? lead.createdAt ?? lead.DataFechamento ?? null;
    const dataLeadStr = getValidDateStr(possibleDate);
    if (!dataLeadStr) return false;
    if (filtroAplicado.inicio && dataLeadStr < filtroAplicado.inicio) return false;
    if (filtroAplicado.fim && dataLeadStr > filtroAplicado.fim) return false;
    return true;
  });

  // Normalização helper para o campo Seguradora (trim + lowercase)
  const getSegNormalized = (lead) => {
    return (lead?.Seguradora ?? lead?.insurer ?? lead?.Insurer ?? '').toString().trim().toLowerCase();
  };

  // Lista de seguradoras que devem ser contadas como "Demais Seguradoras"
  const demaisSeguradorasLista = [
    'tokio',
    'yelum',
    'suhai',
    'allianz',
    'bradesco',
    'hdi',
    'zurich',
    'alfa',
    'mitsui',
    'mapfre',
    'demais seguradoras' // inclui explicitamente o rótulo "Demais Seguradoras"
  ];

  // Contadores por seguradora (comparação normalizada)
  const portoSeguro = leadsFiltradosClosed.filter((lead) => getSegNormalized(lead) === 'porto seguro').length;
  const azulSeguros = leadsFiltradosClosed.filter((lead) => getSegNormalized(lead) === 'azul seguros').length;
  const itauSeguros = leadsFiltradosClosed.filter((lead) => getSegNormalized(lead) === 'itau seguros').length;

  // Agora 'demais' conta qualquer lead cuja seguradora esteja na lista acima (case-insensitive)
  const demais = leadsFiltradosClosed.filter((lead) => demaisSeguradorasLista.includes(getSegNormalized(lead))).length;

  // CÁLCULO DA TAXA DE CONVERSÃO (Nova lógica)
  const taxaConversao =
    totalLeads > 0
      ? Math.round((leadsFechadosCount / totalLeads) * 100)
      : 0;

  // Soma de prêmio líquido (baseado em leadsFiltradosClosed)
  const totalPremioLiquido = leadsFiltradosClosed.reduce(
    (acc, lead) => acc + (Number(lead.PremioLiquido ?? lead.premioLiquido ?? lead.Premio ?? 0) || 0),
    0
  );

  // --- CÁLCULO DA MÉDIA COMISSÃO (AJUSTADO) ---
  const somaTotalPercentualComissao = leadsFiltradosClosed.reduce(
    (acc, lead) => acc + (Number(lead.Comissao ?? lead.comissao ?? 0) || 0),
    0
  );

  const totalVendasParaMedia = leadsFiltradosClosed.length;
  const comissaoMediaGlobal =
    totalVendasParaMedia > 0 ? somaTotalPercentualComissao / totalVendasParaMedia : 0;
  // --- FIM CÁLCULO AJUSTADO ---

  const leadsFiltradosPorDataGeral = (leadsVisiveis || []).filter((lead) => {
    const dataLeadStr = getValidDateStr(lead.createdAt);
    if (!dataLeadStr) return false;
    if (filtroAplicado.inicio && dataLeadStr < filtroAplicado.inicio) return false;
    if (filtroAplicado.fim && dataLeadStr > filtroAplicado.fim) return false;
    return true;
  });

  const leadsPerdidos = leadsFiltradosPorDataGeral.filter((lead) => lead.status === 'Perdido').length;
  const leadsEmContato = leadsFiltradosPorDataGeral.filter((lead) => lead.status === 'Em Contato').length;
  const leadsSemContato = leadsFiltradosPorDataGeral.filter((lead) => lead.status === 'Sem Contato').length;

  const boxStyle = {
    padding: '10px',
    borderRadius: '5px',
    flex: 1,
    color: '#fff',
    textAlign: 'center',
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Dashboard</h1>

      {/* Filtro de datas com botão e o NOVO Botão de Refresh */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid #ccc',
            cursor: 'pointer',
          }}
          title="Data de Início"
        />
        <input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: '6px',
            border: '1px solid #ccc',
            cursor: 'pointer',
          }}
          title="Data de Fim"
        />
        <button
          onClick={aplicarFiltroData}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 14px',
            cursor: 'pointer',
          }}
        >
          Filtrar
        </button>

        {/* Botão de Refresh */}
        <button
          title='Clique para atualizar os dados'
          onClick={buscarLeadsClosedFromAPI} // Chama a função que atualiza os leads fechados a partir das props
          disabled={isLoading}
          style={{
            backgroundColor: '#6c757d', // Cor cinza para o botão de refresh
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 10px', // Um pouco menor para o ícone
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '36px', // Tamanho mínimo para o ícone
            height: '36px',
          }}
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <RefreshCcw size={20} /> // Ícone de refresh
          )}
        </button>
      </div>

      {/* Spinner de carregamento para o Dashboard geral (opcional, pode ser removido se o `isLoading` for suficiente) */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>Carregando dados do dashboard...</p>
        </div>
      )}

      {!loading && ( // Renderiza o conteúdo apenas quando não estiver carregando
        <>
          {/* Primeira linha de contadores */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div style={{ ...boxStyle, backgroundColor: '#eee', color: '#333' }}>
              <h3>Total de Leads</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{totalLeads}</p>
            </div>
            <div style={{ ...boxStyle, backgroundColor: '#9C27B0' }}>
              <h3>Taxa de Conversão</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{taxaConversao}%</p>
            </div>
            <div style={{ ...boxStyle, backgroundColor: '#4CAF50' }}>
              <h3>Vendas</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{leadsFechadosCount}</p>
            </div>
            <div style={{ ...boxStyle, backgroundColor: '#F44336' }}>
              <h3>Leads Perdidos</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{leadsPerdidos}</p>
            </div>
            <div style={{ ...boxStyle, backgroundColor: '#FF9800' }}>
              <h3>Em Contato</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{leadsEmContato}</p>
            </div>
            <div style={{ ...boxStyle, backgroundColor: '#9E9E9E' }}>
              <h3>Sem Contato</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{leadsSemContato}</p>
            </div>
          </div>

          {/* Segunda linha de contadores */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div style={{ ...boxStyle, backgroundColor: '#003366' }}>
              <h3>Porto Seguro</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{portoSeguro}</p>
            </div>
            <div style={{ ...boxStyle, backgroundColor: '#87CEFA' }}>
              <h3>Azul Seguros</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{azulSeguros}</p>
            </div>
            <div style={{ ...boxStyle, backgroundColor: '#FF8C00' }}>
              <h3>Itau Seguros</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{itauSeguros}</p>
            </div>
            <div style={{ ...boxStyle, backgroundColor: '#4CAF50' }}>
              <h3>Demais Seguradoras</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{demais}</p>
            </div>
          </div>

          {/* Somente para Admin: linha de Prêmio Líquido e Comissão */}
          <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
            <div style={{ ...boxStyle, backgroundColor: '#3f51b5' }}>
              <h3>Total Prêmio Líquido</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {totalPremioLiquido.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>
            </div>

            <div style={{ ...boxStyle, backgroundColor: '#009688' }}>
              <h3>Média Comissão</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>
                {comissaoMediaGlobal.toFixed(2).replace('.', ',')}%
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
