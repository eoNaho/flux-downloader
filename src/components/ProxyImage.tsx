import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

function useImageProxy(src: string) {
  const [imgSrc, setImgSrc] = useState<string | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);

    if (src && src.startsWith("http")) {
      invoke<string>("fetch_image_base64", { url: src })
        .then((b64) => setImgSrc(`data:image/jpeg;base64,${b64}`))
        .catch((e) => {
          console.error("Proxy preload failed", e);
          setImgSrc(src || undefined);
        });
    } else {
      setImgSrc(src || undefined);
    }
  }, [src]);

  const handleError = async () => {
    if (failed || (imgSrc && imgSrc.startsWith("data:"))) return;
    setFailed(true);
    try {
      const b64 = await invoke<string>("fetch_image_base64", { url: src });
      setImgSrc(`data:image/jpeg;base64,${b64}`);
    } catch (e) {
      console.error("Failed to proxy image", e);
    }
  };

  return { imgSrc, handleError };
}

export const ProxyImage = ({
  src,
  className,
  alt,
}: {
  src: string;
  className?: string;
  alt: string;
}) => {
  const { imgSrc, handleError } = useImageProxy(src);

  return (
    <img
      src={imgSrc || undefined}
      className={className}
      alt={alt}
      onError={handleError}
      referrerPolicy="no-referrer"
    />
  );
};
