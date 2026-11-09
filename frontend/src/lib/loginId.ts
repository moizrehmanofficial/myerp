// Login IDs look like "moiz@vertexsolutions": name @ company. They are not
// emails, so "@vertexsolutions.com" is refused before anything is sent.

export const LOGIN_ID_HINT = 'Your login ID is your name and your company, like moiz@vertexsolutions. Do not add .com.'

export function loginIdError(raw: string): string | null {
  const v = raw.trim().toLowerCase()
  if (!v) return 'Enter your login ID.'
  const at = v.lastIndexOf('@')
  if (at <= 0 || at === v.length - 1) return 'Your login ID has two parts, like moiz@vertexsolutions.'
  const company = v.slice(at + 1)
  if (company.includes('.')) {
    return `Remove "${company.slice(company.indexOf('.'))}" from your login ID. It ends with your company name, like moiz@vertexsolutions.`
  }
  if (!/^[a-z0-9._-]+$/.test(v.slice(0, at)) || !/^[a-z0-9-]+$/.test(company)) {
    return 'A login ID has only letters, numbers, dots, dashes and underscores, like moiz@vertexsolutions.'
  }
  return null
}

// Login name typed by the owner (the part before @)
export function usernameError(raw: string): string | null {
  const v = raw.trim().toLowerCase()
  if (!v) return 'Enter a login name.'
  if (v.includes('@')) return 'Type only the part before @. The company part is added for you.'
  if (/\s/.test(v)) return 'No spaces. Use a dot instead, like ali.raza.'
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,38}[a-z0-9])?$/.test(v)) {
    return 'Use letters and numbers (dots, dashes and underscores only in the middle), up to 40 characters.'
  }
  return null
}

// Suggests "ali.raza" from "Ali Raza" or "ali.raza@gmail.com"
export function suggestUsername(source: string): string {
  let s = source.trim().toLowerCase()
  if (s.includes('@')) s = s.slice(0, s.indexOf('@'))
  return s
    .replace(/\+.*$/, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/[._-]{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 34)
    .replace(/[._-]+$/g, '')
}
