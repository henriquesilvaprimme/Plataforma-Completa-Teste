import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';

const CriarUsuario = ({ adicionarUsuario }) => {
  const [usuario, setUsuario] = useState(''); // Será usado como login
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState(''); // Nome completo
  const [senha, setSenha] = useState('');

  const navigate = useNavigate();

  const handleCriar = async () => {
    if (!usuario || !email || !nome || !senha) {
      alert('Preencha todos os campos.');
      return;
    }

    const novoUsuario = {
      id: Date.now(),
      usuario, // Usado como login
      email,
      nome, // Nome completo
      senha,
      tipo: 'Usuario',
      status: 'Ativo',
    };

    try {
      // Grava no Firestore na coleção 'usuarios' usando o id gerado
      const userRef = doc(db, 'usuarios', String(novoUsuario.id));
      await setDoc(userRef, novoUsuario);
    } catch (err) {
      console.error('Erro ao salvar usuário no Firebase:', err);
      alert('Erro ao salvar usuário no Firebase. Veja o console para detalhes.');
      return;
    }

    // Atualiza lista local via prop e navega
    adicionarUsuario(novoUsuario);

    navigate('/usuarios');
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white rounded-xl shadow-md space-y-6">
      <h2 className="text-3xl font-bold text-indigo-700 mb-4">Criar Novo Usuário</h2>

      <div>
        <label className="block text-gray-700">Usuário (Login)</label>
        <input
          type="text"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="w-full mt-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div>
        <label className="block text-gray-700">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mt-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div>
        <label className="block text-gray-700">Nome Completo</label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full mt-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div>
        <label className="block text-gray-700">Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full mt-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleCriar}
          className="bg-indigo-500 text-white px-6 py-2 rounded-lg hover:bg-indigo-600 transition"
        >
          Criar Usuário
        </button>
      </div>
    </div>
  );
};

export default CriarUsuario;
