/**
 * Explicaciones en lenguaje ciudadano sobre cómo se llega al Congreso: diputaciones por lista (plurinominales),
 * por qué no tienen suplente y por qué hay más personas que lugares.
 */
export function QueEsPorLista() {
  return (
    <details className="saber-mas">
      <summary>¿Qué es una diputación por lista (plurinominal)?</summary>
      <div className="pequeno">
        <p>
          El Congreso de Colima tiene 25 lugares. <strong>16</strong> se ganan en la elección de cada distrito. Los otros <strong>9</strong> se reparten entre los partidos según cuántos votos sacaron en todo el estado. Antes de la elección,
          cada partido registra una lista de personas en orden, y los lugares se dan a las primeras de su lista.
        </p>
        <p>
          A estas diputaciones también se les llama <strong>plurinominales</strong> o de <strong>representación proporcional</strong>. No representan a un distrito: representan a todo Colima.
        </p>
        <p>
          <strong>¿Por qué no tienen suplente?</strong> Así lo dice el Código Electoral del Estado de Colima: en cada distrito se elige una persona titular y una suplente, pero en las listas no. Si alguien de la lista deja su lugar, entra la
          siguiente persona de la lista de su mismo partido.
        </p>
      </div>
    </details>
  );
}

export function CadaQuienResponde() {
  return (
    <details className="saber-mas">
      <summary>¿Por qué hay más personas que lugares?</summary>
      <div className="pequeno">
        <p>
          Cuando una diputada o diputado pide <strong>licencia</strong> (permiso para dejar el cargo un tiempo), su lugar lo ocupa otra persona: su suplente, si ganó en un distrito, o la siguiente de la lista, si llegó por lista.
        </p>
        <p>
          Por eso <strong>cada quien responde por el tiempo en que estuvo en el cargo</strong>: a cada persona le contamos solo lo que hizo en esas fechas (sus asistencias, sus votos y sus propuestas). Así, nadie se queda con el trabajo de otra
          persona, y quien estuvo menos tiempo tiene, normalmente, números más bajos.
        </p>
      </div>
    </details>
  );
}
