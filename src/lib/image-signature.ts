// Magic-byte validation for uploaded images. The browser-declared MIME type
// (file.type) is attacker-controlled; checking the actual file signature
// prevents storing arbitrary content (HTML, scripts, executables) under an
// image extension.

export function matchesImageSignature(mimeType: string, buffer: Buffer): boolean {
  if (buffer.length < 12) return false
  switch (mimeType) {
    case 'image/jpeg':
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    case 'image/png':
      return (
        buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
      )
    case 'image/gif':
      return buffer.subarray(0, 3).toString('ascii') === 'GIF'
    case 'image/webp':
      return (
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      )
    default:
      return false
  }
}
