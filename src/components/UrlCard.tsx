interface UrlCardProps {
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
}

function makeQrcodeUrl(value: string): string {
  const encoded = encodeURIComponent(value);
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encoded}`;
}

export function UrlCard({ websiteUrl, linkedinUrl }: UrlCardProps) {
  const targetUrl = websiteUrl || linkedinUrl;

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
      <img className="qr" src={makeQrcodeUrl(targetUrl)} alt="Profile QR code" />
    </div>
  );
}
