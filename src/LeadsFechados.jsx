// src/LeadsFechados.jsx
import React, { useEffect, useState } from 'react';
import { getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore';

/**
 * LeadsFechados
 * Props:
 * - currentUser: objeto do usuário { uid: string, tipo?: string, role?: string, isAdmin?: boolean, admin?: boolean, ... }
 *
 * Observações:
 * - Admin verá todos os leads.
 * - Usuário verá apenas leads relacionados ao seu uid (por campos comuns: usuarioId, userId, ownerId, createdBy).
 */
export default function LeadsFechados({ currentUser }) {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchLeads() {
      setLoading(true);
      setError(null);

      if (!currentUser) {
        setLeads([]);
        setLoading(false);
        return;
      }

      try {
        const app = getApp(); // pressupõe inicialização do Firebase em outro lugar
        const db = getFirestore(app);
        const colRef = collection(db, 'leadsFechados');

        // Detecta se é admin de forma flexível
        const tipo = (currentUser.tipo || currentUser.role || '').toString();
        const isAdmin =
          currentUser?.isAdmin === true ||
          currentUser?.admin === true ||
          /admin/i.test(tipo) ||
          /administrator/i.test(tipo);

        console.debug('LeadsFechados: isAdmin=', isAdmin, 'currentUser=', currentUser);

        // Função utilitária para ordenar por closedAt (se existir)
        const normalizeAndSort = (docsArray) => {
          const normalized = docsArray.map((d) => {
            // Se closedAt for um timestamp do Firestore (com seconds), converte para Date
            const closedAt = d.closedAt;
            let closedAtDate = null;
            if (closedAt && typeof closedAt === 'object') {
              if (closedAt.seconds) {
                closedAtDate = new Date(closedAt.seconds * 1000);
              } else if (closedAt.toDate && typeof closedAt.toDate === 'function') {
                closedAtDate = closedAt.toDate();
              }
            } else if (closedAt) {
              // se for string (ISO) ou número
              closedAtDate = new Date(closedAt);
            }
            return { ...d, closedAtDate };
          });

          // Ordena por closedAtDate descendente quando disponível
          normalized.sort((a, b) => {
            if (a.closedAtDate && b.closedAtDate) return b.closedAtDate - a.closedAtDate;
            if (a.closedAtDate) return -1;
            if (b.closedAtDate) return 1;
            return 0;
          });

          return normalized;
        };

        if (isAdmin) {
          // Admin: busca todos (one-time)
          const snap = await getDocs(colRef);
          const items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          if (!isMounted) return;
          setLeads(normalizeAndSort(items));
          setLoading(false);
          console.debug('LeadsFechados: fetched all leads (admin). count=', items.length);
          return;
        }

        // Se não for admin, busca por UID em campos comuns
        const uid = currentUser.uid;
        const candidateFields = ['usuarioId', 'userId', 'ownerId', 'createdBy'];
        let foundItems = [];

        for (let field of candidateFields) {
          // cria uma query where(field, '==', uid)
          const q = query(colRef, where(field, '==', uid));
          const snap = await getDocs(q);
          if (!isMounted) return;
          if (!snap.empty) {
            foundItems = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            console.debug(`LeadsFechados: found with field "${field}", count=${foundItems.length}`);
            break;
          } else {
            console.debug(`LeadsFechados: no results with field "${field}"`);
          }
        }

        // Se não encontrou por campos específicos, busca tudo e filtra client-side (fallback)
        if (foundItems.length === 0) {
          console.debug('LeadsFechados: no hits by specific fields, fetching all and filtering client-side as fallback (may be expensive).');
          const snapAll = await getDocs(colRef);
          if (!isMounted) return;
          const allItems = snapAll.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          // filtra onde qualquer um dos candidateFields === uid
          foundItems = allItems.filter((it) =>
            candidateFields.some((f) => it[f] === uid)
          );
          console.debug('LeadsFechados: fallback filtered count=', foundItems.length);
        }

        if (!isMounted) return;
        setLeads(normalizeAndSort(foundItems));
        setLoading(false);
      } catch (err) {
        console.error('LeadsFechados: erro ao buscar leadsFechados', err);
        if (!isMounted) return;
        setError(err);
        setLoading(false);
      }
    }

    fetchLeads();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  if (loading) return <div>Carregando leads fechados...</div>;
  if (error) return <div>Erro ao carregar leads: {String(error.message || error)}</div>;
  if (!leads.length) return <div>Nenhum lead fechado encontrado.</div>;

  return (
    <div>
      <h2>Leads Fechados</h2>
      <ul>
        {leads.map((lead) => (
          <li key={lead.id} style={{ marginBottom: 12 }}>
            <strong>{lead.nome || lead.title || lead.name || 'Sem título'}</strong>
            <div>id: {lead.id}</div>
            <div>usuarioId: {lead.usuarioId ?? lead.userId ?? lead.ownerId ?? lead.createdBy ?? '—'}</div>
            {lead.closedAtDate ? (
              <div>Fechado em: {lead.closedAtDate.toLocaleString()}</div>
            ) : lead.closedAt ? (
              <div>Fechado em: {String(lead.closedAt)}</div>
            ) : null}
            {/* Exiba outros campos necessários */}
          </li>
        ))}
      </ul>
    </div>
  );
}
