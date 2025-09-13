import * as bcrypt from 'bcrypt';

async function hashPassword() {
  const password = 'admin123'; // Change this
  const hash = await bcrypt.hash(password, 10);
  console.log('Password hash:', hash);
}

hashPassword();
