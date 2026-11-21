import { REMUNERACION_DIPUTACION as R } from '../config/remuneraciones';
import { EnlaceExterno } from './Fuente';
import { claseNuevo, Nuevo } from './Nuevo';

const pesos = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const conSigno = (v: number) => (v < 0 ? `−${pesos(-v)}` : pesos(v));

/** «¿Cuánto gana una diputación?»: el mismo monto para las 25, con el documento oficial. */
export function CuantoGana() {
  const q = R.quincena;
  const minimoMes = R.salarioMinimoDiario * 30;
  const veces = (q.bruto * 2) / minimoMes;
  const filas: { concepto: string; valor: number; total?: boolean }[] = [
    { concepto: 'Dieta (el pago por ser diputada o diputado)', valor: q.dieta },
    { concepto: 'Previsión social', valor: q.previsionSocial },
    { concepto: 'Total antes de impuestos', valor: q.bruto, total: true },
    { concepto: 'Menos el impuesto (ISR)', valor: -q.isr },
    { concepto: 'Menos el descuento para su pensión', valor: -q.pensiones },
    { concepto: 'Lo que recibe', valor: q.neto, total: true },
  ];
  return (
    <section className={`seccion${claseNuevo()}`} id="cuanto-gana" aria-labelledby="titulo-cuanto-gana" style={{ scrollMarginTop: 90 }}>
      <h2 id="titulo-cuanto-gana">¿Cuánto gana una diputación?</h2>
      <Nuevo texto="cuánto gana una diputación, con el documento oficial; ahora va primero" />
      <div className="panel cuanto-gana">
        <p className="cuanto-gana__frase">
          Las 25 diputaciones ganan lo mismo. En {R.anio}, cada una recibe <strong>{pesos(q.neto * 2)} al mes</strong> después de impuestos. Antes de impuestos son {pesos(q.bruto * 2)}: casi{' '}
          <strong>{Math.round(veces)} veces el salario mínimo</strong>.
        </p>
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th scope="col">Concepto</th>
                <th scope="col" className="num cuanto-gana__quincena">
                  Cada quincena
                </th>
                <th scope="col" className="num">
                  Al mes
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.concepto} className={f.total ? 'cuanto-gana__total' : undefined}>
                  <th scope="row">{f.concepto}</th>
                  <td className="num cuanto-gana__quincena">{conSigno(f.valor)}</td>
                  <td className="num">{conSigno(f.valor * 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pequeno texto-2">
          <span className="cuanto-gana__nota-quincena">Cada quincena recibe la mitad de lo que dice la tabla. </span>El salario mínimo de {R.anio} es de {pesos(R.salarioMinimoDiario)} al día (unos {pesos(minimoMes)} al mes). El tabulador también menciona aguinaldo, bonos y prima vacacional, pero no dice con claridad si les tocan a las
          diputaciones; por eso no los sumamos. Los pediremos al Congreso por transparencia.
        </p>
        <p className="muy-pequeno texto-3" style={{ marginBottom: 0 }}>
          Fuente: <EnlaceExterno url={R.fuente.url}>{R.fuente.titulo}</EnlaceExterno>. {R.fuente.publicacion}. Salario mínimo: CONASAMI, Diario Oficial de la Federación, 9 de diciembre de 2025.
        </p>
      </div>
    </section>
  );
}
