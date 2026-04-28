/**
 * Stepper numérico (− N +). Auto-bindea cualquier `.stepper` con
 * `data-stepper-min`, `data-stepper-max`, `data-stepper-step`.
 *
 * El input interno mantiene su `id` para compatibilidad con el código que
 * lee el valor por `document.getElementById(...)`. El value es siempre
 * dígitos puros (string) o vacío — `Number(value)` funciona como antes.
 */

export function initSteppers(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.stepper').forEach((el) => {
    if (el.dataset.stepperBound === '1') return
    el.dataset.stepperBound = '1'

    const input = el.querySelector<HTMLInputElement>('input.stepper-input')
    const dec = el.querySelector<HTMLButtonElement>('.stepper-dec')
    const inc = el.querySelector<HTMLButtonElement>('.stepper-inc')
    if (!input || !dec || !inc) return

    const min = Number(el.dataset.stepperMin ?? '0')
    const max = Number(el.dataset.stepperMax ?? '999')
    const step = Number(el.dataset.stepperStep ?? '1')

    const clamp = (n: number) => Math.max(min, Math.min(max, n))
    const current = () => {
      const n = parseInt(input.value.replace(/\D+/g, ''), 10)
      return Number.isFinite(n) ? n : min
    }
    const setValue = (n: number) => {
      input.value = String(clamp(n))
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }

    dec.addEventListener('click', () => {
      if (input.value === '') return setValue(min)
      setValue(current() - step)
    })
    inc.addEventListener('click', () => {
      if (input.value === '') return setValue(min + step)
      setValue(current() + step)
    })
    input.addEventListener('input', () => {
      // Forzar solo dígitos sin disparar otra ronda de eventos.
      const digits = input.value.replace(/\D+/g, '')
      if (digits !== input.value) input.value = digits
    })
    input.addEventListener('blur', () => {
      if (input.value !== '') input.value = String(clamp(current()))
    })
  })
}
