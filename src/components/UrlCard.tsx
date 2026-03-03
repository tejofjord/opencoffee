import { useQrDataUrl } from "../lib/qr";

interface UrlCardProps {
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
}

export function UrlCard({ websiteUrl, linkedinUrl }: UrlCardProps) {
  const targetUrl = websiteUrl || linkedinUrl;
  const qrDataUrl = useQrDataUrl(targetUrl);

  if (!targetUrl) {
    return <div className="url-card">No website or LinkedIn URL provided.</div>;
  }

  let hostname = targetUrl;
  try {
    hostname = new URL(targetUrl).hostname;
  } catch {
    // Keep original string if URL parsing fails.
  }

  return (
    <div className="url-card">
      <div className="muted small">Profile Link</div>
      <a href={targetUrl} target="_blank" rel="noreferrer" className="url-main">
        {hostname}
      </a>
      <div className="small muted break">{targetUrl}</div>
      {qrDataUrl ? (
        <img className="qr" src={qrDataUrl} alt="Profile QR code" />
      ) : null}
    </div>
  );
}
