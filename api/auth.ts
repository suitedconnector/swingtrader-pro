import bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Migration logic: if the "hash" doesn't look like a bcrypt hash (e.g., plain text),
  // we could potentially handle it, but for security, we mandate a reset.
  // Existing placeholder passwords ("hashedpassword") will fail verification.
  return bcrypt.compare(password, hash);
}
