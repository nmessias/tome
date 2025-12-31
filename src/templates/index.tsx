/**
 * Templates module
 * Re-exports all page templates, layout, and components
 */

// Layout utilities
export { Layout, ReaderLayout } from "./layout";
export type { LayoutProps } from "./layout";

// Reusable components
export {
  Header,
  Nav,
  SectionTitle,
  Pagination,
  paginate,
  Alert,
  CoverImage,
  FictionCard,
  FictionCardCompact,
  formatBytes,
  DescriptionToggleScript,
} from "./components";
export type { FictionCardProps } from "./components";

// Page templates
export { HomePage } from "./pages/home";
export { SettingsPage } from "./pages/settings";
export { FollowsPage } from "./pages/follows";
export { HistoryPage } from "./pages/history";
export { ToplistsPage, ToplistPage } from "./pages/toplists";
export { FictionPage } from "./pages/fiction";
export { ReaderPage } from "./pages/reader";
export { SearchPage } from "./pages/search";
export { ErrorPage, LoadingPage } from "./pages/error";
export { LoginPage } from "./pages/login";
