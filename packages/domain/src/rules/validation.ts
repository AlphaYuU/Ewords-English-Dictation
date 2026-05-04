export type ValidationResult = { valid: true } | { valid: false; message: string };

export function validateLibraryName(name: string, existingNames: string[] = []): ValidationResult {
  const normalized = name.trim();
  if (!normalized) return { valid: false, message: "词库名称不能为空" };
  if (normalized.length > 40) return { valid: false, message: "词库名称不能超过 40 字" };
  if (existingNames.map((item) => item.trim()).includes(normalized)) {
    return { valid: false, message: "词库名称已存在" };
  }
  return { valid: true };
}

export function validateWordInput(word: string, meaning: string): ValidationResult {
  if (!word.trim()) return { valid: false, message: "单词不能为空" };
  if (!meaning.trim()) return { valid: false, message: "释义不能为空" };
  if (!/^[A-Za-z][A-Za-z\s'-]*$/.test(word.trim())) {
    return { valid: false, message: "单词只能包含英文、空格、连字符和撇号" };
  }
  if (meaning.trim().length > 500) return { valid: false, message: "释义不能超过 500 字" };
  return { valid: true };
}
