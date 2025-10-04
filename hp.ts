import * as bcrypt from 'bcrypt';

async function hashPassword() {
  const password = '@BeVar$2025@'; // Change this @BeVar$2025@ local - @Admin123@
  const hash = await bcrypt.hash(password, 10);
  console.log('Password hash:', hash);
}

hashPassword();
