/** Shrink a pasted or picked image to a web-friendly size so it fits a task (docs are capped at 256 KiB). */
export async function shrinkImage(file: Blob, maxSide = 1400, maxBytes = 170_000): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  const toBlob = (q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', q))
  let q = 0.82
  let blob = await toBlob(q)
  while (blob && blob.size > maxBytes && q > 0.2) {
    q -= 0.12
    blob = await toBlob(q)
  }
  return blob ?? file
}

export const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })
