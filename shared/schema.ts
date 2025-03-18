import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Bot settings schema
export const botSettingsSchema = z.object({
  serverAddress: z.string().min(1, "Server address is required"),
  botUsername: z.string().min(1, "Bot username is required"),
  posX: z.number().int(),
  posY: z.number().int(),
  posZ: z.number().int(),
});

export type BotSettings = z.infer<typeof botSettingsSchema>;

// Bot status schema
export const botStatusSchema = z.object({
  connected: z.boolean(),
  activity: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }),
  time: z.string(),
  players: z.array(z.string()),
  area: z.array(z.boolean()), // 3x3 grid representation
});

export type BotStatus = z.infer<typeof botStatusSchema>;

// Console message schema
export const consoleMessageSchema = z.object({
  timestamp: z.string(),
  message: z.string(),
  type: z.enum(["info", "warning", "error"]),
});

export type ConsoleMessage = z.infer<typeof consoleMessageSchema>;
