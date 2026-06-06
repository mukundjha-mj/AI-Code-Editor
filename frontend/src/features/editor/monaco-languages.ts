const languageByExtension: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".markdown": "markdown",
};

export const getMonacoLanguage = (filePath: string): string => {
  const extensionIndex = filePath.lastIndexOf(".");
  if (extensionIndex === -1) {
    return "plaintext";
  }
  const extension = filePath.slice(extensionIndex).toLowerCase();
  return languageByExtension[extension] ?? "plaintext";
};
