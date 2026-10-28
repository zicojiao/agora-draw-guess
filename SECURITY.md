# Security

Server credentials must never appear in Git, browser code, URLs or logs. The database gateway requires a server-only shared secret. Room seats use random bearer tokens stored as hashes on the server. Room reads and drawing writes require seat authentication; only the current artist may upload drawings. Vision requests receive only the drawing and previous AI guesses. Do not disclose credentials in issue reports.
