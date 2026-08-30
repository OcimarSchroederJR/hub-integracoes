import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mensagemDeErro } from '../api/client';
import type { Execucao } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';

export function DashboardPage() {
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [disparando, setDisparando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const resposta = await api.get<Execucao[]>('/execucoes', { params: { limite: 30 } });
      setExecucoes(resposta.data);
      setErro(null);
    } catch (erroCarga) {
      setErro(mensagemDeErro(erroCarga));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 5000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  async function dispararExecucao(parceiro: string): Promise<void> {
    setDisparando(parceiro);
    setErro(null);
    try {
      await api.post(`/integracoes/${parceiro}/execucoes`);
      await carregar();
    } catch (erroDisparo) {
      setErro(mensagemDeErro(erroDisparo));
    } finally {
      setDisparando(null);
    }
  }

  return (
    <div>
      <div className="cabecalho-secao">
        <h2>Execuções</h2>
        <div className="acoes">
          <button onClick={() => dispararExecucao('alfa')} disabled={disparando !== null}>
            {disparando === 'alfa' ? 'Disparando…' : 'Disparar Alfa'}
          </button>
          <button onClick={() => dispararExecucao('beta')} disabled={disparando !== null}>
            {disparando === 'beta' ? 'Disparando…' : 'Disparar Beta'}
          </button>
        </div>
      </div>

      {erro && <p className="mensagem-erro">{erro}</p>}

      {carregando ? (
        <p>Carregando…</p>
      ) : execucoes.length === 0 ? (
        <p className="texto-vazio">Nenhuma execução ainda. Dispare uma acima.</p>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th>Parceiro</th>
              <th>Situação</th>
              <th>Recebidos</th>
              <th>Persistidos</th>
              <th>Rejeitados</th>
              <th>Falhas</th>
              <th>Iniciada em</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {execucoes.map((execucao) => (
              <tr key={execucao.id}>
                <td>{execucao.parceiro?.codigo ?? '—'}</td>
                <td>
                  <StatusBadge situacao={execucao.situacao} />
                </td>
                <td>{execucao.totalRecebidos}</td>
                <td>{execucao.totalPersistidos}</td>
                <td>{execucao.totalRejeitados}</td>
                <td>{execucao.totalFalhas}</td>
                <td>{new Date(execucao.iniciadaEm).toLocaleString('pt-BR')}</td>
                <td>
                  <Link to={`/execucoes/${execucao.id}`}>ver detalhes</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
