import { users, type User, type InsertUser, BotSettings, ConsoleMessage } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getBotSettings(): Promise<BotSettings>;
  updateBotSettings(settings: BotSettings): Promise<BotSettings>;
  getConsoleMessages(): Promise<ConsoleMessage[]>;
  addConsoleMessage(message: ConsoleMessage): Promise<void>;
  clearConsoleMessages(): Promise<void>;
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private botSettings: BotSettings;
  private consoleMessages: ConsoleMessage[];
  private currentId: number;
  public sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.currentId = 1;
    this.botSettings = {
      serverAddress: "mc.example.com",
      botUsername: "MinecraftBot",
      posX: 0,
      posY: 64,
      posZ: 0,
    };
    this.consoleMessages = [];
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
    
    // Add default admin user
    this.createUser({
      username: "admin",
      password: "Ab1365098958" // In a real app, this would be hashed
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getBotSettings(): Promise<BotSettings> {
    return this.botSettings;
  }

  async updateBotSettings(settings: BotSettings): Promise<BotSettings> {
    this.botSettings = settings;
    return this.botSettings;
  }

  async getConsoleMessages(): Promise<ConsoleMessage[]> {
    return this.consoleMessages;
  }

  async addConsoleMessage(message: ConsoleMessage): Promise<void> {
    this.consoleMessages.push(message);
    // Keep last 100 messages
    if (this.consoleMessages.length > 100) {
      this.consoleMessages.shift();
    }
  }

  async clearConsoleMessages(): Promise<void> {
    this.consoleMessages = [];
  }
}

export const storage = new MemStorage();
