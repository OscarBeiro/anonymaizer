# Restoration key v1

Format design, 2026-10-12. Browser interoperability and independent security
review remain release gates; the implementation must not claim those passed.

The UTF-8 JSON envelope has exactly `version`, `algorithm`, `kdf`, `iterations`,
`salt`, `nonce`, `ciphertext`. Version is 1, algorithm AES-256-GCM with a 128-bit
 tag, KDF PBKDF2-HMAC-SHA256. Passwords use UTF-8 without Unicode normalization;
visually similar but differently normalized passwords are distinct. Passwords
are limited to 1–1024 code units. New exports use 600,000 iterations. Imports
allow 600,000–1,000,000 iterations, integers only. This adopts the
[OWASP PBKDF2 baseline](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
The parameters are provisional until browser calibration evidence is recorded.

Salt is 16 random bytes, nonce 12 random bytes, generated independently by
`crypto.getRandomValues`. Binary fields use canonical lowercase hexadecimal.
Authenticated additional data is UTF-8 JSON of the ordered array:
`[version,algorithm,kdf,iterations,salt,nonce]`. The authenticated payload is a
validated immutable v1 mapping snapshot (scope, document and policy revisions,
mapping revision, export ID, engine version and enabled mappings). Raw documents,
responses, source filenames and plaintext originals never appear in headers.

Envelope size is capped at 8 MB characters before JSON parsing, plaintext at
4 MB bytes, mappings at 10,000. Validate field allowlists, sizes and parameter
bounds before derivation. Unsupported/malformed envelopes are distinguished
from generic password-or-tampering authentication failures. Decrypt and validate
in temporary state, then commit atomically. No plaintext or weaker-parameter
fallback. Unknown future versions are rejected. Pre-M9 sessions require explicit
legacy snapshot selection and a deliberate new scoped export; an unversioned
file is never interpreted as an encrypted key. Future upgrades must retain a
versioned reader and explicit re-export, never silently downgrade.

The key and password are required for recovery. Losing either prevents recovery.
A browser download handoff does not establish that the key was saved on disk.
An unlocked page holds originals in memory; encryption does not protect it from
scripts already running in that page. Browser clearing does not remove downloads.
Primitives follow the [Web Cryptography specification](https://www.w3.org/TR/WebCryptoAPI/).
