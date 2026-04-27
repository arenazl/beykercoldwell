export interface ThinkingOptions {
  messages: string[]
  intervalMs?: number
}

export function startThinking(el: HTMLElement, opts: ThinkingOptions): () => void {
  const { messages } = opts
  const intervalMs = opts.intervalMs ?? 1500
  let i = 0
  el.textContent = `${messages[0]}…`
  const id = window.setInterval(() => {
    i = (i + 1) % messages.length
    el.textContent = `${messages[i]}…`
  }, intervalMs)
  return () => clearInterval(id)
}
