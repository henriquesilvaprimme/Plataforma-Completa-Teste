import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase'; // ajuste o caminho se necessário

const CriarLead = () => {
  // Estados para os campos do formulário
  const [nomeLead, setNomeLead] = useState('');
  const [modeloVeiculo, setModeloVeiculo] = useState('');
  const [anoModelo, setAnoModelo] = useState('');
  const [cidade, setCidade] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tipoSeguro, setTipoSeguro] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [nomesResponsaveis, setNomesResponsaveis] = useState([]);
  const [mensagemFeedback, setMensagemFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  // Função auxiliar para formatar data e hora para "DD/MM/AAAA HH:MM:SS"
  const formatDateTime = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : date.toDate(); // Converte Timestamp para Date
    if (isNaN(d.getTime())) return '';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  // Função para buscar os nomes dos responsáveis (usuários ativos) do Firebase
  useEffect(() => {
    const buscarNomesResponsaveis = async () => {
      try {
        const usuariosRef = collection(db, 'usuarios');
        const q = query(usuariosRef, where('status', '==', 'Ativo'));
        const querySnapshot = await getDocs(q);
        
        const nomes = [];
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          if (userData.nome) {
            nomes.push(userData.nome);
          }
        });
        setNomesResponsaveis(nomes);
      } catch (error) {
        console.error('Erro ao buscar nomes de responsáveis do Firebase:', error);
        setMensagemFeedback('❌ Erro ao carregar a lista de responsáveis. Verifique o console.');
      }
    };

    buscarNomesResponsaveis();
  }, []);

  const handleCriar = async () => {
    setMensagemFeedback('');

    // Validação dos campos obrigatórios
    if (!nomeLead || !modeloVeiculo || !anoModelo || !cidade || !telefone || !tipoSeguro || !responsavel) {
      setMensagemFeedback('⚠️ Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setIsLoading(true);

    try {
      const leadsCollectionRef = collection(db, 'leads');
      const now = new Date();

      const novoLead = {
        Nome: nomeLead,
        Modelo: modeloVeiculo,
        AnoModelo: anoModelo,
        Cidade: cidade,
        Telefone: telefone,
        TipoSeguro: tipoSeguro,
        Responsavel: responsavel,
        status: 'Novo', // Status inicial para novos leads
        createdAt: formatDateTime(now), // Data de criação formatada
        closedAt: '', // Inicialmente vazio, será preenchido ao fechar
        registeredAt: formatDateTime(now), // Data de registro formatada
      };

      await addDoc(leadsCollectionRef, novoLead);
      
      setMensagemFeedback('✅ Lead criado com sucesso!');

      if (tipoSeguro === 'Novo' || tipoSeguro === 'Renovacao') {
        navigate('/leads');
      }

      // Limpeza do formulário
      setNomeLead('');
      setModeloVeiculo('');
      setAnoModelo('');
      setCidade('');
      setTelefone('');
      setTipoSeguro('');
      setResponsavel('');

    } catch (error) {
      console.error('Erro ao criar o lead no Firebase:', error);
      setMensagemFeedback('❌ Erro ao criar o lead. Verifique sua conexão ou tente novamente. Detalhes no console.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white rounded-xl shadow-md space-y-6">
      <h2 className="text-3xl font-bold text-blue-700 mb-4 text-center">Criar Novo Lead</h2>

      {/* Campos do formulário */}
      <div>
        <label className="block text-gray-700">Nome do Cliente</label>
        <input
          type="text"
          value={nomeLead}
          onChange={(e) => setNomeLead(e.target.value)}
          className="w-full mt-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Nome completo do lead"
          required
        />
      </div>

      <div>
        <label className="block text-gray-700">Modelo do Veículo</label>
        <input
          type="text"
          value={modeloVeiculo}
          onChange={(e) => setModeloVeiculo(e.target.value)}
          className="w-full mt-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Ex: Fiat Palio, Honda Civic"
          required
        />
      </div>

      <div>
        <label className="block text-gray-700">Ano/Modelo</label>
        <input
          type="text"
          value={anoModelo}
          onChange={(e) => setAnoModelo(e.target.value)}
          className="w-full mt-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Ex: 2020/2021"
          required
        />
      </div>

      <div>
        <label className="block text-gray-700">Cidade</label>
        <input
          type="text"
          value={cidade}
          onChange={(e) => setCidade(e.target.value)}
          className="w-full mt-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Cidade do cliente"
          required
        />
      </div>

      <div>
        <label className="block text-gray-700">Telefone</label>
        <input
          type="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          className="w-full mt-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Ex: (XX) XXXXX-XXXX"
          required
        />
      </div>

      <div>
        <label className="block text-gray-700">Tipo de Seguro</label>
        <select
          value={tipoSeguro}
          onChange={(e) => setTipoSeguro(e.target.value)}
          className="w-full mt-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          required
        >
          <option value="">Selecione um tipo</option>
          <option value="Novo">Novo</option>
          <option value="Renovacao">Renovação</option>
          <option value="Indicacao">Indicação</option>
        </select>
      </div>

      {/* Campo Responsável agora é um select populado dinamicamente */}
      <div>
        <label className="block text-gray-700">Responsável</label>
        <select
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value)}
          className="w-full mt-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          required
        >
          <option value="">Selecione o Responsável</option>
          {nomesResponsaveis.map((nome, index) => (
            <option key={index} value={nome}>
              {nome}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col items-center">
        <button
          onClick={handleCriar}
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? 'Criando Lead...' : 'Criar Lead'}
        </button>
        {mensagemFeedback && (
          <p className={`mt-4 font-semibold text-center ${mensagemFeedback.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
            {mensagemFeedback}
          </p>
        )}
      </div>
    </div>
  );
};

export default CriarLead;
