/**
 * Toggle de estado loading para botones. Inserta un spinner como primer hijo
 * y aplica `.is-loading` + `disabled`. Idempotente y reversible sin pisar
 * cambios manuales que el caller haga al label (textContent del span interno).
 *
 * El spinner usa `currentColor` así hereda el color del botón (funciona tanto
 * en .btn-primary como en botones custom).
 */

const SPINNER_CLASS = 'btn-spinner'

function makeSpinner(): HTMLSpanElement {
  const sp = document.createElement('span')
  sp.className = SPINNER_CLASS
  sp.setAttribute('aria-hidden', 'true')
  return sp
}

export function setBtnLoading(btn: HTMLButtonElement | null, loading: boolean): void {
  if (!btn) return
  btn.disabled = loading
  btn.classList.toggle('is-loading', loading)
  btn.setAttribute('aria-busy', loading ? 'true' : 'false')

  const existing = btn.querySelector<HTMLSpanElement>(`:scope > .${SPINNER_CLASS}`)
  if (loading && !existing) {
    btn.prepend(makeSpinner())
  } else if (!loading && existing) {
    existing.remove()
  }
}
