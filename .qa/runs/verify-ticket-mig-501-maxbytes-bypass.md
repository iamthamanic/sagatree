# Verify — mig-501-maxbytes-bypass
HEAD_SHA: a6f6b148ccf3eecbbeea038a26c4e7230e948d0e
Issue: #939
Command: node --experimental-strip-types scripts/mig-501-resumable-uploads.self-test.mjs
Result: PASS (includes #939 maxBytes bypass + resumable 17 MiB)
