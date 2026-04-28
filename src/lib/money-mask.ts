/**
 * Máscara de dinero estilo es-AR: formatea con separador de miles "."
 * (ej: 2500000 → "2.500.000") mientras el usuario tipea.
 *
 * Uso:
 *  1. En el input HTML: type="text" inputmode="numeric" data-money-mask
 *  2. En el script de la página: `import { initMoneyMasks, unmaskMoney } from '../lib/money-mask'`
 *     Llamar `initMoneyMasks()` al cargar; al leer el value usar `unmaskMoney(input.value)`.
 *
 * No depende de librerías externas. Soporta pegar valores con puntos/comas/espacios.
 */

export function unmaskMoney(value: string | null | undefined): number | null {
  if (value == null) return null
  const digits = String(value).replace(/\D+/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
}

function formatMiles(digits: string): string {
  // Inserta puntos cada 3 dígitos desde la derecha. Sin decimales — montos enteros.
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export function attachMoneyMask(el: HTMLInputElement): void {
  if (el.dataset.moneyMaskBound === '1') return
  el.dataset.moneyMaskBound = '1'

  const reformat = () => {
    const start = el.selectionStart ?? el.value.length
    const before = el.value
    const digitsBefore = before.slice(0, start).replace(/\D+/g, '').length
    const digitsAll = before.replace(/\D+/g, '')
    const formatted = formatMiles(digitsAll)
    el.value = formatted
    // Reposicionar caret manteniendo la cantidad de dígitos a la izquierda.
    let pos = 0
    let seen = 0
    while (pos < formatted.length && seen < digitsBefore) {
      if (/\d/.test(formatted[pos])) seen++
      pos++
    }
    try {
      el.setSelectionRange(pos, pos)
    } catch {
      // Algunos type="text" no soportan setSelectionRange si no son editables aún; ignorar.
    }
  }

  el.addEventListener('input', reformat)
  el.addEventListener('blur', reformat)
  // Si ya viene con value (autofill / ?param=), formatearlo.
  if (el.value) reformat()
}

export function initMoneyMasks(root: ParentNode = document): void {
  root.querySelectorAll<HTMLInputElement>('input[data-money-mask]').forEach(attachMoneyMask)
}
