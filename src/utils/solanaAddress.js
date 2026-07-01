const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export function shortenAddress(address, front = 6, back = 6) {
  if (!address) return ''
  return `${address.slice(0, front)}…${address.slice(-back)}`
}

function decodedBase58Length(value) {
  const bytes = [0]

  for (const character of value) {
    const characterValue = BASE58_ALPHABET.indexOf(character)
    if (characterValue < 0) return 0

    let carry = characterValue
    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index] * 58
      bytes[index] = carry & 0xff
      carry >>= 8
    }

    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }

  for (let index = 0; value[index] === '1' && index < value.length - 1; index += 1) {
    bytes.push(0)
  }

  return bytes.length
}

export function isValidSolanaAddress(value) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false
  return decodedBase58Length(value) === 32
}

export function formatDate(blockTime) {
  if (!blockTime) return 'Unavailable'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(blockTime * 1000))
}
