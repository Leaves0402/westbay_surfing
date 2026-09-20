"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  translateUiText,
  type AppLocale,
} from "@/lib/i18n";

type LanguageContextValue = {
  locale: AppLocale;
  isEnglish: boolean;
  setLocale: (locale: AppLocale) => void;
  toggleLocale: () => void;
  t: (value: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const localeChangeEvent = "westbay-locale-change";
const translatedAttributes = ["aria-label", "placeholder", "title"] as const;
const ignoredTags = new Set(["SCRIPT", "STYLE", "CODE", "PRE"]);
const textRecords = new WeakMap<Text, { source: string; applied?: string }>();
const attributeRecords = new WeakMap<
  Element,
  Map<string, { source: string; applied?: string }>
>();

function shouldIgnore(element: Element | null) {
  if (!element) return false;
  return Boolean(
    ignoredTags.has(element.tagName) ||
      element.closest(
        '[translate="no"], [data-i18n-ignore], [contenteditable="true"]'
      )
  );
}

function translatePreservingWhitespace(value: string, locale: AppLocale) {
  const match = value.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match || !match[2]) return value;
  const [, leading, core, trailing] = match;
  return `${leading}${translateUiText(core, locale)}${trailing}`;
}

function translateTextNode(node: Text, locale: AppLocale) {
  if (shouldIgnore(node.parentElement)) return;

  const current = node.data;
  let record = textRecords.get(node);
  if (!record || (record.applied !== current && record.source !== current)) {
    record = { source: current };
    textRecords.set(node, record);
  }

  const next =
    locale === "zh-Hant"
      ? record.source
      : translatePreservingWhitespace(record.source, locale);
  record.applied = next;
  if (next !== current) node.data = next;
}

function translateElementAttributes(element: Element, locale: AppLocale) {
  if (shouldIgnore(element)) return;

  let records = attributeRecords.get(element);
  if (!records) {
    records = new Map();
    attributeRecords.set(element, records);
  }

  for (const attribute of translatedAttributes) {
    const current = element.getAttribute(attribute);
    if (!current) continue;

    let record = records.get(attribute);
    if (!record || (record.applied !== current && record.source !== current)) {
      record = { source: current };
      records.set(attribute, record);
    }

    const next =
      locale === "zh-Hant"
        ? record.source
        : translateUiText(record.source, locale);
    record.applied = next;
    if (next !== current) element.setAttribute(attribute, next);
  }
}

function translateSubtree(root: Node, locale: AppLocale) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, locale);
    return;
  }
  if (!(root instanceof Element) && root !== document.body) return;

  if (root instanceof Element) translateElementAttributes(root, locale);
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT
  );
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node as Text, locale);
    } else {
      translateElementAttributes(node as Element, locale);
    }
    node = walker.nextNode();
  }
}

function getStoredLocale(): AppLocale {
  const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return savedLocale === "en" || savedLocale === "zh-Hant"
    ? savedLocale
    : DEFAULT_LOCALE;
}

function subscribeToLocale(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === LOCALE_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(localeChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(localeChangeEvent, onStoreChange);
  };
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    subscribeToLocale,
    getStoredLocale,
    () => DEFAULT_LOCALE
  );

  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "zh-Hant";
    translateSubtree(document.body, locale);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateTextNode(mutation.target as Text, locale);
          continue;
        }
        if (mutation.type === "attributes") {
          translateElementAttributes(mutation.target as Element, locale);
          continue;
        }
        mutation.addedNodes.forEach((node) => translateSubtree(node, locale));
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...translatedAttributes],
    });
    return () => observer.disconnect();
  }, [locale]);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    window.dispatchEvent(new Event(localeChangeEvent));
  }, []);
  const toggleLocale = useCallback(() => {
    setLocale(locale === "en" ? "zh-Hant" : "en");
  }, [locale, setLocale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      isEnglish: locale === "en",
      setLocale,
      toggleLocale,
      t: (text) => translateUiText(text, locale),
    }),
    [locale, setLocale, toggleLocale]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
