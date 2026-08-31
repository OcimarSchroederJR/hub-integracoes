import { useEffect, useState } from 'react';
import { api, mensagemDeErro } from '../api/client';
import type { Sobreposicao } from '../api/types';
import { Carregando } from '../components/Spinner';

function formatarCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function SobreposicoesPage() {
  const [sobreposicoes, setSobreposicoes] = useState<Sobreposicao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Sobreposicao[]>('/devedores/sobreposicoes')
      .then((resposta) => setSobreposicoes(resposta.data))
      .catch((erroCarga) => setErro(mensagemDeErro(erroCarga)))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div>
      <h2>Sobreposições entre parceiros</h2>
      <p className="subtitulo">
        Mesmo devedor com dívida ativa em dois parceiros diferentes e valor parecido (tolerância de 10%).
      </p>

      {erro && <p className="mensagem-erro">{erro}</p>}

      {carregando ? (
        <Carregando />
      ) : sobreposicoes.length === 0 ? (
        <div className="estado-vazio">
          <div className="icone">◌</div>
          <p>Nenhuma sobreposição detectada.</p>
        </div>
      ) : (
        <div className="tabela-wrap">
          <table className="tabela">
            <thead>
              <tr>
                <th>Devedor</th>
                <th>Documento</th>
                <th>Parceiro A</th>
                <th>Valor A</th>
                <th>Parceiro B</th>
                <th>Valor B</th>
                <th>Detectado em</th>
              </tr>
            </thead>
            <tbody>
              {sobreposicoes.map((sobreposicao) => (
                <tr key={sobreposicao.id}>
                  <td>{sobreposicao.devedor?.nome ?? '—'}</td>
                  <td>{sobreposicao.devedor?.documento ?? '—'}</td>
                  <td>
                    {sobreposicao.parceiroACodigo} · {sobreposicao.numeroContratoA}
                  </td>
                  <td className="numerico">{formatarCentavos(sobreposicao.valorAtualizadoA)}</td>
                  <td>
                    {sobreposicao.parceiroBCodigo} · {sobreposicao.numeroContratoB}
                  </td>
                  <td className="numerico">{formatarCentavos(sobreposicao.valorAtualizadoB)}</td>
                  <td>{new Date(sobreposicao.detectadoEm).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
