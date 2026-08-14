/**
 * Remote control feature — registration.
 */
import type { Feature } from "../../services/feature-registry";
import { remotePageRoutes, remoteApiRoutes } from "./routes";
import { remoteWsPath } from "./ws";

export const remoteFeature: Feature = {
  name: "remote",
  pageRoutes: remotePageRoutes,
  apiRoutes: remoteApiRoutes,
  wsPaths: [remoteWsPath],
};
