import React, { useState, useMemo } from 'react';
import { RefreshCcw, ArrowRightCircle, ArrowLeftCircle, DollarSign, Users, Target, Clock, XCircle, Briefcase, TrendingUp } from 'lucide-react';

// ===============================================
// Componente principal do Dashboard
// ===============================================
const Dashboard = ({ usuarioLogado, leads = [], renovacoes = [] }) => {
  // Estado para controle de UI e Filtros
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentSection, setCurrentSection] = useState('segurosNovos'); // 'segurosNovos' ou 'renovacoes'

  // --- Helpers de Data ---
  const getPrimeiroDiaMes = () => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  };

  const getDataHoje = () => {
    return new Date().toISOString().slice(0, 10);
  };

  // Estados de Filtro de Data
  const [dataInicio, setDataInicio] = useState(getPrimeiroDiaMes());
  const [dataFim, setDataFim] = useState(getDataHoje());
  const [filtroAplicado, setFiltroAplicado] = useState({ inicio: getPrimeiroDiaMes(), fim: getDataHoje() });

  const isAdmin = usuarioLogado?.tipo === 'Admin';

  // --- Função Robusta para Parse de Data (lida com Firestore Timestamp) ---
  const getValidDateStr = (dateValue) => {
    if (!dateValue) return null;
    try {
      let dateObj;
      if (typeof dateValue === 'object' && dateValue.seconds) {
        // Formato Firestore Timestamp
        dateObj = new Date(dateValue.seconds * 1000);
      } else if (typeof dateValue === 'string' || dateValue instanceof Date) {
        // Formato string ISO ou Date object
        dateObj = new Date(dateValue);
      } else {
        return null;
      }

      if (isNaN(dateObj.getTime())) return null;

      // Retorna no formato 'YYYY-MM-DD' para comparação
      return dateObj.toISOString().slice(0, 10);
    } catch (e) {
      return null;
    }
  };

  // --- LÓGICA DE PERMISSÃO (Quem vê o quê, copiada da lógica de abas) ---
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
    if (isAdmin) return true;
    const user = getCurrentUserFromPropOrStorage();
    if (!user) return false;

    const userNome = String(user.nome ?? user.name ?? user.usuario ?? '').trim().toLowerCase();
    const leadResponsavel = String(lead.responsavel ?? lead.Responsavel ?? '').trim().toLowerCase();

    if (leadResponsavel && userNome && leadResponsavel === userNome) return true;

    // Adiciona verificações por ID e Login, caso existam no objeto lead/user
    const userId = String(user.id ?? user.ID ?? user.userId ?? '').trim();
    const leadUsuarioId = lead.usuarioId !== undefined && lead.usuarioId !== null ? String(lead.usuarioId).trim() : '';
    if (leadUsuarioId && userId && leadUsuarioId === userId) return true;

    const leadUsuarioLogin = String(
      lead.usuario ?? lead.user ?? lead.raw?.usuario ?? lead.raw?.user ?? ''
    ).trim();
    const userLogin = String(user.usuario ?? '').trim();
    if (leadUsuarioLogin && userLogin && leadUsuarioLogin === userLogin) return true;

    return false;
  };

  const isStatusAgendado = (status) => {
    return typeof status === 'string' && status.startsWith('Agendado');
  };

  const extractStatusDate = (status) => {
    if (typeof status !== 'string') return null;
    const parts = status.split(' - ');
    return parts.length > 1 ? parts[1] : null; // Assume DD/MM/YYYY
  };

  // Helper para converter prêmio/comissão para número
  const safeParseFloat = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;
    // Remove R$, ., % e substitui , por . para parse
    return parseFloat(value.replace(/[R$,.%]/g, '').replace(',', '.')) || 0;
  };

  // --- MEMOIZAÇÃO: Filtra os dados LOCAIS (vindos das Props) ---
  const filteredLeads = useMemo(() => {
    // 1. Filtra por permissão (Admin vê tudo, User vê seus leads)
    let filtered = (leads || []).filter((lead) => canViewLead(lead));

    // 2. Filtra por Data de criação
    filtered = filtered.filter((lead) => {
      const dataLeadStr = getValidDateStr(lead.createdAt);
      if (!dataLeadStr) return false;
      if (filtroAplicado.inicio && dataLeadStr < filtroAplicado.inicio) return false;
      if (filtroAplicado.fim && dataLeadStr > filtroAplicado.fim) return false;
      return true;
    });

    // 3. Filtra leads que são claramente renovações
    return filtered.filter(lead => !(lead.status?.toLowerCase().includes('renovação') || lead.tipo?.toLowerCase() === 'renovação'));

  }, [leads, usuarioLogado, filtroAplicado]);

  const filteredRenovacoes = useMemo(() => {
    // 1. Filtra por permissão
    let filtered = (renovacoes || []).filter((renovacao) => canViewLead(renovacao));

    // 2. Filtra por Data (usa createdAt ou VigenciaInicial)
    filtered = filtered.filter((renovacao) => {
      const dataRenovacaoStr = getValidDateStr(renovacao.createdAt) || getValidDateStr(renovacao.VigenciaInicial);
      if (!dataRenovacaoStr) return false;
      if (filtroAplicado.inicio && dataRenovacaoStr < filtroAplicado.inicio) return false;
      if (filtroAplicado.fim && dataRenovacaoStr > filtroAplicado.fim) return false;
      return true;
    });
    
    // 3. Garante que estamos focando apenas em itens de renovação
    return filtered.filter(lead => lead.status?.toLowerCase().includes('renovação') || lead.tipo?.toLowerCase() === 'renovação');
  }, [renovacoes, usuarioLogado, filtroAplicado]);

  // --- CÁLCULO DE ESTATÍSTICAS (Baseado nos filtrados) ---
  const dashboardStats = useMemo(() => {
    let stats = {
      // Leads Novos
      totalLeads: 0, vendas: 0, emContato: 0, semContato: 0, agendadosHoje: 0, perdidos: 0,
      portoSeguroLeads: 0, azulSegurosLeads: 0, itauSegurosLeads: 0, demaisSeguradorasLeads: 0,
      totalPremioLiquidoLeads: 0, somaTotalPercentualComissaoLeads: 0, totalVendasParaMediaLeads: 0,
      taxaConversaoLeads: 0, comissaoMediaGlobalLeads: 0,
      // Renovações
      totalRenovacoes: 0, renovados: 0, renovacoesPerdidas: 0,
      portoSeguroRenovacoes: 0, azulSegurosRenovacoes: 0, itauSegurosRenovacoes: 0, demaisSeguradorasRenovacoes: 0,
      premioLiquidoRenovados: 0, somaComissaoRenovados: 0, totalRenovadosParaMedia: 0,
      taxaRenovacao: 0, mediaComissaoRenovados: 0,
    };

    const today = new Date().toLocaleDateString('pt-BR');
    const demaisSeguradorasLista = [
      'tokio', 'yelum', 'suhai', 'allianz', 'bradesco', 'hdi', 'zurich', 'alfa', 'mitsui', 'mapfre', 'demais seguradoras'
    ];

    // Contagem LEADS NOVOS
    filteredLeads.forEach((lead) => {
      stats.totalLeads++;
      const s = lead.status ?? '';
      const segNormalized = (lead.Seguradora || '').toString().trim().toLowerCase();

      // Contagem de Status
      if (s === 'Fechado' || (lead.insurerConfirmed === true && !s.toLowerCase().includes('renovação'))) {
        stats.vendas++;
        if (segNormalized.includes('porto')) stats.portoSeguroLeads++;
        else if (segNormalized.includes('azul')) stats.azulSegurosLeads++;
        else if (segNormalized.includes('itau')) stats.itauSegurosLeads++;
        else if (segNormalized && segNormalized !== 'selecione a seguradora') stats.demaisSeguradorasLeads++;

        stats.totalPremioLiquidoLeads += safeParseFloat(lead.PremioLiquido);
        stats.somaTotalPercentualComissaoLeads += safeParseFloat(lead.Comissao);
        stats.totalVendasParaMediaLeads++;

      } else if (s === 'Em Contato') {
        stats.emContato++;
      } else if (s === 'Sem Contato') {
        stats.semContato++;
      } else if (isStatusAgendado(s)) {
        const statusDateStr = extractStatusDate(s);
        if (statusDateStr) {
          const [dia, mes, ano] = statusDateStr.split('/');
          if (dia && mes && ano) {
            const statusDateFormatted = new Date(`${ano}-${mes}-${dia}T00:00:00`).toLocaleDateString('pt-BR');
            if (statusDateFormatted === today) stats.agendadosHoje++;
          }
        }
      } else if (s === 'Perdido') {
        stats.perdidos++;
      }
    });

    // Contagem RENOVACOES
    filteredRenovacoes.forEach((renovacao) => {
      stats.totalRenovacoes++;
      const s = renovacao.status ?? '';
      const segNormalized = (renovacao.Seguradora || '').toString().trim().toLowerCase();

      if (s === 'Renovado' || (renovacao.insurerConfirmed === true && s.toLowerCase().includes('renovação'))) {
        stats.renovados++;
        if (segNormalized.includes('porto')) stats.portoSeguroRenovacoes++;
        else if (segNormalized.includes('azul')) stats.azulSegurosRenovacoes++;
        else if (segNormalized.includes('itau')) stats.itauSegurosRenovacoes++;
        else if (segNormalized && segNormalized !== 'selecione a seguradora') stats.demaisSeguradorasRenovacoes++;

        stats.premioLiquidoRenovados += safeParseFloat(renovacao.PremioLiquido);
        stats.somaComissaoRenovados += safeParseFloat(renovacao.Comissao);
        stats.totalRenovadosParaMedia++;
      } else if (s === 'Perdido' || s.toLowerCase().includes('perdida')) {
        stats.renovacoesPerdidas++;
      }
    });

    // Cálculos de Média e Taxa
    stats.taxaConversaoLeads = stats.totalLeads > 0 ? (stats.vendas / stats.totalLeads) * 100 : 0;
    stats.comissaoMediaGlobalLeads = stats.totalVendasParaMediaLeads > 0 ? stats.somaTotalPercentualComissaoLeads / stats.totalVendasParaMediaLeads : 0;
    stats.mediaComissaoRenovados = stats.totalRenovadosParaMedia > 0 ? stats.somaComissaoRenovados / stats.totalRenovadosParaMedia : 0;
    stats.taxaRenovacao = stats.totalRenovacoes > 0 ? (stats.renovados / stats.totalRenovacoes) * 100 : 0;

    return {
      ...stats,
      taxaConversaoLeads: stats.taxaConversaoLeads.toFixed(2),
      comissaoMediaGlobalLeads: stats.comissaoMediaGlobalLeads.toFixed(2),
      mediaComissaoRenovados: stats.mediaComissaoRenovados.toFixed(2),
      taxaRenovacao: stats.taxaRenovacao.toFixed(2),
    };
  }, [filteredLeads, filteredRenovacoes]);

  const handleAplicarFiltroData = () => {
    setIsRefreshing(true);
    // Aplica o filtro atualizando o estado que o useMemo observa
    setFiltroAplicado({ inicio: dataInicio, fim: dataFim });
    // Feedback visual (simula um carregamento)
    setTimeout(() => setIsRefreshing(false), 300);
  };

  const navigateSections = (direction) => {
    if (direction === 'next') {
      setCurrentSection('renovacoes');
    } else {
      setCurrentSection('segurosNovos');
    }
  };

  // --- Componentes de UI (Robustos) ---

  const Card = ({ title, value, color, icon: Icon, isCurrency = false, isPercentage = false, valueColor }) => {
    const displayValue = isCurrency
      ? safeParseFloat(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : isPercentage
        ? `${String(value).replace('.', ',')}%`
        : value;

    return (
      <div className={`p-5 rounded-xl shadow-lg transition-transform duration-300 hover:scale-[1.02]`}
        style={{ backgroundColor: color || '#ffffff', borderLeft: `5px solid ${valueColor || '#007bff'}` }}>
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xs font-semibold uppercase" style={{ color: '#555' }}>{title}</h3>
          {Icon && <Icon size={20} style={{ color: valueColor || '#007bff' }} />}
        </div>
        <p className="text-3xl font-bold" style={{ color: valueColor || '#333' }}>
          {displayValue}
        </p>
      </div>
    );
  };

  const SectionToggle = () => (
    <div className="flex items-center justify-between mt-8 mb-4">
      <h2 className="text-3xl font-extrabold text-gray-800 border-b-4 border-blue-500 pb-2">
        {currentSection === 'segurosNovos' ? 'Seguros Novos' : 'Renovações'}
      </h2>
      <div className="flex gap-2">
        <button
          onClick={() => navigateSections('prev')}
          className="p-2 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
          disabled={currentSection === 'segurosNovos'}
        >
          <ArrowLeftCircle size={24} />
        </button>
        <button
          onClick={() => navigateSections('next')}
          className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition"
          disabled={currentSection === 'renovacoes'}
        >
          <ArrowRightCircle size={24} />
        </button>
      </div>
    </div>
  );

  const PieChart = ({ percentage, color = '#4CAF50' }) => {
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <svg width="120" height="120" viewBox="0 0 120 120" className="mx-auto mt-4">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="transparent"
          stroke="#e0e0e0"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="65" textAnchor="middle" fontSize="20" fill="#333" fontWeight="bold">
          {percentage.replace('.', ',')}%
        </text>
      </svg>
    );
  };


  return (
    <div className="p-8 font-sans bg-gray-50 min-h-screen">
      <header className="flex justify-between items-center pb-4 border-b border-gray-200 mb-6">
        <h1 className="text-4xl font-extrabold text-gray-900">Visão Geral do Desempenho</h1>
        <p className="text-sm text-gray-500">Filtrando dados por: {filtroAplicado.inicio.split('-').reverse().join('/')} até {filtroAplicado.fim.split('-').reverse().join('/')}</p>
      </header>

      {/* Container de Filtros */}
      <div className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-md mb-8">
        <label className="text-gray-600 font-medium">Período de Análise:</label>
        <input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="p-2 border border-gray-300 rounded-lg text-sm"
        />
        <span className="text-gray-500">até</span>
        <input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className="p-2 border border-gray-300 rounded-lg text-sm"
        />
        <button
          onClick={handleAplicarFiltroData}
          className="bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg hover:bg-blue-700 transition duration-200 shadow-md"
        >
          Aplicar Filtro
        </button>

        <button
          title='Atualizar Filtros'
          disabled={isRefreshing}
          className="p-2 rounded-full bg-gray-500 text-white hover:bg-gray-600 transition disabled:opacity-50 flex items-center justify-center"
        >
          {isRefreshing ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <RefreshCcw size={20} />
          )}
        </button>
      </div>

      <SectionToggle />

      {/* =============================================== */}
      {/* SEÇÃO 1: SEGUROS NOVOS */}
      {/* =============================================== */}
      {currentSection === 'segurosNovos' && (
        <div className="space-y-8">
          {/* Métricas Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card title="Total de Leads" value={dashboardStats.totalLeads} color="#e0f2fe" valueColor="#0284c7" icon={Users} />
            <Card title="Vendas Fechadas" value={dashboardStats.vendas} color="#dcfce7" valueColor="#10b981" icon={DollarSign} />
            <Card title="Taxa de Conversão" value={dashboardStats.taxaConversaoLeads} color="#fef9c3" valueColor="#eab308" icon={TrendingUp} isPercentage={true} />
            <Card title="Prêmio Líquido Total" value={dashboardStats.totalPremioLiquidoLeads} color="#f3e5f5" valueColor="#9333ea" icon={Briefcase} isCurrency={true} />
          </div>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 border-b border-gray-200 pb-2">Funil de Leads</h3>
          {/* Status do Funil */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <Card title="Em Contato" value={dashboardStats.emContato} color="#fff7ed" valueColor="#f97316" icon={Users} />
            <Card title="Sem Contato" value={dashboardStats.semContato} color="#fef2f2" valueColor="#ef4444" icon={XCircle} />
            <Card title="Agendados Hoje" value={dashboardStats.agendadosHoje} color="#ecfdf5" valueColor="#059669" icon={Clock} />
            <Card title="Perdidos" value={dashboardStats.perdidos} color="#fce7f3" valueColor="#db2777" icon={XCircle} />
            <div className="p-5 rounded-xl shadow-lg bg-white border-4 border-yellow-500">
              <h3 className="text-md font-semibold text-gray-600 mb-2">Comissão Média (%)</h3>
              <p className="text-2xl font-bold text-yellow-600">
                {dashboardStats.comissaoMediaGlobalLeads.replace('.', ',')}%
              </p>
            </div>
          </div>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 border-b border-gray-200 pb-2">Vendas por Seguradora (Novos)</h3>
          {/* Distribuição por Seguradora */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card title="Porto Seguro" value={dashboardStats.portoSeguroLeads} color="#eff6ff" valueColor="#3b82f6" icon={Target} />
            <Card title="Azul Seguros" value={dashboardStats.azulSegurosLeads} color="#eef2ff" valueColor="#6366f1" icon={Target} />
            <Card title="Itau Seguros" value={dashboardStats.itauSegurosLeads} color="#f5f3ff" valueColor="#8b5cf6" icon={Target} />
            <Card title="Outras Seguradoras" value={dashboardStats.demaisSeguradorasLeads} color="#fae8ff" valueColor="#a855f7" icon={Target} />
          </div>
        </div>
      )}

      {/* =============================================== */}
      {/* SEÇÃO 2: RENOVAÇÕES */}
      {/* =============================================== */}
      {currentSection === 'renovacoes' && (
        <div className="space-y-8">
          {/* Métricas Principais Renovações */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card title="Total de Renovações" value={dashboardStats.totalRenovacoes} color="#e3f2fd" valueColor="#03a9f4" icon={Users} />
            <Card title="Renovados" value={dashboardStats.renovados} color="#e8f5e9" valueColor="#4caf50" icon={DollarSign} />
            <Card title="Renovações Perdidas" value={dashboardStats.renovacoesPerdidas} color="#ffebee" valueColor="#f44336" icon={XCircle} />
            <div className="p-5 rounded-xl shadow-lg bg-white border-l-4 border-purple-600 flex flex-col justify-center items-center">
              <h3 className="text-xs font-semibold uppercase text-gray-600">Taxa de Renovação</h3>
              <PieChart percentage={dashboardStats.taxaRenovacao} color="#673AB7" />
            </div>
          </div>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 border-b border-gray-200 pb-2">Detalhes Financeiros</h3>
          {/* Detalhes Financeiros Renovações */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card title="Prêmio Líquido Renovados" value={dashboardStats.premioLiquidoRenovados} color="#e0f7fa" valueColor="#00bcd4" icon={Briefcase} isCurrency={true} />
            <Card title="Média Comissão (%)" value={dashboardStats.mediaComissaoRenovados} color="#e8f5e9" valueColor="#8bc34a" icon={TrendingUp} isPercentage={true} />
          </div>

          <h3 className="text-2xl font-semibold text-gray-800 mt-8 border-b border-gray-200 pb-2">Renovações por Seguradora</h3>
          {/* Distribuição por Seguradora Renovações */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card title="Porto Seguro" value={dashboardStats.portoSeguroRenovacoes} color="#e3f2fd" valueColor="#2196f3" icon={Target} />
            <Card title="Azul Seguros" value={dashboardStats.azulSegurosRenovacoes} color="#eef2ff" valueColor="#3f51b5" icon={Target} />
            <Card title="Itau Seguros" value={dashboardStats.itauSegurosRenovacoes} color="#f5f3ff" valueColor="#673ab7" icon={Target} />
            <Card title="Outras Seguradoras" value={dashboardStats.demaisSeguradorasRenovacoes} color="#fae8ff" valueColor="#9c27b0" icon={Target} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
