/**
 * Feature registry (Phase 2, ADR-0001)
 *
 * Features are packages of routes/WS/migrations. The app shell (src/index.ts)
 * iterates registered features; feature-specific logic lives only inside
 * src/features/<name>/.
 *
 * Static registration happens in src/registration.ts; Phase 3 swaps that file
 * for TOME_PLUGINS scanning.
 */
import type { Database } from "bun:sqlite";
import type { Server, ServerWebSocket } from "bun";
import type { ReaderSettings } from "../config";
export interface FeatureRouteContext {
  req: Request;
  path: string;
  url: URL;
  settings: ReaderSettings;
  userId: string;
  isAdmin: boolean;
}

/** Payload stored on every feature-managed WebSocket connection. */
export interface FeatureWsData {
  featureIndex: number;
  pathIndex: number;
  params: unknown;
}

export interface FeatureWsPath {
  /**
   * Claim a WS path. Return null to not claim; any other value claims the
   * path and is passed to upgrade() as params.
   */
  match(path: string, url: URL): unknown | null;
  /**
   * Perform the upgrade (server.upgrade) or reject with a Response.
   * Returns undefined when the connection was upgraded (Bun convention).
   */
  upgrade(req: Request, server: Server<FeatureWsData>, params: unknown): Response | undefined;
  open?(ws: ServerWebSocket<FeatureWsData>, params: unknown): void;
  message?(ws: ServerWebSocket<FeatureWsData>, message: string | Buffer, params: unknown): void;
  close?(ws: ServerWebSocket<FeatureWsData>, code: number, reason: string, params: unknown): void;
}

export interface Feature {
  name: string;
  pageRoutes?(ctx: FeatureRouteContext): Promise<Response | null>;
  apiRoutes?(ctx: FeatureRouteContext): Promise<Response | null>;
  wsPaths?: FeatureWsPath[];
  /** Create feature-owned DB tables; called by runMigrations after core tables. */
  migrations?(db: Database): void;
  /** Background work on boot (e.g. cache warming, browser init). */
  start?(): void | Promise<void>;
  /** Shutdown hook on SIGINT. */
  stop?(): void | Promise<void>;
}

const registeredFeatures: Feature[] = [];

export function registerFeature(feature: Feature): void {
  if (registeredFeatures.some((f) => f.name === feature.name)) {
    throw new Error(`Feature "${feature.name}" already registered`);
  }
  registeredFeatures.push(feature);
}

export function getFeatures(): Feature[] {
  return [...registeredFeatures];
}

/** Index of a feature in the registration order (for WS data payloads). */
export function getFeatureIndex(name: string): number {
  return registeredFeatures.findIndex((f) => f.name === name);
}
