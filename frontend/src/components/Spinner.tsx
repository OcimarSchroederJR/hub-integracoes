export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="carregando">
      <span className="spinner" />
      <span>{texto}</span>
    </div>
  );
}
