import { useEffect } from "react";

interface DocumentMeta {
  title?: string;
  description?: string;
  canonical?: string;
  /**
   * If true, sets `<meta name="robots" content="noindex,nofollow">`.
   * Used for surfaces like /login that shouldn't appear in search results.
   */
  noindex?: boolean;
}

/**
 * Per-route metadata for a client-rendered SPA.
 *
 * Updates `document.title`, `meta[name=description]`, `link[rel=canonical]`,
 * and (optionally) `meta[name=robots]` whenever the inputs change. Reverts
 * canonical/robots to the index.html defaults on unmount so SPA navigation
 * doesn't leak per-route meta into the next route.
 *
 * Google does render JS — but this is the cheap way to give /privacy and
 * /terms their own indexable title and description without a full pre-render
 * setup.
 */
export function useDocumentMeta({ title, description, canonical, noindex }: DocumentMeta): void {
  useEffect(() => {
    const prevTitle = document.title;

    if (title) document.title = title;
    if (description) setMeta("name", "description", description);
    if (canonical) setLink("canonical", canonical);
    if (noindex) setMeta("name", "robots", "noindex,nofollow");

    return () => {
      document.title = prevTitle;
      // Drop noindex on unmount so we don't accidentally noindex the next
      // route. Description and canonical can stay until the next route's
      // hook overwrites them.
      if (noindex) removeMeta("name", "robots");
    };
  }, [title, description, canonical, noindex]);
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function removeMeta(attr: "name" | "property", key: string) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}
