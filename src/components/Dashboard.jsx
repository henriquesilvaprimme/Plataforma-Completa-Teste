import React, { useState, useEffect } from 'react';
import { RefreshCcw } from 'lucide-react'; // Importação do ícone de refresh
// Não precisamos mais importar do Firebase aqui, pois 'leads' já vem como prop
// e os leads fechados serão filtrados a partir de 'leads'.

const Dashboard = ({ leads, usuarioLogado, fetchLeadsFromFirebase }) => { // Adicionado fetchLeadsFromFirebase como prop
  // Removido o estado leadsClosed, pois as vendas serão contadas a partir da prop 'leads'
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

  // Função auxiliar para validar e formatar a data
  const getValidDateStr = (dateValue) => {
    if (!dateValue) return false; // Retorna false para valores nulos/indefinidos
    const dateObj = new Date(dateValue);
    if (isNaN(dateObj.getTime())) {
      // Tenta parsear como dd/mm/yyyy se a primeira tentativa falhar
      const parts = dateValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (parts) {
        dateObj = new Date(`${parts[3]}-${parts[2]}-${parts[1]}T00:00:00`);
      } else {
        return false; // Se ainda for inválido, retorna false
      }
    }
    return dateObj.toISOString().slice(0, 10);
  };

  // Função para buscar leads (agora usando a prop fetchLeadsFromFirebase)
  const handleRefreshLeads = async () => {
    setIsLoading(true); // Ativa o loading do botão
    setLoading(true); // Ativa o loading original do Dashboard
    try {
      await fetchLeadsFromFirebase(); // Chama a função passada via prop
    } catch (error) {
      console.error('Erro ao buscar leads:', error);
    } finally {
      setIsLoading(false); // Desativa o loading do botão
      setLoading(false); // Desativa o loading original do Dashboard
    }
  };

  // refresh automático ao entrar na aba
  useEffect(() => {
    handleRefreshLeads(); // Chama a função de refresh na montagem
  }, []); // Array de dependências vazia para rodar apenas uma vez na montagem

  const aplicarFiltroData = () => {
    setFiltroAplicado({ inicio: dataInicio, fim: dataFim });
  };

  // Filtro por data dos leads gerais (vindos via prop `leads`)
  const leadsFiltradosPorDataGeral = leads.filter((lead) => {
    // Filtra por responsável primeiro, se não for Admin
    if (usuarioLogado.tipo !== 'Admin' && lead.responsavel !== usuarioLogado.nome) {
      return false;
    }

    const dataLeadStr = getValidDateStr(lead.createdAt);
    if (!dataLeadStr) return false;
    if (filtroAplicado.inicio && dataLeadStr < filtroAplicado.inicio) return false;
    if (filtroAplicado.fim && dataLeadStr > filtroAplicado.fim) return false;
    return true;
  });

  const totalLeads = leadsFiltradosPorDataGeral.length;
  const leadsPerdidos = leadsFiltradosPorDataGeral.filter((lead) => lead.status === 'Perdido').length;
  const leadsEmContato = leadsFiltradosPorDataGeral.filter((lead) => lead.status === 'Em Contato').length;
  const leadsSemContato = leadsFiltradosPorDataGeral.filter((lead) => lead.status === 'Sem Contato').length;

  // --- NOVA LÓGICA PARA LEADS FECHADOS (VENDAS) ---
  // Agora, leadsFechados são filtrados diretamente de leadsFiltradosPorDataGeral
  let leadsFechadosParaVendas = leadsFiltradosPorDataGeral.filter((lead) => lead.status === 'Fechado');

  // Normalização helper para o campo Seguradora (trim + lowercase)
  const getSegNormalized = (lead) => {
    return (lead?.insurer || '').toString().trim().toLowerCase(); // Usar 'insurer' do lead geral
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
  const portoSeguro = leadsFechadosParaVendas.filter((lead) => getSegNormalized(lead) === 'porto seguro').length;
  const azulSeguros = leadsFechadosParaVendas.filter((lead) => getSegNormalized(lead) === 'azul seguros').length;
  const itauSeguros = leadsFechadosParaVendas.filter((lead) => getSegNormalized(lead) === 'itau seguros').length;

  // Agora 'demais' conta qualquer lead cuja seguradora esteja na lista acima (case-insensitive)
  const demais = leadsFechadosParaVendas.filter((lead) => demaisSeguradorasLista.includes(getSegNormalized(lead))).length;

  // O campo Vendas soma os contadores das seguradoras
  const leadsFechadosCount = portoSeguro + azulSeguros + itauSeguros + demais;

  // CÁLCULO DA TAXA DE CONVERSÃO
  const taxaConversao =
    totalLeads > 0
      ? Math.round((leadsFechadosCount / totalLeads) * 100)
      : 0;

  // Soma de prêmio líquido
  const totalPremioLiquido = leadsFechadosParaVendas.reduce(
    (acc, lead) => acc + (Number(lead.premioLiquido) || 0), // Usar 'premioLiquido' do lead geral
    0
  );

  // --- CÁLCULO DA MÉDIA COMISSÃO ---
  const somaTotalPercentualComissao = leadsFechadosParaVendas.reduce(
    (acc, lead) => acc + (Number(lead.comissao) || 0), // Usar 'comissao' do lead geral
    0
  );

  const totalVendasParaMedia = leadsFechadosParaVendas.length;

  const comissaoMediaGlobal =
    totalVendasParaMedia > 0 ? somaTotalPercentualComissao / totalVendasParaMedia : 0;
  // --- FIM CÁLCULO AJUSTADO ---

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
          onClick={handleRefreshLeads} // Chama a função de refresh que usa a prop
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
          {/* Você pode adicionar um spinner aqui se quiser um indicador visual */}
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
            {/* NOVO COTADO: TAXA DE CONVERSÃO */}
            <div style={{ ...boxStyle, backgroundColor: '#9C27B0' }}> {/* Nova cor para destacar */}
              <h3>Taxa de Conversão</h3>
              <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{taxaConversao}%</p>
            </div>
            {/* FIM DO NOVO COTADO */}
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
