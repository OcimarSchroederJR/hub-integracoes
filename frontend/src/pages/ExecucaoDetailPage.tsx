import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, mensagemDeErro } from '../api/client';
import type { Execucao, Registro, SituacaoRegistro } from '../api/types';
import { StatusBadge } from '../components/StatusBadge';

const SITUACOES: Array<SituacaoRegistro | 'TODAS'> = ['TODAS', 'PENDENTE', 'PERSISTIDO', 'REJEITADO', 'FALHA'];

export function ExecucaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [execucao, setExecucao] = useState<Execucao | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [filtro, setFiltro] = useState<SituacaoRegistro | 'TODAS'>('TODAS');
  const [erro, setErro] = useState<string | null>(null);
  const [acao, setAcao] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    try {
      const [respostaExecucao, respostaRegistros] = await Promise.all([
        api.get<Execucao>(`/execucoes/${id}`),
        api.get<Registro[]>(`/execucoes/${id}/registros`, {
          params: filtro === 'TODAS' ? {} : { situacao: filtro },
        }),
      ]);
      setExecucao(respostaExecucao.data);
      setRegistros(respostaRegistros.data);
      setErro(null);
    } catch (erroCarga) {
      setErro(mensagemDeErro(erroCarga));
    }
  }, [id, filtro]);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 5000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  async function reprocessarExecucao(): Promise<void> {
    if (!id) return;
    setAcao('execucao');
    try {
      await api.post(`/execucoes/${id}/reprocessar`);
      await carregar();
    } catch (erroAcao) {
      setErro(mensagemDeErro(erroAcao));
    } finally {
      setAcao(null);
    }
  }

  async function reprocessarRegistro(registroId: string): Promise<void> {
    setAcao(registroId);
    try {
      await api.post(`/registros/${registroId}/reprocessar`);
      await carregar();
    } catch (erroAcao) {
      setErro(mensagemDeErro(erroAcao));
    } finally {
      setAcao(null);
    }
  }

  if (!execucao) {
    return <p>{erro ?? 'Carregando…'}</p>;
  }

  const podeReprocessar = execucao.totalFalhas > 0 || execucao.totalRejeitados > 0;

  return (
    <div>
      <p>
        <Link to="/">← voltar</Link>
      </p>

      <div className="cabecalho-secao">
        <h2>
          Execução {execucao.parceiro?.codigo} <StatusBadge situacao={execucao.situacao} />
        </h2>
        <button onClick={reprocessarExecucao} disabled={!podeReprocessar || acao !== null}>
          {acao === 'execucao' ? 'Reprocessando…' : 'Reprocessar falhas/rejeitados'}
        </button>
      </div>

      <dl className="detalhes-grade">
        <div>
          <dt>Correlation ID</dt>
          <dd>
            <code>{execucao.correlationId}</code>
          </dd>
        </div>
        <div>
          <dt>Recebidos</dt>
          <dd>{execucao.totalRecebidos}</dd>
        </div>
        <div>
          <dt>Persistidos</dt>
          <dd>{execucao.totalPersistidos}</dd>
        </div>
        <div>
          <dt>Rejeitados</dt>
          <dd>{execucao.totalRejeitados}</dd>
        </div>
        <div>
          <dt>Falhas</dt>
          <dd>{execucao.totalFalhas}</dd>
        </div>
        <div>
          <dt>Duração</dt>
          <dd>{execucao.duracaoMs ? `${(execucao.duracaoMs / 1000).toFixed(1)}s` : '—'}</dd>
        </div>
      </dl>

      {erro && <p className="mensagem-erro">{erro}</p>}

      <div className="cabecalho-secao">
        <h3>Registros</h3>
        <select value={filtro} onChange={(evento) => setFiltro(evento.target.value as typeof filtro)}>
          {SITUACOES.map((situacao) => (
            <option key={situacao} value={situacao}>
              {situacao}
            </option>
          ))}
        </select>
      </div>

      {registros.length === 0 ? (
        <p className="texto-vazio">Nenhum registro com esse filtro.</p>
      ) : (
        <table className="tabela">
          <thead>
            <tr>
              <th>Identificador</th>
              <th>Situação</th>
              <th>Motivo</th>
              <th>Tentativas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {registros.map((registro) => (
              <tr key={registro.id}>
                <td>{registro.identificadorExterno}</td>
                <td>
                  <StatusBadge situacao={registro.situacao} />
                </td>
                <td className="texto-truncado" title={registro.motivoRejeicao ?? ''}>
                  {registro.motivoRejeicao ?? '—'}
                </td>
                <td>{registro.tentativas}</td>
                <td>
                  {(registro.situacao === 'FALHA' || registro.situacao === 'REJEITADO') && (
                    <button
                      className="botao-pequeno"
                      onClick={() => reprocessarRegistro(registro.id)}
                      disabled={acao !== null}
                    >
                      {acao === registro.id ? '…' : 'reprocessar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
