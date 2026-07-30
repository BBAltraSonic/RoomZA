# Vendor adapter contract fixtures

Vendor-specific adapters are intentionally disabled in V1.

Add one folder per provider only after receiving an anonymized export sample. Each folder must contain:

- a sanitized source fixture;
- the expected canonical Pinpoint records;
- expected validation and duplicate outcomes;
- a contract test that pins the provider schema version.

Property24, PropCtrl, WeConnectU, and similar sources remain unsupported until those fixtures and tests exist. Generic CSV, XLSX, XML, and JSON imports can still be used for their exports.
