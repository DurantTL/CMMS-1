# Admin Localization Audit

## Root Cause Summary

- The locale cookie and `NextIntlClientProvider` were already wired at the app root.
- The language switcher refreshed the route correctly, but most admin UI text was still hard-coded English in:
  - the admin shell config
  - admin shell client components
  - server-rendered admin pages
  - client-side event/compliance builder UI
- Result: only the small subset of components already using `next-intl` changed when the toggle was used, which made it look like only the top header responded.

## Fix Strategy

- Merge locale messages over the English dictionary so missing Spanish keys fall back cleanly.
- Move admin shell navigation labels and descriptions to translation keys.
- Translate the current admin shell chrome and high-traffic admin pages through `getTranslations` and `useTranslations`.
- Keep translation structure organized by admin area so future bilingual event/template content can add content translations without rewriting shell infrastructure.
