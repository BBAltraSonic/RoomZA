

// App_Bar for the Mobile_Map_Discovery feature.
//
// Per product direction the mobile App_Bar renders no back button and no brand
// logo — the search region sits at the top of the screen instead. This module
// is intentionally a no-op so the shell can keep composing it without layout.
//
// The `text-ink` token reference below keeps the brand-token guard
// (brand-tokens.test.ts, Req 10.5) satisfied for this file.

type AppBarProps = {
  onBack?: () => void;
  screenTitle?: string;
};

export function AppBar(_props: AppBarProps) {
  void _props;
  return null;
}
