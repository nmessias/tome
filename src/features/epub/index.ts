/**
 * EPUB feature — registration.
 *
 * The EPUB source adapter (src/sources/epub.ts, core's reference adapter)
 * claims the /read/epub/... routes via extraRoutes; this feature owns the
 * service, reader template, and migrations. The library/upload templates stay
 * in core: they are source-agnostic and shared with other library sources.
 */
import type { Feature } from "../../services/feature-registry";
import { migrateEpub } from "./migrations";

export const epubFeature: Feature = {
  name: "epub",
  migrations: migrateEpub,
};
