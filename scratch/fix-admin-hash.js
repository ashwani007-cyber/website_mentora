import bcrypt from 'bcryptjs';
import fs from 'fs';

const password = 'H@a#n&u*m$a%n/J!i12/07/2006';
const hash = bcrypt.hashSync(password, 10);
console.log('Password length:', password.length);
console.log('Includes $a:', password.includes('$a'));
console.log('Generated hash:', hash);

const dbPath = 'db.json';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const user = db.users.find(u => u.email === 'kushwahaashwani12@gmail.com');
if (user) {
  user.password_hash = hash;
  user.role = 'admin';
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log('Successfully updated db.json for admin kushwahaashwani12@gmail.com');
} else {
  console.error('User not found!');
}
