import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService, User } from './database.js';

export class AuthService {
  constructor(private db: DatabaseService) {}

  async register(username: string, password: string): Promise<void> {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const existingUser = await this.db.getUserByUsername(username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user: User = {
      id: uuidv4(),
      username,
      password: hashedPassword
    };

    await this.db.createUser(user);
  }

  async login(username: string, password: string): Promise<User> {
    const user = await this.db.getUserByUsername(username);
    if (!user) {
      throw new Error('Invalid username or password');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('Invalid username or password');
    }

    return user;
  }
}