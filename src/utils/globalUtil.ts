export type Expand<T> = { [K in keyof T]: T[K] }

export const exportFile = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')

  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}
