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
export { ReadLaterPage } from "./pages/read-later";
export { ToplistsPage, ToplistPage } from "./pages/toplists";
export { FictionPage } from "./pages/fiction";
export { ReaderPage } from "./pages/reader";
export { SearchPage } from "./pages/search";
export { ErrorPage, LoadingPage } from "./pages/error";
export { LoginPage } from "./pages/login";
export { InvitePage, InviteExpiredPage } from "./pages/invite";
export { WsTestPage } from "./pages/ws-test";
export { RemotePage } from "./pages/remote";
export { LibraryPage } from "./pages/library";
export { LibraryUploadPage } from "./pages/library-upload";
export { EpubReaderPage } from "./pages/epub-reader";
export { FwnSearchPage } from "./pages/fwn-search";
export { FwnFictionPage } from "./pages/fwn-fiction";
export { FwnReaderPage } from "./pages/fwn-reader";
export { FwnLibraryPage } from "./pages/fwn-library";
