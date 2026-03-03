import QRCode from "qrcode";
import { useEffect, useState } from "react";

export async function buildQrCodeUrl(value: string, size = 180): Promise<string> {
  return QRCode.toDataURL(value, { width: size, margin: 1 });
}

export function useQrDataUrl(value: string | null | undefined, size = 180): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setDataUrl(null);
      return;
    }

    let active = true;
    void buildQrCodeUrl(value, size).then((url) => {
      if (active) setDataUrl(url);
    });

    return () => {
      active = false;
    };
  }, [value, size]);

  return dataUrl;
}
