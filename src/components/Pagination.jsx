// Paginación ligera para listas largas (evita renderizar cientos de filas)
export default function Pagination({ page, total, pageSize, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  // Ventana de páginas: máximo 5 botones sin mostrar decenas
  const start = Math.max(1, Math.min(page - 2, pages - 4))
  const end = Math.min(pages, start + 4)
  const nums = []
  for (let i = start; i <= end; i++) nums.push(i)

  return (
    <div className="pagination">
      <span className="muted tiny">
        {from}–{to} de {total}
      </span>
      <div className="pagination-btns">
        <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Anterior">
          ‹
        </button>
        {nums.map((n) => (
          <button
            key={n}
            className={`page-btn ${n === page ? 'active' : ''}`}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        ))}
        <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Siguiente">
          ›
        </button>
      </div>
    </div>
  )
}