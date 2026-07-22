export function hasAllowedExtension(fileName: string, extension: string): boolean {
  return fileName.toLocaleLowerCase('en-US').endsWith(extension.toLocaleLowerCase('en-US'))
}
