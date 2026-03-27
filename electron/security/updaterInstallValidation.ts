export type InstallerCandidateValidation = { ok: true } | { ok: false; reason: string };

type StatLike = {
  isFile: () => boolean;
  size: number;
};

function isUncPath(filePath: string): boolean {
  // Windows UNC paths start with \\server\share\...
  return filePath.startsWith('\\\\') || filePath.startsWith('//');
}

function hasExeExtension(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.exe');
}

export function validateInstallerCandidate(
  filePath: string,
  stat: StatLike,
  maxSize: number
): InstallerCandidateValidation {
  if (!filePath || filePath.trim().length === 0) {
    return { ok: false, reason: 'EMPTY_PATH' };
  }

  if (isUncPath(filePath)) {
    return { ok: false, reason: 'UNC_PATH_NOT_ALLOWED' };
  }

  if (!hasExeExtension(filePath)) {
    return { ok: false, reason: 'NOT_EXE' };
  }

  if (!stat?.isFile?.()) {
    return { ok: false, reason: 'NOT_A_FILE' };
  }

  const size = stat.size;
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
    return { ok: false, reason: 'INVALID_SIZE' };
  }

  if (typeof maxSize !== 'number' || !Number.isFinite(maxSize) || maxSize <= 0) {
    return { ok: false, reason: 'INVALID_MAX_SIZE' };
  }

  if (size > maxSize) {
    return { ok: false, reason: 'TOO_LARGE' };
  }

  return { ok: true };
}
