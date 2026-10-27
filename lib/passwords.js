import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64, options);
  return `scrypt$32768$${salt}$${hash.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const [algorithm, cost, salt, hash] = encoded.split('$');
  if (algorithm !== 'scrypt' || cost !== '32768' || !salt || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const candidate = await derive(password, salt, 64, options);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}
