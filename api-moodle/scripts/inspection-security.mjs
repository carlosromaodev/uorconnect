import { constants } from 'node:fs';
import { chmod, lstat, mkdir, open } from 'node:fs/promises';

export function hasSameOrigin(rawUrl, baseUrl) {
  try {
    return new URL(rawUrl, baseUrl).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

export async function preparePrivateDirectory(directoryPath) {
  await mkdir(directoryPath, { recursive: true, mode: 0o700 });
  const status = await lstat(directoryPath);
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new Error('O diretório de evidências deve ser um diretório real, não um link simbólico.');
  }
  await chmod(directoryPath, 0o700);
}

export async function writePrivateFile(filePath, contents) {
  const noFollow = constants.O_NOFOLLOW ?? 0;
  const handle = await open(
    filePath,
    constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | noFollow,
    0o600,
  );
  try {
    await handle.chmod(0o600);
    await handle.writeFile(contents);
  } finally {
    await handle.close();
  }
}
