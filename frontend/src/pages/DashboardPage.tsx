import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mensagemDeErro } from '../api/client';
import type { Execucao } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';
import { Carregando } from '../components/Spinner';

const SITUACOES_EM_ANDAMENTO = new Set(['PENDENTE', 'PROCESSANDO']);

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

  const kpis = useMemo(() => {
    const emAndamento = execucoes.filter((execucao) => SITUACOES_EM_ANDAMENTO.has(execucao.situacao)).length;
    const comFalha = execucoes.filter((execucao) => execucao.totalFalhas > 0).length;
    const totalRecebidos = execucoes.reduce((soma, execucao) => soma + execucao.totalRecebidos, 0);
    const totalPersistidos = execucoes.reduce((soma, execucao) => soma + execucao.totalPersistidos, 0);
    const taxaSucesso = totalRecebidos > 0 ? Math.round((totalPersistidos / totalRecebidos) * 100) : null;
    return { emAndamento, comFalha, taxaSucesso };
  }, [execucoes]);

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

      {!carregando && execucoes.length > 0 && (
        <div className="kpis">
          <div className="kpi">
            <div className="kpi-rotulo">Execuções recentes</div>
            <div className="kpi-valor">{execucoes.length}</div>
          </div>
          <div className="kpi">
            <div className="kpi-rotulo">Em andamento</div>
            <div className="kpi-valor cor-acento">{kpis.emAndamento}</div>
          </div>
          <div className="kpi">
            <div className="kpi-rotulo">Com falha</div>
            <div className={`kpi-valor ${kpis.comFalha > 0 ? 'cor-critico' : ''}`}>{kpis.comFalha}</div>
          </div>
          <div className="kpi">
            <div className="kpi-rotulo">Taxa de persistência</div>
            <div className="kpi-valor cor-bom">{kpis.taxaSucesso !== null ? `${kpis.taxaSucesso}%` : '—'}</div>
          </div>
        </div>
      )}

      {erro && <p className="mensagem-erro">{erro}</p>}

      {carregando ? (
        <Carregando />
      ) : execucoes.length === 0 ? (
        <div className="estado-vazio">
          <div className="icone">◌</div>
          <p>Nenhuma execução ainda. Dispare uma acima para começar.</p>
        </div>
      ) : (
        <div className="tabela-wrap">
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
                  <td className="numerico">{execucao.totalRecebidos}</td>
                  <td className="numerico">{execucao.totalPersistidos}</td>
                  <td className="numerico">{execucao.totalRejeitados}</td>
                  <td className="numerico">{execucao.totalFalhas}</td>
                  <td>{new Date(execucao.iniciadaEm).toLocaleString('pt-BR')}</td>
                  <td>
                    <Link to={`/execucoes/${execucao.id}`}>ver detalhes</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
