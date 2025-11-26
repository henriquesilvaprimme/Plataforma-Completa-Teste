import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom'; // Mantido, embora não usado no snippet fornecido

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
  const [mensagemFeedback, setMensagemFeedback] = useState(''); // Estado para a mensagem de feedback
  const [isLoading, setIsLoading] = useState(false); // Novo estado para controlar o carregamento

  const navigate = useNavigate();

  // MUITO IMPORTANTE: SUBSTITUA ESTE URL PELA URL REAL E ATUALIZADA DA SUA IMPLANTAÇÃO DO GOOGLE APPS SCRIPT
  // CADA NOVA IMPLANTAÇÃO PODE GERAR UMA NOVA URL.
  // Usaremos a mesma base para todas as operações
  const GOOGLE_SHEETS_BASE_URL = 'https://script.google.com/macros/s/AKfycbzSkLIDEJUeJMf8cQestU8jVAaafHPPStvYsnsJMbgoNyEXHkmz4eXica0UOEdUQFea/exec'; // Sua URL de implantação

  // Função para buscar os nomes dos responsáveis ao carregar o componente
  useEffect(() => {
    const buscarNomesResponsaveis = async () => {
      try {
        // Para listar usuários, você já usa '?v=pegar_usuario' no App.js, então vamos usá-lo aqui também.
        const response = await fetch(`${GOOGLE_SHEETS_BASE_URL}?v=pegar_usuario`, {
            mode: 'cors' // Para requisições GET, é geralmente seguro usar 'cors' se o Apps Script permitir.
        });
        const data = await response.json();
        
        if (Array.isArray(data)) {
          // Filtra para garantir que apenas nomes válidos sejam adicionados e remove duplicatas, se houver
          const nomes = data.map(user => user.nome).filter(Boolean); 
          setNomesResponsaveis(nomes);
        } else {
          setNomesResponsaveis([]);
          console.warn('Resposta inesperada ao buscar responsáveis:', data);
        }
      } catch (error) {
        console.error('Erro ao buscar nomes de responsáveis:', error);
        setMensagemFeedback('❌ Erro ao carregar a lista de responsáveis. Verifique o console e o Apps Script.');
      }
    };

    buscarNomesResponsaveis();
  }, []); // O array vazio garante que este useEffect roda apenas uma vez ao montar o componente

  const handleCriar = async () => {
    setMensagemFeedback(''); // Limpa qualquer mensagem anterior

    // Validação dos campos obrigatórios
    if (!nomeLead || !modeloVeiculo || !anoModelo || !cidade || !telefone || !tipoSeguro || !responsavel) {
      setMensagemFeedback('⚠️ Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setIsLoading(true); // Inicia o estado de carregamento

    // Determina a aba de destino com base no tipo de seguro
    const abaDestino = (tipoSeguro === 'Indicacao') ? 'Leads Fechados' : 'Leads';

    // Objeto lead com os nomes das chaves correspondentes ao que o seu script GAS espera
    // na função doPost para o parâmetro 'criar_lead'.
    const novoLead = {
      nome: nomeLead,
      modeloVeiculo: modeloVeiculo,
      anoModelo: anoModelo,
      cidade: cidade,
      telefone: telefone,
      tipoSeguro: tipoSeguro,
      // dataCriacao deve ser uma string ISO para ser facilmente parseada pelo `new Date()` no GAS
      dataCriacao: new Date().toISOString(), 
      responsavel: responsavel,
      // Novas propriedades para indicar para qual aba enviar no front (plataforma) e no Sheets
      abaPlataforma: abaDestino,
      abaSheets: abaDestino,
    };

    try {
      // Chama a função para enviar o lead para o GAS
      await criarLeadFunc(novoLead); 

      setMensagemFeedback('✅ Lead criado com sucesso!.'); // Mensagem de sucesso

      // Se for Novo ou Renovacao, redireciona para a aba de Leads da plataforma
      if (tipoSeguro === 'Novo' || tipoSeguro === 'Renovacao') {
        // Navega para a rota de Leads (ajuste a rota se a sua aplicação usar outro path)
        navigate('/leads');
      }

      // Limpeza do formulário após sucesso
      setNomeLead('');
      setModeloVeiculo('');
      setAnoModelo('');
      setCidade('');
      setTelefone('');
      setTipoSeguro('');
      setResponsavel('');
    } catch (error) {
      setMensagemFeedback('❌ Erro ao criar o lead. Verifique sua conexão ou tente novamente. Detalhes no console.'); // Mensagem de erro
    } finally {
      setIsLoading(false); // Finaliza o estado de carregamento
    }
  };

  const criarLeadFunc = async (lead) => {
  try {
    const docRef = await addDoc(collection(db, "leads"), {
      ...lead,
      criadoEm: serverTimestamp()
    });

    console.log("Lead salvo no Firebase com ID:", docRef.id);

  } catch (error) {
    console.error("Erro ao salvar lead no Firebase:", error);
    throw error;
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
          disabled={isLoading} // Desabilita o botão enquanto estiver carregando
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
