export async function writeClipboard(value) {
  if (!value) return false

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Fall through to the selection-based browser fallback.
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.inset = '0 auto auto -9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, value.length)

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

export async function readClipboard() {
  if (!navigator.clipboard?.readText) {
    return { ok: false, reason: 'unsupported' }
  }

  try {
    return { ok: true, text: await navigator.clipboard.readText() }
  } catch {
    return { ok: false, reason: 'blocked' }
  }
}
