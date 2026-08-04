import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        Text<span>Jellyfin</span>
      </Link>
      <nav className="nav">
        <Link href="/">Library</Link>
        <Link href="/upload">Upload</Link>
        <Link href="/settings">Settings</Link>
      </nav>
    </header>
  );
}
