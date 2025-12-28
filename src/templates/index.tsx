/**
 * Templates module
 * Re-exports all page templates, layout, and components
 */

// Layout utilities
export { Layout, ReaderLayout } from "./layout";
export type { LayoutProps } from "./layout";

// Reusable components
export {
  Nav,
  Pagination,
  paginate,
  Alert,
  CoverImage,
  FictionCard,
  formatBytes,
  DescriptionToggleScript,
} from "./components";
export type { FictionCardProps } from "./components";

// Page templates
export { HomePage } from "./pages/home";
export { SetupPage } from "./pages/setup";
export { FollowsPage } from "./pages/follows";
export { HistoryPage } from "./pages/history";
export { ToplistsPage, ToplistPage } from "./pages/toplists";
export { FictionPage } from "./pages/fiction";
export { ReaderPage } from "./pages/reader";
export { SearchPage } from "./pages/search";
export { CachePage } from "./pages/cache";
export { ErrorPage, LoadingPage } from "./pages/error";
export { LoginPage } from "./pages/login";
